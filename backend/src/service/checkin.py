import datetime
import logging
import uuid
from typing import NamedTuple

from fastapi import HTTPException
from sqlalchemy import insert, select

from schema.enum import EventMode
from schema.orm import Attendee, AttendanceLog, Event
from schema.rest import (
    AssistedCheckinResponse,
    CheckinErrorDetail,
    CheckinResponse,
    CheckinSuccessDetail,
)
from schema.sse import (
    AttendanceNotificationData,
    ControlCommandData,
    SseEvent,
    SseEventType,
    SseType,
)
from service.db import get_session
from service.event_stream import EventStreamManager
from service.booth_stream import BoothStreamManager
from service.ticket import verify_ticket

logger = logging.getLogger(__name__)


def _emit_attendance(
    event_id: uuid.UUID,
    attendee_id: uuid.UUID,
    title: str,
    name: str,
    method: str,
    checked_in_at: str,
) -> None:
    EventStreamManager().send(
        event_id,
        SseEvent[AttendanceNotificationData](
            event_type=SseEventType.ATTENDANCE,
            type=SseType.NOTIFICATION,
            data=AttendanceNotificationData(
                attendee_id=str(attendee_id),
                title=title,
                name=name,
                check_in_method=method,
                check_in_at=checked_in_at,
            ),
        ),
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
            detail=CheckinErrorDetail(reason="Ticket is not for this event."),
        )

    with get_session() as session:
        event = (
            session.execute(select(Event).where(Event.id == event_id)).scalars().first()
        )
        if event is None:
            return CheckinResponse(
                success=False, detail=CheckinErrorDetail(reason="Event not found")
            )

        if event.mode == EventMode.DISABLED:
            return CheckinResponse(
                success=False,
                detail=CheckinErrorDetail(reason="Event check-in is not active"),
            )

        attendee = (
            session.execute(
                select(Attendee).where(
                    Attendee.id == payload.attendee_id,
                    Attendee.event_id == event_id,
                )
            )
            .scalars()
            .first()
        )
        if attendee is None:
            return CheckinResponse(
                success=False,
                detail=CheckinErrorDetail(
                    reason="You are not registered for this event."
                ),
            )

        already_checked_in = (
            session.execute(
                select(AttendanceLog).where(
                    AttendanceLog.event_id == event_id,
                    AttendanceLog.attendee_id == payload.attendee_id,
                )
            )
            .scalars()
            .first()
            is not None
        )
        if already_checked_in:
            return CheckinResponse(
                success=False, detail=CheckinErrorDetail(reason="Already checked in.")
            )

        is_test = 1 if event.mode == EventMode.TEST else 0
        checked_in_at = datetime.datetime.now().isoformat()
        session.execute(
            insert(AttendanceLog).values(
                id=uuid.uuid4(),
                event_id=event_id,
                attendee_id=payload.attendee_id,
                checked_in_at=checked_in_at,
                method="scan",
                device_info=None,
                is_test=is_test,
            )
        )

        _emit_attendance(
            event_id,
            payload.attendee_id,
            attendee.title,
            attendee.name,
            "scan",
            checked_in_at,
        )

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
    if not country_code or not phone_no:
        return CheckinResponse(
            success=False,
            detail=CheckinErrorDetail(
                reason="No attendee found with this phone number"
            ),
        )

    with get_session() as session:
        event = (
            session.execute(select(Event).where(Event.id == event_id)).scalars().first()
        )
        if event is None:
            return CheckinResponse(
                success=False, detail=CheckinErrorDetail(reason="Event not found")
            )

        if event.mode == EventMode.DISABLED:
            return CheckinResponse(
                success=False,
                detail=CheckinErrorDetail(reason="Event check-in is not active"),
            )

        attendee = (
            session.execute(
                select(Attendee).where(
                    Attendee.event_id == event_id,
                    Attendee.country_code == country_code,
                    Attendee.phone == phone_no,
                )
            )
            .scalars()
            .first()
        )
        if attendee is None:
            return CheckinResponse(
                success=False,
                detail=CheckinErrorDetail(
                    reason="No attendee found with this phone number"
                ),
            )

        already_checked_in = (
            session.execute(
                select(AttendanceLog).where(
                    AttendanceLog.event_id == event_id,
                    AttendanceLog.attendee_id == attendee.id,
                )
            )
            .scalars()
            .first()
            is not None
        )
        if already_checked_in:
            return CheckinResponse(
                success=False, detail=CheckinErrorDetail(reason="Already checked in")
            )

        is_test = 1 if event.mode == EventMode.TEST else 0
        checked_in_at = datetime.datetime.now().isoformat()
        session.execute(
            insert(AttendanceLog).values(
                id=uuid.uuid4(),
                event_id=event_id,
                attendee_id=attendee.id,
                checked_in_at=checked_in_at,
                method="phone",
                device_info=None,
                is_test=is_test,
            )
        )

        _emit_attendance(
            event_id,
            attendee.id,
            attendee.title,
            attendee.name,
            "phone",
            checked_in_at,
        )

        return CheckinResponse(
            success=True,
            detail=CheckinSuccessDetail(
                title=attendee.title,
                name=attendee.name,
            ),
        )


def checkin_manual(event_id: uuid.UUID, attendee_id: uuid.UUID) -> CheckinResponse:
    try:
        info = _lookup_attendee_for_checkin(event_id, attendee_id)
    except HTTPException as e:
        return CheckinResponse(
            success=False, detail=CheckinErrorDetail(reason=str(e.detail))
        )

    with get_session() as session:
        is_test = 1 if info.event_mode == EventMode.TEST else 0
        checked_in_at = datetime.datetime.now().isoformat()
        session.execute(
            insert(AttendanceLog).values(
                id=uuid.uuid4(),
                event_id=event_id,
                attendee_id=attendee_id,
                checked_in_at=checked_in_at,
                method="manual",
                device_info=None,
                is_test=is_test,
            )
        )

        _emit_attendance(
            event_id,
            attendee_id,
            info.attendee_title,
            info.attendee_name,
            "manual",
            checked_in_at,
        )

        return CheckinResponse(
            success=True,
            detail=CheckinSuccessDetail(
                title=info.attendee_title,
                name=info.attendee_name,
            ),
        )


def get_ticket_image(event_id: uuid.UUID, attendee_id: uuid.UUID) -> bytes | None:
    with get_session() as session:
        result = session.execute(
            select(Attendee.ticket_img).where(
                Attendee.id == attendee_id, Attendee.event_id == event_id
            )
        )
        return result.scalars().first()


class _CheckinInfo(NamedTuple):
    event_mode: EventMode
    attendee_id: uuid.UUID
    attendee_title: str
    attendee_name: str
    attendee_country_code: str
    attendee_phone: str
    attendee_email: str


def _lookup_attendee_for_checkin(
    event_id: uuid.UUID, attendee_id: uuid.UUID
) -> _CheckinInfo:
    with get_session() as session:
        event = (
            session.execute(select(Event).where(Event.id == event_id)).scalars().first()
        )
        if event is None:
            raise HTTPException(status_code=404, detail="Event not found")

        if event.mode == EventMode.DISABLED:
            raise HTTPException(status_code=422, detail="Event check-in is not active")

        attendee = (
            session.execute(
                select(Attendee).where(
                    Attendee.id == attendee_id,
                    Attendee.event_id == event_id,
                )
            )
            .scalars()
            .first()
        )
        if attendee is None:
            raise HTTPException(status_code=404, detail="Attendee not found")

        already_checked_in = (
            session.execute(
                select(AttendanceLog).where(
                    AttendanceLog.event_id == event_id,
                    AttendanceLog.attendee_id == attendee_id,
                )
            )
            .scalars()
            .first()
            is not None
        )
        if already_checked_in:
            raise HTTPException(
                status_code=422, detail="Attendee is already checked in"
            )

        return _CheckinInfo(
            event_mode=event.mode,
            attendee_id=attendee.id,
            attendee_title=attendee.title,
            attendee_name=attendee.name,
            attendee_country_code=attendee.country_code,
            attendee_phone=attendee.phone,
            attendee_email=attendee.email,
        )


def checkin_assisted(
    event_id: uuid.UUID, attendee_id: uuid.UUID
) -> AssistedCheckinResponse:
    info = _lookup_attendee_for_checkin(event_id, attendee_id)

    booth_manager = BoothStreamManager()
    sent = booth_manager.send(
        event_id,
        SseEvent[ControlCommandData](
            event_type=SseEventType.CONTROL,
            type=SseType.COMMAND,
            data=ControlCommandData(
                command="SHOW_CONFIRMATION",
                params={
                    "attendeeId": str(info.attendee_id),
                    "title": info.attendee_title,
                    "name": info.attendee_name,
                    "countryCode": info.attendee_country_code,
                    "phone": info.attendee_phone,
                    "email": info.attendee_email,
                },
            ),
        ),
    )

    if not sent:
        raise HTTPException(
            status_code=422,
            detail="No check-in booth is currently connected for this event",
        )

    return AssistedCheckinResponse(success=True)
