import base64
import logging
import math
import smtplib
import time
import uuid
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from jinja2 import Template

from env import SmtpSettings
from schema.sse import (
    SendEmailErrorData,
    SendEmailProgressData,
    SendEmailSuccessData,
    SseEvent,
    SseEventType,
    SseType,
)
from service.event_stream import EventStreamManager

logger = logging.getLogger(__name__)


def _render_template(
    template_str: str, title: str, full_name: str, event_name: str
) -> str:
    template = Template(template_str)
    ticket_qr = (
        '<p style="text-align: center; margin: 20px 0;">'
        '<img src="cid:qr_code" alt="Your QR Code Ticket"'
        ' style="max-width: 320px; border: 2px solid #ddd; padding: 12px; border-radius: 8px;"/>'
        "</p>"
    )
    return template.render(
        title=title, fullName=full_name, eventName=event_name, ticketQR=ticket_qr
    )


def render_preview_html(
    template_str: str,
    title: str,
    full_name: str,
    event_name: str,
    qr_image_bytes: bytes,
) -> str:
    html = _render_template(template_str, title, full_name, event_name)
    qr_base64 = base64.b64encode(qr_image_bytes).decode()
    return html.replace("cid:qr_code", f"data:image/png;base64,{qr_base64}")


def send_ticket_email(
    to_email: str,
    subject: str,
    template_str: str,
    title: str,
    full_name: str,
    event_name: str,
    qr_image_bytes: bytes,
) -> None:
    settings = SmtpSettings()
    if not settings.smtp_server:
        raise RuntimeError("SMTP is not configured")

    html = _render_template(template_str, title, full_name, event_name)

    msg = MIMEMultipart("related")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_username
    msg["To"] = to_email

    msg.attach(MIMEText(html, "html"))

    img = MIMEImage(qr_image_bytes, "png")
    img.add_header("Content-ID", "<qr_code>")
    img.add_header("Content-Disposition", "inline", filename="ticket.png")
    msg.attach(img)

    with smtplib.SMTP_SSL(
        settings.smtp_server, settings.smtp_port, timeout=30
    ) as server:
        logger.info(
            "Logging in to SMTP server [%s] as [%s]",
            settings.smtp_server,
            settings.smtp_username,
        )
        server.login(settings.smtp_username, settings.smtp_password)
        logger.info("Sending ticket email to [%s]", to_email)
        server.sendmail(settings.smtp_username, to_email, msg.as_string())

    logger.info("Sent ticket email to %s", to_email)


def bulk_send_task(
    event_id: uuid.UUID,
    attendee_ids: list[uuid.UUID],
    get_event,
    get_email_template,
    get_attendee,
    get_ticket_image,
    mark_ticket_delivered,
) -> None:
    manager = EventStreamManager()
    event = get_event(event_id)
    if event is None:
        logger.error("Event %s not found during bulk email task", event_id)
        manager.send(
            event_id,
            SseEvent[SendEmailErrorData](
                event_type=SseEventType.SEND_EMAIL,
                type=SseType.NOTIFICATION,
                data=SendEmailErrorData(detail="Event not found"),
            ),
        )
        return

    template = get_email_template(event_id)
    if template is None:
        logger.error("Email template not found for event %s", event_id)
        manager.send(
            event_id,
            SseEvent[SendEmailErrorData](
                event_type=SseEventType.SEND_EMAIL,
                type=SseType.NOTIFICATION,
                data=SendEmailErrorData(detail="Email template not found"),
            ),
        )
        return

    smtp_settings = SmtpSettings()
    total = len(attendee_ids)
    num_completed = 0
    num_errors = 0
    start_time = time.monotonic()

    def _notify_error(detail: str) -> None:
        manager.send(
            event_id,
            SseEvent[SendEmailErrorData](
                event_type=SseEventType.SEND_EMAIL,
                type=SseType.NOTIFICATION,
                data=SendEmailErrorData(detail=detail),
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
            SseEvent[SendEmailProgressData](
                event_type=SseEventType.SEND_EMAIL,
                type=SseType.PROGRESS,
                data=SendEmailProgressData(
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
        for i, attendee_id in enumerate(attendee_ids):
            _send_progress()

            try:
                attendee = get_attendee(event_id, attendee_id)
                if attendee is None:
                    logger.warning(
                        "Attendee %s not found, skipping (%d/%d)",
                        attendee_id,
                        i + 1,
                        total,
                    )
                    num_errors += 1
                    _notify_error(f"Attendee {attendee_id} not found")
                    num_completed += 1
                    continue

                qr_bytes = get_ticket_image(event_id, attendee_id)
                if qr_bytes is None:
                    logger.warning(
                        "Ticket image not ready for attendee %s, skipping (%d/%d)",
                        attendee_id,
                        i + 1,
                        total,
                    )
                    num_errors += 1
                    _notify_error(
                        f"Ticket image not ready for {attendee.title} {attendee.name}"
                    )
                    num_completed += 1
                    continue

                subject = f"[Ticket] {event.name}"
                send_ticket_email(
                    attendee.email,
                    subject,
                    template.text,
                    attendee.title,
                    attendee.name,
                    event.name,
                    qr_bytes,
                )
                if not mark_ticket_delivered(event_id, attendee_id):
                    logger.warning(
                        "Failed to mark ticket delivered for attendee %s in event %s",
                        attendee_id,
                        event_id,
                    )
                logger.info("Sent email to %s (%d/%d)", attendee.email, i + 1, total)
            except Exception:
                logger.exception(
                    "Failed to send email to attendee %s (%d/%d)",
                    attendee_id,
                    i + 1,
                    total,
                )
                num_errors += 1
                _notify_error(f"Failed to send email to attendee {attendee_id}")

            num_completed += 1

            if i < total - 1:
                time.sleep(smtp_settings.email_wait_between_delivery_second)

        manager.send(
            event_id,
            SseEvent[SendEmailProgressData](
                event_type=SseEventType.SEND_EMAIL,
                type=SseType.PROGRESS,
                data=SendEmailProgressData(
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
            SseEvent[SendEmailSuccessData](
                event_type=SseEventType.SEND_EMAIL,
                type=SseType.NOTIFICATION,
                data=SendEmailSuccessData(),
            ),
        )

        logger.info(
            "Bulk email sending completed for event %s (%d attendees)",
            event_id,
            total,
        )

    except Exception as e:
        logger.exception("Bulk email task failed for event %s", event_id)

        manager.send(
            event_id,
            SseEvent[SendEmailProgressData](
                event_type=SseEventType.SEND_EMAIL,
                type=SseType.PROGRESS,
                data=SendEmailProgressData(
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
            SseEvent[SendEmailErrorData](
                event_type=SseEventType.SEND_EMAIL,
                type=SseType.NOTIFICATION,
                data=SendEmailErrorData(detail=str(e)),
            ),
        )


def bulk_send_and_notify(
    event_id: uuid.UUID,
    attendee_ids: list[uuid.UUID],
    get_event,
    get_email_template,
    get_attendee,
    get_ticket_image,
    mark_ticket_delivered,
) -> None:
    manager = EventStreamManager()
    try:
        bulk_send_task(
            event_id,
            attendee_ids,
            get_event,
            get_email_template,
            get_attendee,
            get_ticket_image,
            mark_ticket_delivered,
        )
    finally:
        manager.mark_job_done(event_id, "bulk_email")
