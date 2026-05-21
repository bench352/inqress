from fastapi import APIRouter, HTTPException, status

from schema.rest import EventCreate, EventResponse, EventUpdate
from service import events as events_service

router = APIRouter(prefix="/events", tags=["events"])


@router.get("")
def list_events() -> list[EventResponse]:
    return events_service.list_events()


@router.post("", status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate) -> EventResponse:
    return events_service.create_event(payload)


@router.get("/{event_id}")
def get_event(event_id: str) -> EventResponse:
    event = events_service.get_event(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return event


@router.patch("/{event_id}")
def update_event(event_id: str, payload: EventUpdate) -> EventResponse:
    event = events_service.update_event(event_id, payload)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return event


@router.delete("/{event_id}")
def delete_event(event_id: str) -> EventResponse:
    deleted_event = events_service.delete_event(event_id)
    if deleted_event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return deleted_event
