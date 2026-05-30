import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Body, HTTPException, status
from fastapi.responses import HTMLResponse, Response

from api.deps import check_event_exists
from schema.rest import (
    AttendeeCreate,
    AttendeeResponse,
    BulkDeleteResponse,
)
from service import attendees as attendees_service
from service import checkin as checkin_service
from service import email as email_service
from service import events as events_service
from service import ticket as ticket_service
from service.event_stream import EventStreamManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events/{event_id}/attendees", tags=["attendees"])


def check_attendee_exists(event_id: uuid.UUID, attendee_id: uuid.UUID) -> None:
    if attendees_service.get_attendee(event_id, attendee_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Attendee not found"
        )


@router.get("")
def list_attendees(event_id: uuid.UUID) -> list[AttendeeResponse]:
    check_event_exists(event_id)
    return attendees_service.list_attendees(event_id)


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def bulk_create_attendees(
    event_id: uuid.UUID,
    payload: list[AttendeeCreate],
    background_tasks: BackgroundTasks,
) -> dict:
    check_event_exists(event_id)

    if not EventStreamManager().mark_job_active(event_id, "import"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An import is already in progress for this event",
        )

    background_tasks.add_task(
        attendees_service.bulk_create_and_notify, event_id, payload
    )
    return {"message": "Import started"}


@router.get("/{attendee_id}")
def get_attendee(event_id: uuid.UUID, attendee_id: uuid.UUID) -> AttendeeResponse:
    check_event_exists(event_id)
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
    check_event_exists(event_id)
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
    event = check_event_exists(event_id)
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
    event = check_event_exists(event_id)
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
    check_event_exists(event_id)
    check_attendee_exists(event_id, attendee_id)
    attendees_service.mark_ticket_delivered(event_id, attendee_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


bulk_email_router = APIRouter(prefix="/events/{event_id}", tags=["bulk-email"])


@bulk_email_router.post("/emails", status_code=status.HTTP_202_ACCEPTED)
def bulk_send_email(
    event_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    payload: list[uuid.UUID] = Body(...),
) -> dict:
    check_event_exists(event_id)
    for attendee_id in payload:
        check_attendee_exists(event_id, attendee_id)

    if not EventStreamManager().mark_job_active(event_id, "bulk_email"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bulk email sending is already in progress for this event",
        )

    background_tasks.add_task(
        email_service.bulk_send_and_notify,
        event_id,
        payload,
        events_service.get_event,
        events_service.get_email_template,
        attendees_service.get_attendee,
        checkin_service.get_ticket_image,
        attendees_service.mark_ticket_delivered,
    )
    return {"message": "Bulk email sending started"}


@bulk_email_router.post("/ticketQRs", status_code=status.HTTP_202_ACCEPTED)
def bulk_generate_ticket_qrs(
    event_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    payload: list[uuid.UUID] = Body(...),
) -> dict:
    check_event_exists(event_id)
    for attendee_id in payload:
        check_attendee_exists(event_id, attendee_id)

    if not EventStreamManager().mark_job_active(event_id, "ticket_qr"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ticket QR generation is already in progress for this event",
        )

    background_tasks.add_task(ticket_service.generate_qrs_and_notify, event_id, payload)
    return {"message": "Ticket QR generation started"}
