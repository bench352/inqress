import uuid

import fastapi
import fastapi.responses

import api.booth
import schema.rest
import schema.sse
import service.events

router = fastapi.APIRouter(prefix="/events", tags=["Events"])


@router.get("")
def list_events() -> list[schema.rest.EventResponse]:
    return service.events.list_events()


@router.post("", status_code=fastapi.status.HTTP_201_CREATED)
def create_event(payload: schema.rest.EventCreate) -> schema.rest.EventResponse:
    return service.events.create_event(payload)


@router.get("/{event_id}")
def get_event(event_id: uuid.UUID) -> schema.rest.EventResponse:
    event = service.events.get_event(event_id)
    if event is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return event


@router.put("/{event_id}")
def update_event(
    event_id: uuid.UUID, payload: schema.rest.EventPut
) -> schema.rest.EventResponse:
    event = service.events.update_event(event_id, payload)
    if event is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return event


@router.put("/{event_id}/mode")
def update_event_mode(
    event_id: uuid.UUID, payload: schema.rest.EventModeUpdate
) -> schema.rest.EventResponse:
    event = service.events.update_event_mode(event_id, payload.mode)
    if event is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    api.booth.booth_manager.send(
        event_id,
        schema.sse.SseEvent[schema.sse.ChangeModeData](
            event_type=schema.sse.SseEventType.CHANGE_MODE,
            type=schema.sse.SseType.COMMAND,
            data=schema.sse.ChangeModeData(value=payload.mode),
        ),
        sticky=True,
    )
    return event


@router.delete("/{event_id}")
def delete_event(event_id: uuid.UUID) -> schema.rest.EventResponse:
    deleted_event = service.events.delete_event(event_id)
    if deleted_event is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return deleted_event


@router.get("/{event_id}/emailTemplate")
def get_email_template(event_id: uuid.UUID) -> schema.rest.EmailTemplateResponse:
    result = service.events.get_email_template(event_id)
    if result is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return result


@router.put("/{event_id}/emailTemplate", status_code=fastapi.status.HTTP_204_NO_CONTENT)
def update_email_template(
    event_id: uuid.UUID, payload: schema.rest.EmailTemplateRequest
) -> fastapi.responses.Response:
    updated = service.events.update_email_template(event_id, payload.text)
    if not updated:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return fastapi.responses.Response(status_code=fastapi.status.HTTP_204_NO_CONTENT)


@router.get("/{event_id}/boothImage")
def get_booth_image(event_id: uuid.UUID) -> fastapi.responses.Response:
    result = service.events.get_booth_image(event_id)
    if result is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND,
            detail="Booth image not found",
        )
    image_bytes, content_type = result
    return fastapi.responses.Response(content=image_bytes, media_type=content_type)


@router.post("/{event_id}/boothImage", status_code=fastapi.status.HTTP_204_NO_CONTENT)
def upload_booth_image(
    event_id: uuid.UUID, file: fastapi.UploadFile = fastapi.File(...)
) -> fastapi.responses.Response:
    updated = service.events.set_booth_image(
        event_id, file.file.read(), file.content_type or "image/png"
    )
    if not updated:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    api.booth.booth_manager.send(
        event_id,
        schema.sse.SseEvent[schema.sse.ControlCommandData](
            event_type=schema.sse.SseEventType.CONTROL,
            type=schema.sse.SseType.COMMAND,
            data=schema.sse.ControlCommandData(command="REFRESH"),
        ),
    )
    return fastapi.responses.Response(status_code=fastapi.status.HTTP_204_NO_CONTENT)


@router.get("/{event_id}/accentColor")
def get_accent_color(event_id: uuid.UUID) -> schema.rest.AccentColorResponse:
    color = service.events.get_accent_color(event_id)
    if color is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return schema.rest.AccentColorResponse(color_code=color)


@router.put("/{event_id}/accentColor", status_code=fastapi.status.HTTP_204_NO_CONTENT)
def set_accent_color(
    event_id: uuid.UUID, payload: schema.rest.AccentColorRequest
) -> fastapi.responses.Response:
    updated = service.events.set_accent_color(event_id, payload.color_code)
    if not updated:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    api.booth.booth_manager.send(
        event_id,
        schema.sse.SseEvent[schema.sse.ControlCommandData](
            event_type=schema.sse.SseEventType.CONTROL,
            type=schema.sse.SseType.COMMAND,
            data=schema.sse.ControlCommandData(command="REFRESH"),
        ),
    )
    return fastapi.responses.Response(status_code=fastapi.status.HTTP_204_NO_CONTENT)
