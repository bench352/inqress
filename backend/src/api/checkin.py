import uuid

from fastapi import APIRouter

from schema.rest import (
    CheckinResponse,
    ManualCheckinRequest,
    PhoneCheckinRequest,
    ScanRequest,
)
from service import checkin as checkin_service

router_public = APIRouter(tags=["checkin"])
router_authed = APIRouter(tags=["checkin"])


@router_public.post("/events/{event_id}/scan")
def scan_ticket(event_id: uuid.UUID, payload: ScanRequest) -> CheckinResponse:
    return checkin_service.scan_ticket(event_id, payload.ticket)


@router_authed.post("/events/{event_id}/checkin/phone")
def checkin_by_phone(
    event_id: uuid.UUID, payload: PhoneCheckinRequest
) -> CheckinResponse:
    return checkin_service.checkin_by_phone(
        event_id, payload.country_code, payload.phone_no
    )


@router_authed.post("/events/{event_id}/checkin/manual")
def checkin_manual(
    event_id: uuid.UUID, payload: ManualCheckinRequest
) -> CheckinResponse:
    return checkin_service.checkin_manual(event_id, payload.attendee_id)


@router_authed.get("/events/{event_id}/phones/countryCodes")
def get_country_codes(event_id: uuid.UUID) -> list[str]:
    from service import events as events_service
    return events_service.get_unique_country_codes(event_id)
