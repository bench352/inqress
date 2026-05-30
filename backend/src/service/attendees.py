import datetime
import logging
import math
import time
import uuid

import phonenumbers
from sqlalchemy import delete, insert, select, update

from env import ServerSettings
from schema.orm import Attendee
from schema.rest import (
    AttendeeCreate,
    AttendeeResponse,
    BulkCreateError,
    BulkCreateResponse,
    BulkDeleteResponse,
)
from schema.sse import (
    CreateAttendeeErrorData,
    CreateAttendeeProgressData,
    CreateAttendeeSuccessData,
    SseEvent,
    SseEventType,
    SseType,
)
from service.db import get_session
from service.event_stream import EventStreamManager
from service import ticket

logger = logging.getLogger(__name__)


def list_attendees(event_id: uuid.UUID) -> list[AttendeeResponse]:
    with get_session() as session:
        result = session.execute(select(Attendee).where(Attendee.event_id == event_id))
        return [AttendeeResponse.model_validate(row) for row in result.scalars().all()]


def get_attendee(
    event_id: uuid.UUID, attendee_id: uuid.UUID
) -> AttendeeResponse | None:
    with get_session() as session:
        result = session.execute(
            select(Attendee).where(
                Attendee.id == attendee_id, Attendee.event_id == event_id
            )
        )
        row = result.scalars().first()
        return AttendeeResponse.model_validate(row) if row else None


def bulk_create(
    event_id: uuid.UUID, payloads: list[AttendeeCreate]
) -> BulkCreateResponse:
    if not payloads:
        return BulkCreateResponse(created=[], skipped=[], errors=[])

    settings = ServerSettings()
    default_region = settings.default_country_code

    parsed_entries: list[dict] = []
    all_emails: set[str] = set()
    all_phones: set[str] = set()

    for p in payloads:
        all_emails.add(p.email)
        try:
            parsed = phonenumbers.parse(p.raw_phone, default_region)
        except phonenumbers.NumberParseException:
            parsed_entries.append({"payload": p, "error": "Invalid phone number"})
            continue

        if not phonenumbers.is_valid_number(parsed):
            parsed_entries.append({"payload": p, "error": "Invalid phone number"})
            continue

        phone = str(parsed.national_number)
        country_code = f"+{parsed.country_code}"

        parsed_entries.append(
            {
                "payload": p,
                "country_code": country_code,
                "phone": phone,
                "parsed": parsed,
            }
        )
        all_phones.add(phone)

    with get_session() as session:
        existing_rows = (
            session.execute(
                select(Attendee).where(
                    Attendee.event_id == event_id,
                    (Attendee.email.in_(all_emails)) | (Attendee.phone.in_(all_phones)),
                )
            )
            .scalars()
            .all()
        )

        existing_emails = {row.email for row in existing_rows}
        existing_phones = {row.phone for row in existing_rows}

        created: list[AttendeeResponse] = []
        skipped: list[AttendeeCreate] = []
        errors: list[BulkCreateError] = []

        for entry in parsed_entries:
            p = entry["payload"]

            if "error" in entry:
                errors.append(BulkCreateError(attendee=p, reason=entry["error"]))
                continue

            if p.email in existing_emails or entry["phone"] in existing_phones:
                skipped.append(p)
                continue

            try:
                attendee_id = uuid.uuid4()
                token = ticket.generate_ticket(event_id, attendee_id)

                result = session.execute(
                    insert(Attendee)
                    .values(
                        id=attendee_id,
                        event_id=event_id,
                        title=p.title,
                        name=p.name,
                        email=p.email,
                        raw_phone=p.raw_phone,
                        country_code=entry["country_code"],
                        phone=entry["phone"],
                        ticket_token=token,
                    )
                    .returning(Attendee)
                )
                created.append(AttendeeResponse.model_validate(result.scalars().one()))
                existing_emails.add(p.email)
                existing_phones.add(entry["phone"])
            except Exception as e:
                logger.exception("Failed to create attendee")
                errors.append(
                    BulkCreateError(attendee=p, reason=f"Failed to create: {e}")
                )

    return BulkCreateResponse(created=created, skipped=skipped, errors=errors)


def mark_ticket_delivered(event_id: uuid.UUID, attendee_id: uuid.UUID) -> bool:
    with get_session() as session:
        result = session.execute(
            update(Attendee)
            .where(Attendee.id == attendee_id, Attendee.event_id == event_id)
            .values(is_ticket_delivered=True)
        )
        return result.rowcount > 0


def bulk_delete(event_id: uuid.UUID, ids: list[uuid.UUID]) -> BulkDeleteResponse:
    if not ids:
        return BulkDeleteResponse(num_deleted=0)
    with get_session() as session:
        result = session.execute(
            delete(Attendee).where(Attendee.event_id == event_id, Attendee.id.in_(ids))
        )
        return BulkDeleteResponse(num_deleted=result.rowcount)


def bulk_create_task(
    event_id: uuid.UUID,
    payload: list[AttendeeCreate],
) -> BulkCreateResponse:
    manager = EventStreamManager()
    settings = ServerSettings()
    default_region = settings.default_country_code

    created: list[AttendeeResponse] = []
    skipped: list[AttendeeCreate] = []
    errors: list[BulkCreateError] = []
    num_total = len(payload)
    start_time = time.monotonic()

    def _send_progress():
        num_completed = len(created) + len(skipped) + len(errors)
        est = None
        if num_completed > 0:
            elapsed = time.monotonic() - start_time
            est_sec = (elapsed / num_completed) * (num_total - num_completed)
            est = max(1, math.ceil(est_sec / 60))
        manager.send(
            event_id,
            SseEvent[CreateAttendeeProgressData](
                event_type=SseEventType.CREATE_ATTENDEE,
                type=SseType.PROGRESS,
                data=CreateAttendeeProgressData(
                    in_progress=True,
                    num_completed=num_completed,
                    num_total=num_total,
                    est_remain_min=est,
                    num_errors=len(errors),
                ),
            ),
            sticky=True,
        )

    try:
        for i, p in enumerate(payload):
            _send_progress()

            try:
                parsed = phonenumbers.parse(p.raw_phone, default_region)
            except phonenumbers.NumberParseException:
                err = BulkCreateError(attendee=p, reason="Invalid phone number")
                errors.append(err)
                continue

            if not phonenumbers.is_valid_number(parsed):
                err = BulkCreateError(attendee=p, reason="Invalid phone number")
                errors.append(err)
                continue

            country_code = f"+{parsed.country_code}"
            phone = str(parsed.national_number)

            with get_session() as session:
                existing = (
                    session.execute(
                        select(Attendee).where(
                            Attendee.event_id == event_id,
                            (Attendee.email == p.email) | (Attendee.phone == phone),
                        )
                    )
                    .scalars()
                    .first()
                )

                if existing:
                    skipped.append(p)
                else:
                    try:
                        attendee_id = uuid.uuid4()
                        token_str = ticket.generate_ticket(event_id, attendee_id)
                        result = session.execute(
                            insert(Attendee)
                            .values(
                                id=attendee_id,
                                event_id=event_id,
                                title=p.title,
                                name=p.name,
                                email=p.email,
                                raw_phone=p.raw_phone,
                                country_code=country_code,
                                phone=phone,
                                ticket_token=token_str,
                            )
                            .returning(Attendee)
                        )
                        created.append(
                            AttendeeResponse.model_validate(result.scalars().one())
                        )
                    except Exception as e:
                        logger.exception("Failed to create attendee")
                        err = BulkCreateError(
                            attendee=p, reason=f"Failed to create: {e}"
                        )
                        errors.append(err)

        result = BulkCreateResponse(created=created, skipped=skipped, errors=errors)
        return result

    except Exception as e:
        logger.exception("Bulk create attendees task failed for event %s", event_id)

        manager.send(
            event_id,
            SseEvent[CreateAttendeeProgressData](
                event_type=SseEventType.CREATE_ATTENDEE,
                type=SseType.PROGRESS,
                data=CreateAttendeeProgressData(
                    in_progress=False,
                    num_completed=len(created) + len(skipped) + len(errors),
                    num_total=num_total,
                    num_errors=len(errors),
                ),
            ),
            sticky=True,
        )

        manager.send(
            event_id,
            SseEvent[CreateAttendeeErrorData](
                event_type=SseEventType.CREATE_ATTENDEE,
                type=SseType.NOTIFICATION,
                data=CreateAttendeeErrorData(detail=str(e)),
            ),
        )

        raise


def bulk_create_and_notify(event_id: uuid.UUID, payload: list[AttendeeCreate]) -> None:
    manager = EventStreamManager()
    try:
        result = bulk_create_task(event_id, payload)

        manager.send(
            event_id,
            SseEvent[CreateAttendeeProgressData](
                event_type=SseEventType.CREATE_ATTENDEE,
                type=SseType.PROGRESS,
                data=CreateAttendeeProgressData(
                    in_progress=False,
                    num_completed=len(payload),
                    num_total=len(payload),
                    num_errors=len(result.errors),
                ),
            ),
            sticky=True,
        )

        result_id = uuid.uuid4()
        manager.store_result(result_id, result)
        expire_on = (
            datetime.datetime.now() + datetime.timedelta(minutes=30)
        ).isoformat()

        manager.send(
            event_id,
            SseEvent[CreateAttendeeSuccessData](
                event_type=SseEventType.CREATE_ATTENDEE,
                type=SseType.NOTIFICATION,
                data=CreateAttendeeSuccessData(
                    expire_on=expire_on,
                    result_id=str(result_id),
                ),
            ),
        )

        if result.created:
            try:
                ticket.generate_qrs_task(event_id, [a.id for a in result.created])
            except Exception:
                logger.exception("Ticket generation failed for event %s", event_id)

    finally:
        manager.mark_job_done(event_id, "import")
