import datetime
import logging
import uuid

from sqlalchemy import select, insert

from schema.enum import EventMode
from schema.orm import Attendee, AttendanceLog, Event
from schema.rest import CheckinResponse, CheckinSuccessDetail, CheckinErrorDetail
from service.db import get_session
from service.ticket import verify_ticket

logger = logging.getLogger(__name__)


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

    with get_session() as session:
        event = session.execute(
            select(Event).where(Event.id == event_id)
        ).scalars().first()
        if event is None:
            return CheckinResponse(
                success=False, detail=CheckinErrorDetail(reason="Event not found")
            )

        if event.mode == EventMode.DISABLED:
            return CheckinResponse(
                success=False,
                detail=CheckinErrorDetail(reason="Event check-in is not active"),
            )

        attendee = session.execute(
            select(Attendee).where(
                Attendee.id == payload.attendee_id,
                Attendee.event_id == event_id,
            )
        ).scalars().first()
        if attendee is None:
            return CheckinResponse(
                success=False, detail=CheckinErrorDetail(reason="Attendee not found")
            )

        already_checked_in = session.execute(
            select(AttendanceLog).where(
                AttendanceLog.event_id == event_id,
                AttendanceLog.attendee_id == payload.attendee_id,
            )
        ).scalars().first() is not None
        if already_checked_in:
            return CheckinResponse(
                success=False, detail=CheckinErrorDetail(reason="Already checked in")
            )

        is_test = 1 if event.mode == EventMode.TEST else 0
        session.execute(
            insert(AttendanceLog).values(
                id=uuid.uuid4(),
                event_id=event_id,
                attendee_id=payload.attendee_id,
                checked_in_at=datetime.datetime.now().isoformat(),
                method="scan",
                device_info=None,
                is_test=is_test,
            )
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
        event = session.execute(
            select(Event).where(Event.id == event_id)
        ).scalars().first()
        if event is None:
            return CheckinResponse(
                success=False, detail=CheckinErrorDetail(reason="Event not found")
            )

        if event.mode == EventMode.DISABLED:
            return CheckinResponse(
                success=False,
                detail=CheckinErrorDetail(reason="Event check-in is not active"),
            )

        attendee = session.execute(
            select(Attendee).where(
                Attendee.event_id == event_id,
                Attendee.country_code == country_code,
                Attendee.phone == phone_no,
            )
        ).scalars().first()
        if attendee is None:
            return CheckinResponse(
                success=False,
                detail=CheckinErrorDetail(
                    reason="No attendee found with this phone number"
                ),
            )

        already_checked_in = session.execute(
            select(AttendanceLog).where(
                AttendanceLog.event_id == event_id,
                AttendanceLog.attendee_id == attendee.id,
            )
        ).scalars().first() is not None
        if already_checked_in:
            return CheckinResponse(
                success=False, detail=CheckinErrorDetail(reason="Already checked in")
            )

        is_test = 1 if event.mode == EventMode.TEST else 0
        session.execute(
            insert(AttendanceLog).values(
                id=uuid.uuid4(),
                event_id=event_id,
                attendee_id=attendee.id,
                checked_in_at=datetime.datetime.now().isoformat(),
                method="phone",
                device_info=None,
                is_test=is_test,
            )
        )

        return CheckinResponse(
            success=True,
            detail=CheckinSuccessDetail(
                title=attendee.title,
                name=attendee.name,
            ),
        )


def checkin_manual(event_id: uuid.UUID, attendee_id: uuid.UUID) -> CheckinResponse:
    with get_session() as session:
        event = session.execute(
            select(Event).where(Event.id == event_id)
        ).scalars().first()
        if event is None:
            return CheckinResponse(
                success=False, detail=CheckinErrorDetail(reason="Event not found")
            )

        if event.mode == EventMode.DISABLED:
            return CheckinResponse(
                success=False,
                detail=CheckinErrorDetail(reason="Event check-in is not active"),
            )

        attendee = session.execute(
            select(Attendee).where(
                Attendee.id == attendee_id,
                Attendee.event_id == event_id,
            )
        ).scalars().first()
        if attendee is None:
            return CheckinResponse(
                success=False, detail=CheckinErrorDetail(reason="Attendee not found")
            )

        already_checked_in = session.execute(
            select(AttendanceLog).where(
                AttendanceLog.event_id == event_id,
                AttendanceLog.attendee_id == attendee_id,
            )
        ).scalars().first() is not None
        if already_checked_in:
            return CheckinResponse(
                success=False, detail=CheckinErrorDetail(reason="Already checked in")
            )

        is_test = 1 if event.mode == EventMode.TEST else 0
        session.execute(
            insert(AttendanceLog).values(
                id=uuid.uuid4(),
                event_id=event_id,
                attendee_id=attendee_id,
                checked_in_at=datetime.datetime.now().isoformat(),
                method="manual",
                device_info=None,
                is_test=is_test,
            )
        )

        return CheckinResponse(
            success=True,
            detail=CheckinSuccessDetail(
                title=attendee.title,
                name=attendee.name,
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
