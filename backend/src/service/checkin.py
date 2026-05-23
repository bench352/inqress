import datetime
import logging
import uuid

import phonenumbers
from sqlalchemy import select, insert

from schema.enum import EventMode
from schema.orm import Attendee, AttendanceLog, Event
from schema.rest import CheckinResponse, CheckinSuccessDetail, CheckinErrorDetail
from service.db import get_engine
from service.ticket import verify_ticket

logger = logging.getLogger(__name__)


def _lookup_event(event_id: uuid.UUID) -> Event | None:
    with get_engine().begin() as conn:
        result = conn.execute(select(Event).where(Event.id == event_id))
        return result.scalars().first()


def _lookup_attendee(event_id: uuid.UUID, attendee_id: uuid.UUID) -> Attendee | None:
    with get_engine().begin() as conn:
        result = conn.execute(
            select(Attendee).where(
                Attendee.id == attendee_id, Attendee.event_id == event_id
            )
        )
        return result.scalars().first()


def _is_already_checked_in(event_id: uuid.UUID, attendee_id: uuid.UUID) -> bool:
    with get_engine().begin() as conn:
        result = conn.execute(
            select(AttendanceLog).where(
                AttendanceLog.event_id == event_id,
                AttendanceLog.attendee_id == attendee_id,
            )
        )
        return result.scalars().first() is not None


def _create_attendance_log(
    event_id: uuid.UUID,
    attendee_id: uuid.UUID,
    method: str,
    is_test: int,
) -> None:
    with get_engine().begin() as conn:
        conn.execute(
            insert(AttendanceLog).values(
                id=uuid.uuid4(),
                event_id=event_id,
                attendee_id=attendee_id,
                checked_in_at=datetime.datetime.now().isoformat(),
                method=method,
                device_info=None,
                is_test=is_test,
            )
        )


def scan_ticket(event_id: uuid.UUID, ticket_token: str) -> CheckinResponse:
    try:
        payload = verify_ticket(ticket_token)
    except ValueError as e:
        return CheckinResponse(
            success=False,
            detail=CheckinErrorDetail(reason=str(e)),
        )

    if payload.event_id != event_id:
        return CheckinResponse(
            success=False,
            detail=CheckinErrorDetail(reason="Ticket is for a different event"),
        )

    event = _lookup_event(event_id)
    if event is None:
        return CheckinResponse(
            success=False, detail=CheckinErrorDetail(reason="Event not found")
        )

    if event.mode == EventMode.DISABLED:
        return CheckinResponse(
            success=False,
            detail=CheckinErrorDetail(reason="Event check-in is not active"),
        )

    attendee = _lookup_attendee(event_id, payload.attendee_id)
    if attendee is None:
        return CheckinResponse(
            success=False, detail=CheckinErrorDetail(reason="Attendee not found")
        )

    if _is_already_checked_in(event_id, payload.attendee_id):
        return CheckinResponse(
            success=False, detail=CheckinErrorDetail(reason="Already checked in")
        )

    is_test = 1 if event.mode == EventMode.TEST else 0
    _create_attendance_log(event_id, payload.attendee_id, "scan", is_test)

    return CheckinResponse(
        success=True,
        detail=CheckinSuccessDetail(
            title=attendee.title,
            name=attendee.name,
        ),
    )


def checkin_by_phone(
    event_id: uuid.UUID, country_code: str, phone_no: str
) -> CheckinResponse:
    event = _lookup_event(event_id)
    if event is None:
        return CheckinResponse(
            success=False, detail=CheckinErrorDetail(reason="Event not found")
        )

    if event.mode == EventMode.DISABLED:
        return CheckinResponse(
            success=False,
            detail=CheckinErrorDetail(reason="Event check-in is not active"),
        )

    full_number = f"{country_code}{phone_no}"
    try:
        parsed = phonenumbers.parse(full_number)
    except phonenumbers.NumberParseException:
        return CheckinResponse(
            success=False,
            detail=CheckinErrorDetail(
                reason="No attendee found with this phone number"
            ),
        )

    if not phonenumbers.is_valid_number(parsed):
        return CheckinResponse(
            success=False,
            detail=CheckinErrorDetail(
                reason="No attendee found with this phone number"
            ),
        )

    normalized_phone = f"{parsed.country_code}{parsed.national_number}"

    with get_engine().begin() as conn:
        result = conn.execute(
            select(Attendee).where(
                Attendee.event_id == event_id,
                Attendee.phone == normalized_phone,
            )
        )
        attendee = result.scalars().first()

    if attendee is None:
        return CheckinResponse(
            success=False,
            detail=CheckinErrorDetail(
                reason="No attendee found with this phone number"
            ),
        )

    if _is_already_checked_in(event_id, attendee.id):
        return CheckinResponse(
            success=False, detail=CheckinErrorDetail(reason="Already checked in")
        )

    is_test = 1 if event.mode == EventMode.TEST else 0
    _create_attendance_log(event_id, attendee.id, "phone", is_test)

    return CheckinResponse(
        success=True,
        detail=CheckinSuccessDetail(
            title=attendee.title,
            name=attendee.name,
        ),
    )


def checkin_manual(event_id: uuid.UUID, attendee_id: uuid.UUID) -> CheckinResponse:
    event = _lookup_event(event_id)
    if event is None:
        return CheckinResponse(
            success=False, detail=CheckinErrorDetail(reason="Event not found")
        )

    if event.mode == EventMode.DISABLED:
        return CheckinResponse(
            success=False,
            detail=CheckinErrorDetail(reason="Event check-in is not active"),
        )

    attendee = _lookup_attendee(event_id, attendee_id)
    if attendee is None:
        return CheckinResponse(
            success=False, detail=CheckinErrorDetail(reason="Attendee not found")
        )

    if _is_already_checked_in(event_id, attendee_id):
        return CheckinResponse(
            success=False, detail=CheckinErrorDetail(reason="Already checked in")
        )

    is_test = 1 if event.mode == EventMode.TEST else 0
    _create_attendance_log(event_id, attendee_id, "manual", is_test)

    return CheckinResponse(
        success=True,
        detail=CheckinSuccessDetail(
            title=attendee.title,
            name=attendee.name,
        ),
    )


def get_ticket_image(event_id: uuid.UUID, attendee_id: uuid.UUID) -> bytes | None:
    with get_engine().begin() as conn:
        result = conn.execute(
            select(Attendee.ticket_img).where(
                Attendee.id == attendee_id, Attendee.event_id == event_id
            )
        )
        return result.scalars().first()
