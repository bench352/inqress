import uuid

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response

from schema.rest import (
    EmailTemplateRequest,
    EmailTemplateResponse,
    EventCreate,
    EventModeUpdate,
    EventPut,
    EventResponse,
)
from service import events as events_service

router = APIRouter(prefix="/events", tags=["events"])


@router.get("")
def list_events() -> list[EventResponse]:
    return events_service.list_events()


@router.post("", status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate) -> EventResponse:
    return events_service.create_event(payload)


@router.get("/{event_id}")
def get_event(event_id: uuid.UUID) -> EventResponse:
    event = events_service.get_event(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return event


@router.put("/{event_id}")
def update_event(event_id: uuid.UUID, payload: EventPut) -> EventResponse:
    event = events_service.update_event(event_id, payload)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return event


@router.put("/{event_id}/mode")
def update_event_mode(event_id: uuid.UUID, payload: EventModeUpdate) -> EventResponse:
    event = events_service.update_event_mode(event_id, payload.mode)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return event


@router.delete("/{event_id}")
def delete_event(event_id: uuid.UUID) -> EventResponse:
    deleted_event = events_service.delete_event(event_id)
    if deleted_event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return deleted_event


@router.get("/{event_id}/emailTemplate")
def get_email_template(event_id: uuid.UUID) -> EmailTemplateResponse:
    result = events_service.get_email_template(event_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return result


@router.put("/{event_id}/emailTemplate", status_code=status.HTTP_204_NO_CONTENT)
def update_email_template(
    event_id: uuid.UUID, payload: EmailTemplateRequest
) -> Response:
    updated = events_service.update_email_template(event_id, payload.text)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
