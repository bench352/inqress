import datetime
import logging
import uuid

import fastapi
from sqlalchemy import insert, select

import schema.enum
import schema.orm
import schema.rest
import schema.service
import schema.sse
import service.booth_stream
import service.db
import service.event_stream
import service.ticket

logger = logging.getLogger(__name__)


def _emit_attendance(
    event_id: uuid.UUID,
    participant_id: uuid.UUID,
    title: str | None,
    name: str,
    method: str,
    checked_in_at: str,
) -> None:
    service.event_stream.event_stream_manager.send(
        event_id,
        schema.sse.SseEvent[schema.sse.AttendanceNotificationData](
            event_type=schema.sse.SseEventType.ATTENDANCE,
            type=schema.sse.SseType.NOTIFICATION,
            data=schema.sse.AttendanceNotificationData(
                participant_id=str(participant_id),
                title=title,
                name=name,
                check_in_method=method,
                check_in_at=checked_in_at,
            ),
        ),
    )


def scan_ticket(event_id: uuid.UUID, ticket_token: str) -> schema.rest.CheckinResponse:
    try:
        payload = service.ticket.verify_ticket(ticket_token)
    except ValueError as e:
        return schema.rest.CheckinResponse(
            success=False,
            detail=schema.rest.CheckinErrorDetail(reason=str(e)),
        )

    if payload.event_id != event_id:
        return schema.rest.CheckinResponse(
            success=False,
            detail=schema.rest.CheckinErrorDetail(
                reason="Ticket is not for this event."
            ),
        )

    with service.db.get_session() as session:
        event = (
            session.execute(
                select(schema.orm.Event).where(schema.orm.Event.id == event_id)
            )
            .scalars()
            .first()
        )
        if event is None:
            return schema.rest.CheckinResponse(
                success=False,
                detail=schema.rest.CheckinErrorDetail(reason="Event not found"),
            )

        if event.mode == schema.enum.EventMode.DISABLED:
            return schema.rest.CheckinResponse(
                success=False,
                detail=schema.rest.CheckinErrorDetail(
                    reason="Event check-in is not active"
                ),
            )

        participant = (
            session.execute(
                select(schema.orm.Participant).where(
                    schema.orm.Participant.id == payload.participant_id,
                    schema.orm.Participant.event_id == event_id,
                )
            )
            .scalars()
            .first()
        )
        if participant is None:
            return schema.rest.CheckinResponse(
                success=False,
                detail=schema.rest.CheckinErrorDetail(
                    reason="You are not registered for this event."
                ),
            )

        already_checked_in = (
            session.execute(
                select(schema.orm.AttendanceLog).where(
                    schema.orm.AttendanceLog.event_id == event_id,
                    schema.orm.AttendanceLog.participant_id == payload.participant_id,
                )
            )
            .scalars()
            .first()
            is not None
        )
        if already_checked_in:
            return schema.rest.CheckinResponse(
                success=False,
                detail=schema.rest.CheckinErrorDetail(reason="Already checked in."),
            )

        is_test = 1 if event.mode == schema.enum.EventMode.TEST else 0
        checked_in_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        session.execute(
            insert(schema.orm.AttendanceLog).values(
                id=uuid.uuid4(),
                event_id=event_id,
                participant_id=payload.participant_id,
                checked_in_at=checked_in_at,
                method="scan",
                device_info=None,
                is_test=is_test,
            )
        )

        _emit_attendance(
            event_id,
            payload.participant_id,
            participant.title,
            participant.name,
            "scan",
            checked_in_at,
        )

        return schema.rest.CheckinResponse(
            success=True,
            detail=schema.rest.CheckinSuccessDetail(
                title=participant.title,
                name=participant.name,
            ),
        )


def checkin_by_phone(
    event_id: uuid.UUID, country_code: str, phone_no: str
) -> schema.rest.CheckinResponse:
    if not country_code or not phone_no:
        return schema.rest.CheckinResponse(
            success=False,
            detail=schema.rest.CheckinErrorDetail(
                reason="No participant found with this phone number"
            ),
        )

    with service.db.get_session() as session:
        event = (
            session.execute(
                select(schema.orm.Event).where(schema.orm.Event.id == event_id)
            )
            .scalars()
            .first()
        )
        if event is None:
            return schema.rest.CheckinResponse(
                success=False,
                detail=schema.rest.CheckinErrorDetail(reason="Event not found"),
            )

        if event.mode == schema.enum.EventMode.DISABLED:
            return schema.rest.CheckinResponse(
                success=False,
                detail=schema.rest.CheckinErrorDetail(
                    reason="Event check-in is not active"
                ),
            )

        participants = (
            session.execute(
                select(schema.orm.Participant).where(
                    schema.orm.Participant.event_id == event_id,
                    schema.orm.Participant.country_code == country_code,
                    schema.orm.Participant.phone == phone_no,
                )
            )
            .scalars()
            .all()
        )
        if not participants:
            return schema.rest.CheckinResponse(
                success=False,
                detail=schema.rest.CheckinErrorDetail(
                    reason="No participant found with this phone number"
                ),
            )

        if len(participants) > 1:
            conflicting = [
                schema.rest.ParticipantResponse.model_validate(p) for p in participants
            ]
            return schema.rest.CheckinResponse(
                success=False,
                detail=schema.rest.CheckinConflictDetail(
                    reason="Multiple participants share the same phone number",
                    conflicting_participants=conflicting,
                ),
            )

        participant = participants[0]

        already_checked_in = (
            session.execute(
                select(schema.orm.AttendanceLog).where(
                    schema.orm.AttendanceLog.event_id == event_id,
                    schema.orm.AttendanceLog.participant_id == participant.id,
                )
            )
            .scalars()
            .first()
            is not None
        )
        if already_checked_in:
            return schema.rest.CheckinResponse(
                success=False,
                detail=schema.rest.CheckinErrorDetail(reason="Already checked in"),
            )

        is_test = 1 if event.mode == schema.enum.EventMode.TEST else 0
        checked_in_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        session.execute(
            insert(schema.orm.AttendanceLog).values(
                id=uuid.uuid4(),
                event_id=event_id,
                participant_id=participant.id,
                checked_in_at=checked_in_at,
                method="phone",
                device_info=None,
                is_test=is_test,
            )
        )

        _emit_attendance(
            event_id,
            participant.id,
            participant.title,
            participant.name,
            "phone",
            checked_in_at,
        )

        return schema.rest.CheckinResponse(
            success=True,
            detail=schema.rest.CheckinSuccessDetail(
                title=participant.title,
                name=participant.name,
            ),
        )


def checkin_manual(
    event_id: uuid.UUID, participant_id: uuid.UUID
) -> schema.rest.CheckinResponse:
    try:
        info = _lookup_participant_for_checkin(event_id, participant_id)
    except fastapi.HTTPException as e:
        return schema.rest.CheckinResponse(
            success=False, detail=schema.rest.CheckinErrorDetail(reason=str(e.detail))
        )

    with service.db.get_session() as session:
        is_test = 1 if info.event_mode == schema.enum.EventMode.TEST else 0
        checked_in_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        session.execute(
            insert(schema.orm.AttendanceLog).values(
                id=uuid.uuid4(),
                event_id=event_id,
                participant_id=participant_id,
                checked_in_at=checked_in_at,
                method="manual",
                device_info=None,
                is_test=is_test,
            )
        )

        _emit_attendance(
            event_id,
            participant_id,
            info.participant_title,
            info.participant_name,
            "manual",
            checked_in_at,
        )

        return schema.rest.CheckinResponse(
            success=True,
            detail=schema.rest.CheckinSuccessDetail(
                title=info.participant_title,
                name=info.participant_name,
            ),
        )


def get_ticket_image(event_id: uuid.UUID, participant_id: uuid.UUID) -> bytes | None:
    with service.db.get_session() as session:
        result = session.execute(
            select(schema.orm.Participant.ticket_img).where(
                schema.orm.Participant.id == participant_id,
                schema.orm.Participant.event_id == event_id,
            )
        )
        return result.scalars().first()


def _lookup_participant_for_checkin(
    event_id: uuid.UUID, participant_id: uuid.UUID
) -> schema.service.CheckinInfo:
    with service.db.get_session() as session:
        event = (
            session.execute(
                select(schema.orm.Event).where(schema.orm.Event.id == event_id)
            )
            .scalars()
            .first()
        )
        if event is None:
            raise fastapi.HTTPException(status_code=404, detail="Event not found")

        if event.mode == schema.enum.EventMode.DISABLED:
            raise fastapi.HTTPException(
                status_code=422, detail="Event check-in is not active"
            )

        participant = (
            session.execute(
                select(schema.orm.Participant).where(
                    schema.orm.Participant.id == participant_id,
                    schema.orm.Participant.event_id == event_id,
                )
            )
            .scalars()
            .first()
        )
        if participant is None:
            raise fastapi.HTTPException(status_code=404, detail="Participant not found")

        already_checked_in = (
            session.execute(
                select(schema.orm.AttendanceLog).where(
                    schema.orm.AttendanceLog.event_id == event_id,
                    schema.orm.AttendanceLog.participant_id == participant_id,
                )
            )
            .scalars()
            .first()
            is not None
        )
        if already_checked_in:
            raise fastapi.HTTPException(
                status_code=422, detail="Participant is already checked in"
            )

        return schema.service.CheckinInfo(
            event_mode=schema.enum.EventMode(event.mode),
            participant_id=participant.id,
            participant_title=participant.title,
            participant_name=participant.name,
            participant_country_code=participant.country_code,
            participant_phone=participant.phone,
            participant_email=participant.email,
        )


def checkin_assisted(
    event_id: uuid.UUID, participant_id: uuid.UUID
) -> schema.rest.AssistedCheckinResponse:
    info = _lookup_participant_for_checkin(event_id, participant_id)

    booth_manager = service.booth_stream.booth_stream_manager
    sent = booth_manager.send(
        event_id,
        schema.sse.SseEvent[schema.sse.ControlCommandData](
            event_type=schema.sse.SseEventType.CONTROL,
            type=schema.sse.SseType.COMMAND,
            data=schema.sse.ControlCommandData(
                command="SHOW_CONFIRMATION",
                params={
                    "participantId": str(info.participant_id),
                    "title": info.participant_title,
                    "name": info.participant_name,
                    "countryCode": info.participant_country_code,
                    "phone": info.participant_phone,
                    "email": info.participant_email,
                },
            ),
        ),
    )

    if not sent:
        raise fastapi.HTTPException(
            status_code=422,
            detail="No check-in booth is currently connected for this event",
        )

    return schema.rest.AssistedCheckinResponse(success=True)
