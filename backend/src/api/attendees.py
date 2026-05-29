import logging
import time
import uuid

from fastapi import APIRouter, BackgroundTasks, Body, HTTPException, status
from fastapi.responses import HTMLResponse, Response

from env import SmtpSettings
from schema.rest import (
    AttendeeCreate,
    AttendeeResponse,
    BulkCreateResponse,
    BulkDeleteResponse,
)
from service import attendees as attendees_service
from service import checkin as checkin_service
from service import email as email_service
from service import events as events_service
from service.ticket import generate_ticket_images

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events/{event_id}/attendees", tags=["attendees"])


def _check_event(event_id: uuid.UUID):
    event = events_service.get_event(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return event


def _check_attendee(event_id: uuid.UUID, attendee_id: uuid.UUID) -> None:
    if attendees_service.get_attendee(event_id, attendee_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Attendee not found"
        )


@router.get("")
def list_attendees(event_id: uuid.UUID) -> list[AttendeeResponse]:
    _check_event(event_id)
    return attendees_service.list_attendees(event_id)


@router.post("", status_code=status.HTTP_201_CREATED)
def bulk_create_attendees(
    event_id: uuid.UUID,
    payload: list[AttendeeCreate],
    background_tasks: BackgroundTasks,
) -> BulkCreateResponse:
    _check_event(event_id)
    result = attendees_service.bulk_create(event_id, payload)
    if result.created:
        background_tasks.add_task(generate_ticket_images, event_id)
    return result


@router.get("/{attendee_id}")
def get_attendee(event_id: uuid.UUID, attendee_id: uuid.UUID) -> AttendeeResponse:
    _check_event(event_id)
    attendee = attendees_service.get_attendee(event_id, attendee_id)
    if attendee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Attendee not found"
        )
    return attendee


@router.delete("")
def bulk_delete_attendees(
    event_id: uuid.UUID, payload: list[uuid.UUID]
) -> BulkDeleteResponse:
    _check_event(event_id)
    return attendees_service.bulk_delete(event_id, payload)


@router.get("/{attendee_id}/ticket/preview")
def preview_ticket(event_id: uuid.UUID, attendee_id: uuid.UUID):
    img_bytes = checkin_service.get_ticket_image(event_id, attendee_id)
    if img_bytes is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    return Response(content=img_bytes, media_type="image/png")


@router.get("/{attendee_id}/email/preview")
def preview_email(
    event_id: uuid.UUID,
    attendee_id: uuid.UUID,
) -> HTMLResponse:
    event = _check_event(event_id)
    attendee = attendees_service.get_attendee(event_id, attendee_id)
    if attendee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Attendee not found"
        )
    qr_bytes = checkin_service.get_ticket_image(event_id, attendee_id)
    if qr_bytes is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    template = events_service.get_email_template(event_id)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Email template not found"
        )
    html = email_service.render_preview_html(
        template.text,
        attendee.title,
        attendee.name,
        event.name,
        qr_bytes,
    )
    return HTMLResponse(content=html)


@router.post("/{attendee_id}/email", status_code=status.HTTP_204_NO_CONTENT)
def send_email(
    event_id: uuid.UUID,
    attendee_id: uuid.UUID,
) -> Response:
    event = _check_event(event_id)
    attendee = attendees_service.get_attendee(event_id, attendee_id)
    if attendee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Attendee not found"
        )
    qr_bytes = checkin_service.get_ticket_image(event_id, attendee_id)
    if qr_bytes is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    template = events_service.get_email_template(event_id)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Email template not found"
        )
    subject = f"[Ticket] {event.name}"
    email_service.send_ticket_email(
        attendee.email,
        subject,
        template.text,
        attendee.title,
        attendee.name,
        event.name,
        qr_bytes,
    )
    if not attendees_service.mark_ticket_delivered(event_id, attendee_id):
        logger.warning(
            "Failed to mark ticket delivered for attendee %s in event %s",
            attendee_id,
            event_id,
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{attendee_id}/ticket/delivery", status_code=status.HTTP_204_NO_CONTENT)
def mark_ticket_delivered(
    event_id: uuid.UUID,
    attendee_id: uuid.UUID,
) -> Response:
    _check_event(event_id)
    _check_attendee(event_id, attendee_id)
    attendees_service.mark_ticket_delivered(event_id, attendee_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


bulk_email_router = APIRouter(prefix="/events/{event_id}", tags=["bulk-email"])


def _bulk_send_emails_task(
    event_id: uuid.UUID, attendee_ids: list[uuid.UUID]
) -> None:
    event = events_service.get_event(event_id)
    if event is None:
        logger.error("Event %s not found during bulk email task", event_id)
        return

    template = events_service.get_email_template(event_id)
    if template is None:
        logger.error("Email template not found for event %s", event_id)
        return

    smtp_settings = SmtpSettings()
    total = len(attendee_ids)

    for i, attendee_id in enumerate(attendee_ids):
        try:
            attendee = attendees_service.get_attendee(event_id, attendee_id)
            if attendee is None:
                logger.warning(
                    "Attendee %s not found, skipping (%d/%d)",
                    attendee_id,
                    i + 1,
                    total,
                )
                continue

            qr_bytes = checkin_service.get_ticket_image(event_id, attendee_id)
            if qr_bytes is None:
                logger.warning(
                    "Ticket image not ready for attendee %s, skipping (%d/%d)",
                    attendee_id,
                    i + 1,
                    total,
                )
                continue

            subject = f"[Ticket] {event.name}"
            email_service.send_ticket_email(
                attendee.email,
                subject,
                template.text,
                attendee.title,
                attendee.name,
                event.name,
                qr_bytes,
            )
            if not attendees_service.mark_ticket_delivered(event_id, attendee_id):
                logger.warning(
                    "Failed to mark ticket delivered for attendee %s in event %s",
                    attendee_id,
                    event_id,
                )
            logger.info(
                "Sent email to %s (%d/%d)", attendee.email, i + 1, total
            )
        except Exception:
            logger.exception(
                "Failed to send email to attendee %s (%d/%d)",
                attendee_id,
                i + 1,
                total,
            )

        if i < total - 1:
            time.sleep(smtp_settings.email_wait_between_delivery_second)

    logger.info(
        "Bulk email sending completed for event %s (%d attendees)",
        event_id,
        total,
    )


@bulk_email_router.post("/emails", status_code=status.HTTP_201_CREATED)
def bulk_send_email(
    event_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    payload: list[uuid.UUID] = Body(...),
) -> dict:
    _check_event(event_id)
    for attendee_id in payload:
        _check_attendee(event_id, attendee_id)
    background_tasks.add_task(_bulk_send_emails_task, event_id, payload)
    return {"message": "Bulk email sending started"}
