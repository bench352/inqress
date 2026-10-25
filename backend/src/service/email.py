import base64
import email.mime.image
import email.mime.multipart
import email.mime.text
import email.utils
import logging
import math
import smtplib
import time
import uuid

import config
import schema.sse
import service.event_stream
import service.filenames
import service.markup
import service.settings
import service.ticket

logger = logging.getLogger(__name__)


def strip_line_breaks(value: str) -> str:
    """A header value cannot carry a line break."""
    return " ".join(value.splitlines())


def resolve_subject(event_name: str, custom_subject: str | None) -> str:
    return custom_subject or f"[Ticket] {event_name}"


def resolve_sender_name(
    custom_sender_name: str | None, organization_name: str | None
) -> str:
    return custom_sender_name or organization_name or "Event Organizer"


FROM_ADDRESS_ERROR = "from_address is not an email address"


def resolve_from_address(from_address: str | None, username: str) -> str:
    """The address a message is sent from. Empty means the SMTP username."""
    value = strip_line_breaks(from_address or "").strip()
    if not value:
        return username
    _name, address = email.utils.parseaddr(value)
    if "@" not in address:
        # A configured value that cannot be used is a mistake, not a fallback.
        raise ValueError(FROM_ADDRESS_ERROR)
    return address


def from_header(sender_name: str, address: str) -> str:
    return email.utils.formataddr((strip_line_breaks(sender_name), address))


def resolve_from(
    from_address: str | None, username: str, sender_name: str
) -> tuple[str | None, str | None]:
    """The header a send would use, or the reason it cannot be built."""
    try:
        address = resolve_from_address(from_address, username)
    except ValueError as error:
        return None, str(error)
    return from_header(sender_name, address), None


def render_ticket_card(
    event_id: uuid.UUID, participant_id: uuid.UUID, participant_name: str
) -> tuple[bytes, str]:
    image, _ = service.ticket.generate_single_ticket_image(event_id, participant_id)
    return image.getvalue(), service.filenames.ticket_image_name(participant_name)


def _render_template(
    template_str: str,
    title: str | None,
    full_name: str,
    event_name: str,
    sender_name: str,
    include_footer: bool,
) -> str:
    return service.markup.render_email_html(
        template_str,
        title,
        full_name,
        event_name,
        sender_name,
        include_footer,
    )


def render_preview_html(
    template_str: str,
    title: str | None,
    full_name: str,
    event_name: str,
    sender_name: str,
    qr_image_bytes: bytes,
    include_footer: bool = True,
) -> str:
    html = _render_template(
        template_str, title, full_name, event_name, sender_name, include_footer
    )
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
    *,
    ticket_card: tuple[bytes, str],
    include_footer: bool,
) -> None:
    cfg = config.get_config()
    if not cfg.email_smtp.host:
        raise RuntimeError("SMTP is not configured")
    from_address = resolve_from_address(
        cfg.email_smtp.from_address, cfg.email_smtp.username
    )

    html = _render_template(
        template_str, title, full_name, event_name, sender_name, include_footer
    )

    related = email.mime.multipart.MIMEMultipart("related")
    related.attach(email.mime.text.MIMEText(html, "html"))

    img = email.mime.image.MIMEImage(qr_image_bytes, "png")
    img.add_header("Content-ID", "<qr_code>")
    img.add_header("Content-Disposition", "inline", filename="ticket.png")
    related.attach(img)

    msg = email.mime.multipart.MIMEMultipart("mixed")
    msg["Subject"] = strip_line_breaks(subject)
    msg["From"] = from_header(sender_name, from_address)
    msg["To"] = to_email
    msg.attach(related)

    card_bytes, card_name = ticket_card
    card = email.mime.image.MIMEImage(card_bytes, "png")
    card.add_header("Content-Disposition", "attachment", filename=card_name)
    msg.attach(card)

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
        server.sendmail(from_address, to_email, msg.as_string())

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
    settings = service.settings.get_email_settings(event_id)
    subject = resolve_subject(event.name, settings.subject if settings else None)
    sender_name = resolve_sender_name(
        settings.sender_name if settings else None, cfg.app.organization_name
    )
    include_footer = cfg.email_smtp.email_footer_enabled
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

                ticket_card = render_ticket_card(
                    event_id, participant_id, participant.name
                )
                send_ticket_email(
                    participant.email,
                    subject,
                    template.text,
                    participant.title,
                    participant.name,
                    event.name,
                    sender_name,
                    qr_bytes,
                    ticket_card=ticket_card,
                    include_footer=include_footer,
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
