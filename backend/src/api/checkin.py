import uuid

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response

from schema.rest import (
    ManualCheckinRequest,
    PhoneCheckinRequest,
    ScanRequest,
    ScanResponse,
    ScanSuccessDetail,
    ScanErrorDetail,
)
from service import checkin as checkin_service

router_public = APIRouter(tags=["checkin"])
router_authed = APIRouter(tags=["checkin"])


@router_public.post("/events/{event_id}/scan")
def scan_ticket(event_id: uuid.UUID, payload: ScanRequest) -> ScanResponse:
    result = checkin_service.scan_ticket(event_id, payload.ticket)
    if result["success"]:
        return ScanResponse(
            success=True,
            detail=ScanSuccessDetail(
                attendee_title=result["attendee_title"],
                attendee_name=result["attendee_name"],
            ),
        )
    return ScanResponse(
        success=False,
        detail=ScanErrorDetail(reason=result["reason"]),
    )


@router_authed.post("/events/{event_id}/checkin/phone")
def checkin_by_phone(
    event_id: uuid.UUID, payload: PhoneCheckinRequest
) -> ScanResponse:
    result = checkin_service.checkin_by_phone(
        event_id, payload.country_code, payload.phone_no
    )
    if result["success"]:
        return ScanResponse(
            success=True,
            detail=ScanSuccessDetail(
                attendee_title=result["attendee_title"],
                attendee_name=result["attendee_name"],
            ),
        )
    return ScanResponse(
        success=False,
        detail=ScanErrorDetail(reason=result["reason"]),
    )


@router_authed.post("/events/{event_id}/checkin/manual")
def checkin_manual(
    event_id: uuid.UUID, payload: ManualCheckinRequest
) -> ScanResponse:
    result = checkin_service.checkin_manual(event_id, payload.attendee_id)
    if result["success"]:
        return ScanResponse(
            success=True,
            detail=ScanSuccessDetail(
                attendee_title=result["attendee_title"],
                attendee_name=result["attendee_name"],
            ),
        )
    return ScanResponse(
        success=False,
        detail=ScanErrorDetail(reason=result["reason"]),
    )


@router_authed.get("/events/{event_id}/attendees/{attendee_id}/previews/ticket")
def preview_ticket(event_id: uuid.UUID, attendee_id: uuid.UUID):
    img_bytes = checkin_service.get_ticket_image(event_id, attendee_id)
    if img_bytes is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    return Response(content=img_bytes, media_type="image/png")
