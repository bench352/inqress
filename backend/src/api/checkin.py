import uuid

import fastapi

import schema.rest
import service.checkin
import service.events

router_public = fastapi.APIRouter(tags=["Check-in"])
router_authed = fastapi.APIRouter(tags=["Check-in"])


@router_public.post("/events/{event_id}/scan")
def scan_ticket(
    event_id: uuid.UUID, payload: schema.rest.ScanRequest
) -> schema.rest.CheckinResponse:
    return service.checkin.scan_ticket(event_id, payload.ticket)


@router_authed.post("/events/{event_id}/checkin/phone")
def checkin_by_phone(
    event_id: uuid.UUID, payload: schema.rest.PhoneCheckinRequest
) -> schema.rest.CheckinResponse:
    return service.checkin.checkin_by_phone(
        event_id, payload.country_code, payload.phone_no
    )


@router_authed.post("/events/{event_id}/checkin/manual")
def checkin_manual(
    event_id: uuid.UUID, payload: schema.rest.ManualCheckinRequest
) -> schema.rest.CheckinResponse:
    return service.checkin.checkin_manual(event_id, payload.participant_id)


@router_authed.post("/events/{event_id}/checkin/assisted")
def checkin_assisted(
    event_id: uuid.UUID, payload: schema.rest.AssistedCheckinRequest
) -> schema.rest.AssistedCheckinResponse:
    return service.checkin.checkin_assisted(event_id, payload.participant_id)


@router_authed.get("/events/{event_id}/phones/countryCodes")
def get_country_codes(event_id: uuid.UUID) -> schema.rest.CountryCodesResponse:
    return service.events.get_unique_country_codes(event_id)
