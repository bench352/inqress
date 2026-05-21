import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, status

from schema.rest import (
    AttendeeCreate,
    AttendeeResponse,
    BulkCreateResponse,
    BulkDeleteResponse,
)
from service import attendees as attendees_service
from service import events as events_service
from service.ticket import generate_ticket_images

router = APIRouter(prefix="/events/{event_id}/attendees", tags=["attendees"])


def _check_event(event_id: uuid.UUID) -> None:
    if events_service.get_event(event_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
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
