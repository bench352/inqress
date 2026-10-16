import logging
import queue
import secrets
import uuid
from collections.abc import Iterable

import fastapi
import fastapi.sse

import schema.orm
import schema.rest
import service.auth
import service.checkin
import service.companion_stream
import service.db
import service.events
import service.uploads

logger = logging.getLogger(__name__)
manager = service.companion_stream.companion_stream_manager

router = fastapi.APIRouter(tags=["Companion"])


def _companion_dep(event_id: uuid.UUID, request: fastapi.Request) -> None:
    service.auth.verify_companion_for_event(event_id, request)


@router.post("/companion/session", status_code=fastapi.status.HTTP_200_OK)
def create_companion_session(
    payload: schema.rest.CompanionSessionRequest,
    response: fastapi.Response,
) -> schema.rest.CompanionSessionResponse:
    """Public exchange: given eventId + token, set HttpOnly companion cookie if valid."""
    with service.db.get_session() as db:
        row = (
            db.query(
                schema.orm.Event.id,
                schema.orm.Event.name,
                schema.orm.Event.companion_token,
            )
            .filter(schema.orm.Event.id == payload.event_id)
            .first()
        )
        if row is None:
            raise fastapi.HTTPException(status_code=404, detail="Event not found")

        event_id, name, current_token = row
        if not current_token or not secrets.compare_digest(
            payload.token, current_token
        ):
            raise fastapi.HTTPException(status_code=401, detail="Invalid pairing token")

    # Valid: set cookie (raw token value)
    service.auth._set_companion_cookie(response, payload.token)
    return schema.rest.CompanionSessionResponse(event_id=event_id, name=name)


@router.get(
    "/events/{event_id}/companion/streams",
    response_class=fastapi.sse.EventSourceResponse,
)
def companion_streams(
    event_id: uuid.UUID,
    request: fastapi.Request,
    mode: str = fastapi.Query(..., pattern="^(kiosk|scanner)$"),
) -> Iterable[fastapi.sse.ServerSentEvent]:
    # Verify companion auth (raises 401, no login redirect)
    service.auth.verify_companion_for_event(event_id, request)

    q: queue.Queue = manager.subscribe(event_id, mode)
    try:
        while True:
            try:
                event = q.get(timeout=15)
                yield fastapi.sse.ServerSentEvent(data=event.model_dump(by_alias=True))
            except queue.Empty:
                # heartbeat
                yield fastapi.sse.ServerSentEvent(data="{}")
                # Re-verify token on heartbeat (catches rotate)
                try:
                    service.auth.verify_companion_for_event(event_id, request)
                except fastapi.HTTPException:
                    break
    except GeneratorExit:
        pass
    finally:
        manager.unsubscribe(event_id, q)


@router.get("/events/{event_id}/companion/boothImage")
def get_booth_image_companion(
    event_id: uuid.UUID, _auth: None = fastapi.Depends(_companion_dep)
) -> fastapi.responses.Response:
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


@router.get("/events/{event_id}/companion/accentColor")
def get_accent_color_companion(
    event_id: uuid.UUID, _auth: None = fastapi.Depends(_companion_dep)
) -> schema.rest.AccentColorResponse:
    color = service.events.get_accent_color(event_id)
    if color is None:
        raise fastapi.HTTPException(404, "Event not found")
    return schema.rest.AccentColorResponse(color_code=color)


@router.get("/events/{event_id}/companion/phones/countryCodes")
def get_country_codes_companion(
    event_id: uuid.UUID, _auth: None = fastapi.Depends(_companion_dep)
) -> schema.rest.CountryCodesResponse:
    # reuse, even though name has phones
    return service.events.get_unique_country_codes(event_id)


@router.get("/events/{event_id}/companion/display")
def get_companion_display(event_id: uuid.UUID, request: fastapi.Request) -> dict:
    service.auth.verify_companion_for_event(event_id, request)
    ev = service.events.get_event(event_id)
    if ev is None:
        raise fastapi.HTTPException(404, "Event not found")
    msg = service.events.get_kiosk_message(event_id) or (
        "Welcome. Check in with your phone number or email if your QR code cannot be scanned."
    )
    return {
        "eventName": ev.name,
        "kioskMessage": msg,
        "mode": ev.mode,
    }


@router.post("/events/{event_id}/companion/scan")
def scan_ticket_companion(
    event_id: uuid.UUID,
    payload: schema.rest.ScanRequest,
    _auth: None = fastapi.Depends(_companion_dep),
) -> schema.rest.CheckinResponse:
    return service.checkin.scan_ticket(event_id, payload.ticket)


@router.post("/events/{event_id}/companion/checkin/phone")
def checkin_by_phone_companion(
    event_id: uuid.UUID,
    payload: schema.rest.PhoneCheckinRequest,
    _auth: None = fastapi.Depends(_companion_dep),
) -> schema.rest.CheckinResponse:
    return service.checkin.checkin_by_phone(
        event_id, payload.country_code, payload.phone_no
    )


@router.post("/events/{event_id}/companion/checkin/email")
def checkin_by_email_companion(
    event_id: uuid.UUID,
    payload: schema.rest.EmailCheckinRequest,
    _auth: None = fastapi.Depends(_companion_dep),
) -> schema.rest.CheckinResponse:
    return service.checkin.checkin_by_email(event_id, payload.email)


@router.post("/events/{event_id}/companion/checkin/manual")
def checkin_manual_companion(
    event_id: uuid.UUID,
    payload: schema.rest.ManualCheckinRequest,
    _auth: None = fastapi.Depends(_companion_dep),
) -> schema.rest.CheckinResponse:
    return service.checkin.checkin_manual(event_id, payload.participant_id)
