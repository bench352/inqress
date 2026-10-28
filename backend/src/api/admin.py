import logging
import uuid

import fastapi
import fastapi.responses

import schema.rest
import schema.sse
import service.companion_stream
import service.events

logger = logging.getLogger(__name__)

comp_mgr = service.companion_stream.companion_stream_manager
router = fastapi.APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/events/{event_id}/companion/token")
def get_companion_token(event_id: uuid.UUID) -> schema.rest.CompanionTokenResponse:
    token = service.events.get_companion_token(event_id)
    if token is None:
        raise fastapi.HTTPException(404, "Event not found")
    return schema.rest.CompanionTokenResponse(token=token)


@router.post("/events/{event_id}/companion/rotate")
def rotate_companion_token(event_id: uuid.UUID) -> schema.rest.CompanionTokenResponse:
    new_token = service.events.rotate_companion_token(event_id)
    if new_token is None:
        raise fastapi.HTTPException(404, "Event not found")
    # Close connected companion streams immediately; the heartbeat re-verify
    # in the stream loop is the backstop.
    comp_mgr.close_all(event_id)
    return schema.rest.CompanionTokenResponse(token=new_token)


@router.get("/events/{event_id}/kiosk/message")
def get_kiosk_message(event_id: uuid.UUID) -> schema.rest.KioskMessageResponse:
    msg = service.events.get_kiosk_message(event_id) or ""
    return schema.rest.KioskMessageResponse(message=msg)


@router.put("/events/{event_id}/kiosk/message")
def set_kiosk_message(
    event_id: uuid.UUID, payload: schema.rest.KioskMessageRequest
) -> schema.rest.KioskMessageResponse:
    if len(payload.message) > 280:
        raise fastapi.HTTPException(400, "Message too long (max 280 chars)")
    ok = service.events.set_kiosk_message(event_id, payload.message)
    if not ok:
        raise fastapi.HTTPException(404, "Event not found")
    # The kiosk shows this message on its welcome screen.
    comp_mgr.send(
        event_id,
        schema.sse.SseEvent[schema.sse.ControlCommandData](
            event_type=schema.sse.SseEventType.CONTROL,
            type=schema.sse.SseType.COMMAND,
            data=schema.sse.ControlCommandData(command="REFRESH", params={}),
        ),
        modes={"kiosk"},
    )
    return schema.rest.KioskMessageResponse(message=payload.message)


@router.post("/events/{event_id}/companion/refresh")
def refresh_companions(event_id: uuid.UUID) -> dict:
    # Send refresh command to all
    comp_mgr.send(
        event_id,
        schema.sse.SseEvent[schema.sse.ControlCommandData](
            event_type=schema.sse.SseEventType.CONTROL,
            type=schema.sse.SseType.COMMAND,
            data=schema.sse.ControlCommandData(command="REFRESH", params={}),
        ),
        modes={"kiosk"},
    )
    return {"ok": True}


@router.post("/events/{event_id}/companion/close-kiosks")
def close_kiosks(event_id: uuid.UUID) -> dict:
    sent = comp_mgr.send(
        event_id,
        schema.sse.SseEvent[schema.sse.ControlCommandData](
            event_type=schema.sse.SseEventType.CONTROL,
            type=schema.sse.SseType.COMMAND,
            data=schema.sse.ControlCommandData(command="CLOSE", params={}),
        ),
        modes={"kiosk"},
    )
    return {"ok": True, "sent": sent}
