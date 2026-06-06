import base64
import email.mime.image
import email.mime.multipart
import email.mime.text
import logging
import math
import smtplib
import time
import uuid

from jinja2 import Template

import config
import schema.sse
import service.event_stream

logger = logging.getLogger(__name__)


def _render_template(
    template_str: str,
    title: str | None,
    full_name: str,
    event_name: str,
    sender_name: str,
) -> str:
    template = Template(template_str)
    ticket_qr = (
        '<p style="text-align: center; margin: 20px 0;">'
        '<img src="cid:qr_code" alt="Your QR Code Ticket"'
        ' style="max-width: 320px; border: 2px solid #ddd; padding: 12px; border-radius: 8px;"/>'
        "</p>"
    )
    return template.render(
        title=title,
        fullName=full_name,
        eventName=event_name,
        ticketQR=ticket_qr,
        senderName=sender_name,
    )


def render_preview_html(
    template_str: str,
    title: str | None,
    full_name: str,
    event_name: str,
    sender_name: str,
    qr_image_bytes: bytes,
) -> str:
    html = _render_template(template_str, title, full_name, event_name, sender_name)
    qr_base64 = base64.b64encode(qr_image_bytes).decode()
    return html.replace("cid:qr_code", f"data:image/png;base64,{qr_base64}")


def send_ticket_email(
    to_email: str,
    subject: str,
    template_str: str,
    title: str | None,
    full_name: str,
    event_name: str,
    sender_name: str,
    qr_image_bytes: bytes,
) -> None:
    cfg = config.get_config()
    if not cfg.email_smtp.host:
        raise RuntimeError("SMTP is not configured")

    html = _render_template(template_str, title, full_name, event_name, sender_name)

    msg = email.mime.multipart.MIMEMultipart("related")
    msg["Subject"] = subject
    msg["From"] = cfg.email_smtp.display_email or cfg.email_smtp.username
    msg["To"] = to_email

    msg.attach(email.mime.text.MIMEText(html, "html"))

    img = email.mime.image.MIMEImage(qr_image_bytes, "png")
    img.add_header("Content-ID", "<qr_code>")
    img.add_header("Content-Disposition", "inline", filename="ticket.png")
    msg.attach(img)

    with smtplib.SMTP_SSL(
        cfg.email_smtp.host, cfg.email_smtp.port, timeout=30
    ) as server:
        logger.info(
            "Logging in to SMTP server [%s] as [%s]",
            cfg.email_smtp.host,
            cfg.email_smtp.username,
        )
        server.login(cfg.email_smtp.username, cfg.email_smtp.password)
        logger.info("Sending ticket email to [%s]", to_email)
        server.sendmail(cfg.email_smtp.username, to_email, msg.as_string())

    logger.info("Sent ticket email to %s", to_email)


def bulk_send_task(
    event_id: uuid.UUID,
    participant_ids: list[uuid.UUID],
    get_event,
    get_email_template,
    get_participant,
    get_ticket_image,
    mark_ticket_delivered,
) -> None:
    manager = service.event_stream.event_stream_manager
    event = get_event(event_id)
    if event is None:
        logger.error("Event %s not found during bulk email task", event_id)
        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.SendEmailErrorData](
                event_type=schema.sse.SseEventType.SEND_EMAIL,
                type=schema.sse.SseType.NOTIFICATION,
                data=schema.sse.SendEmailErrorData(detail="Event not found"),
            ),
        )
        return

    template = get_email_template(event_id)
    if template is None:
        logger.error("Email template not found for event %s", event_id)
        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.SendEmailErrorData](
                event_type=schema.sse.SseEventType.SEND_EMAIL,
                type=schema.sse.SseType.NOTIFICATION,
                data=schema.sse.SendEmailErrorData(detail="Email template not found"),
            ),
        )
        return

    cfg = config.get_config()
    sender_name = cfg.app.organization_name or "Event Organizer"
    smtp_cfg = cfg.email_smtp
    total = len(participant_ids)
    num_completed = 0
    num_errors = 0
    start_time = time.monotonic()

    def _notify_error(detail: str) -> None:
        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.SendEmailErrorData](
                event_type=schema.sse.SseEventType.SEND_EMAIL,
                type=schema.sse.SseType.NOTIFICATION,
                data=schema.sse.SendEmailErrorData(detail=detail),
            ),
        )

    def _send_progress():
        est = None
        if num_completed > 0:
            elapsed = time.monotonic() - start_time
            est_sec = (elapsed / num_completed) * (total - num_completed)
            est = max(1, math.ceil(est_sec / 60))
        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.SendEmailProgressData](
                event_type=schema.sse.SseEventType.SEND_EMAIL,
                type=schema.sse.SseType.PROGRESS,
                data=schema.sse.SendEmailProgressData(
                    in_progress=True,
                    num_completed=num_completed,
                    num_total=total,
                    est_remain_min=est,
                    num_errors=num_errors,
                ),
            ),
            sticky=True,
        )

    try:
        for i, participant_id in enumerate(participant_ids):
            _send_progress()

            try:
                participant = get_participant(event_id, participant_id)
                if participant is None:
                    logger.warning(
                        "Participant %s not found, skipping (%d/%d)",
                        participant_id,
                        i + 1,
                        total,
                    )
                    num_errors += 1
                    _notify_error(f"Participant {participant_id} not found")
                    num_completed += 1
                    continue

                if not participant.email:
                    logger.warning(
                        "Participant %s has no email, skipping (%d/%d)",
                        participant_id,
                        i + 1,
                        total,
                    )
                    num_errors += 1
                    _notify_error(
                        f"No email for {participant.title} {participant.name}"
                    )
                    num_completed += 1
                    continue

                qr_bytes = get_ticket_image(event_id, participant_id)
                if qr_bytes is None:
                    logger.warning(
                        "Ticket image not ready for participant %s, skipping (%d/%d)",
                        participant_id,
                        i + 1,
                        total,
                    )
                    num_errors += 1
                    _notify_error(
                        f"Ticket image not ready for {participant.title} {participant.name}"
                    )
                    num_completed += 1
                    continue

                subject = f"[Ticket] {event.name}"
                send_ticket_email(
                    participant.email,
                    subject,
                    template.text,
                    participant.title,
                    participant.name,
                    event.name,
                    sender_name,
                    qr_bytes,
                )
                if not mark_ticket_delivered(event_id, participant_id):
                    logger.warning(
                        "Failed to mark ticket delivered for participant %s in event %s",
                        participant_id,
                        event_id,
                    )
                logger.info("Sent email to %s (%d/%d)", participant.email, i + 1, total)
            except Exception:
                logger.exception(
                    "Failed to send email to participant %s (%d/%d)",
                    participant_id,
                    i + 1,
                    total,
                )
                num_errors += 1
                _notify_error(f"Failed to send email to participant {participant_id}")

            num_completed += 1

            if i < total - 1:
                time.sleep(smtp_cfg.wait_between_delivery_second)

        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.SendEmailProgressData](
                event_type=schema.sse.SseEventType.SEND_EMAIL,
                type=schema.sse.SseType.PROGRESS,
                data=schema.sse.SendEmailProgressData(
                    in_progress=False,
                    num_completed=num_completed,
                    num_total=total,
                    num_errors=num_errors,
                ),
            ),
            sticky=True,
        )

        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.SendEmailSuccessData](
                event_type=schema.sse.SseEventType.SEND_EMAIL,
                type=schema.sse.SseType.NOTIFICATION,
                data=schema.sse.SendEmailSuccessData(),
            ),
        )

        logger.info(
            "Bulk email sending completed for event %s (%d participants)",
            event_id,
            total,
        )

    except Exception as e:
        logger.exception("Bulk email task failed for event %s", event_id)

        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.SendEmailProgressData](
                event_type=schema.sse.SseEventType.SEND_EMAIL,
                type=schema.sse.SseType.PROGRESS,
                data=schema.sse.SendEmailProgressData(
                    in_progress=False,
                    num_completed=num_completed,
                    num_total=total,
                    num_errors=num_errors,
                ),
            ),
            sticky=True,
        )

        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.SendEmailErrorData](
                event_type=schema.sse.SseEventType.SEND_EMAIL,
                type=schema.sse.SseType.NOTIFICATION,
                data=schema.sse.SendEmailErrorData(detail=str(e)),
            ),
        )


def bulk_send_and_notify(
    event_id: uuid.UUID,
    participant_ids: list[uuid.UUID],
    get_event,
    get_email_template,
    get_participant,
    get_ticket_image,
    mark_ticket_delivered,
) -> None:
    manager = service.event_stream.event_stream_manager
    try:
        bulk_send_task(
            event_id,
            participant_ids,
            get_event,
            get_email_template,
            get_participant,
            get_ticket_image,
            mark_ticket_delivered,
        )
    finally:
        manager.mark_job_done(event_id, "bulk_email")
