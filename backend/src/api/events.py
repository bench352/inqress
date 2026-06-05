import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import Response

from schema.rest import (
    AccentColorRequest,
    AccentColorResponse,
    EmailTemplateRequest,
    EmailTemplateResponse,
    EventCreate,
    EventModeUpdate,
    EventPut,
    EventResponse,
)
from schema.sse import (
    ChangeModeData,
    ControlCommandData,
    SseEvent,
    SseEventType,
    SseType,
)
from service import events as events_service
from api.booth import booth_manager

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
    booth_manager.send(
        event_id,
        SseEvent[ChangeModeData](
            event_type=SseEventType.CHANGE_MODE,
            type=SseType.COMMAND,
            data=ChangeModeData(value=payload.mode),
        ),
        sticky=True,
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


@router.get("/{event_id}/boothImage")
def get_booth_image(event_id: uuid.UUID) -> Response:
    result = events_service.get_booth_image(event_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Booth image not found"
        )
    image_bytes, content_type = result
    return Response(content=image_bytes, media_type=content_type)


@router.post("/{event_id}/boothImage", status_code=status.HTTP_204_NO_CONTENT)
def upload_booth_image(event_id: uuid.UUID, file: UploadFile = File(...)) -> Response:
    updated = events_service.set_booth_image(
        event_id, file.file.read(), file.content_type or "image/png"
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    booth_manager.send(
        event_id,
        SseEvent[ControlCommandData](
            event_type=SseEventType.CONTROL,
            type=SseType.COMMAND,
            data=ControlCommandData(command="REFRESH"),
        ),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{event_id}/accentColor")
def get_accent_color(event_id: uuid.UUID) -> AccentColorResponse:
    color = events_service.get_accent_color(event_id)
    if color is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return AccentColorResponse(color_code=color)


@router.put("/{event_id}/accentColor", status_code=status.HTTP_204_NO_CONTENT)
def set_accent_color(event_id: uuid.UUID, payload: AccentColorRequest) -> Response:
    updated = events_service.set_accent_color(event_id, payload.color_code)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    booth_manager.send(
        event_id,
        SseEvent[ControlCommandData](
            event_type=SseEventType.CONTROL,
            type=SseType.COMMAND,
            data=ControlCommandData(command="REFRESH"),
        ),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
