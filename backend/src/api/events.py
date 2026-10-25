import uuid

import fastapi
import fastapi.responses

import config
import schema.rest
import schema.sse
import service.companion_stream
import service.email
import service.events
import service.filenames
import service.settings
import service.ticket
import service.uploads

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
    # The kiosk renders the event name, so it needs to reload to pick it up.
    service.companion_stream.companion_stream_manager.send(
        event_id,
        schema.sse.SseEvent[schema.sse.ControlCommandData](
            event_type=schema.sse.SseEventType.CONTROL,
            type=schema.sse.SseType.COMMAND,
            data=schema.sse.ControlCommandData(command="REFRESH", params={}),
        ),
        modes={"kiosk"},
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
    service.companion_stream.companion_stream_manager.send(
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


@router.get("/{event_id}/emailSettings")
def get_email_settings(event_id: uuid.UUID) -> schema.rest.EmailSettingsResponse:
    result = service.settings.get_email_settings(event_id)
    if result is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    cfg = config.get_config()
    sender_name = service.email.resolve_sender_name(
        result.sender_name, cfg.app.organization_name
    )
    from_header, from_error = service.email.resolve_from(
        cfg.email_smtp.from_address, cfg.email_smtp.username, sender_name
    )
    return result.model_copy(
        update={"from_header": from_header, "from_error": from_error}
    )


@router.put("/{event_id}/emailSettings", status_code=fastapi.status.HTTP_204_NO_CONTENT)
def update_email_settings(
    event_id: uuid.UUID, payload: schema.rest.EmailSettingsRequest
) -> fastapi.responses.Response:
    updated = service.settings.update_email_settings(event_id, payload)
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
    image_bytes, _stored_type = result
    media_type = service.uploads.sniff_image_type(image_bytes)
    if media_type is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND,
            detail="Booth image not found",
        )
    return fastapi.responses.Response(
        content=image_bytes,
        media_type=media_type,
        headers={"X-Content-Type-Options": "nosniff"},
    )


@router.post("/{event_id}/boothImage", status_code=fastapi.status.HTTP_204_NO_CONTENT)
def upload_booth_image(
    event_id: uuid.UUID, file: fastapi.UploadFile = fastapi.File(...)
) -> fastapi.responses.Response:
    try:
        image_bytes = service.uploads.read_limited(
            file.file, service.uploads.max_upload_bytes()
        )
    except ValueError:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_413_CONTENT_TOO_LARGE,
            detail="File is too large",
        )
    media_type = service.uploads.sniff_image_type(image_bytes)
    if media_type is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_400_BAD_REQUEST,
            detail="Only PNG, JPEG, GIF, and WebP images are supported",
        )
    updated = service.events.set_booth_image(event_id, image_bytes, media_type)
    if not updated:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    import service.companion_stream as _cs

    _cs.companion_stream_manager.send(
        event_id,
        schema.sse.SseEvent[schema.sse.ControlCommandData](
            event_type=schema.sse.SseEventType.CONTROL,
            type=schema.sse.SseType.COMMAND,
            data=schema.sse.ControlCommandData(command="REFRESH", params={}),
        ),
        modes={"kiosk"},
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
    import service.companion_stream as _cs

    _cs.companion_stream_manager.send(
        event_id,
        schema.sse.SseEvent[schema.sse.ControlCommandData](
            event_type=schema.sse.SseEventType.CONTROL,
            type=schema.sse.SseType.COMMAND,
            data=schema.sse.ControlCommandData(command="REFRESH", params={}),
        ),
        modes={"kiosk"},
    )
    return fastapi.responses.Response(status_code=fastapi.status.HTTP_204_NO_CONTENT)


@router.get("/{event_id}/ticketImages")
def export_ticket_images(
    event_id: uuid.UUID,
) -> fastapi.responses.Response:
    try:
        zip_bytes = service.ticket.export_ticket_images_zip(event_id)
    except ValueError:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return fastapi.responses.Response(
        content=zip_bytes.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": service.filenames.attachment_disposition(
                "tickets.zip"
            )
        },
    )


@router.get("/{event_id}/participants/{participant_id}/ticketImage")
def export_single_ticket_image(
    event_id: uuid.UUID,
    participant_id: uuid.UUID,
) -> fastapi.responses.Response:
    try:
        img_bytes, safe_name = service.ticket.generate_single_ticket_image(
            event_id, participant_id
        )
    except ValueError as e:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    filename = f"{safe_name} - {participant_id}.png"
    return fastapi.responses.Response(
        content=img_bytes.getvalue(),
        media_type="image/png",
        headers={
            "Content-Disposition": service.filenames.attachment_disposition(filename)
        },
    )
