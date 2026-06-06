import datetime
import logging
import math
import time
import uuid

import phonenumbers
import rapidfuzz
from sqlalchemy import delete, insert, select, update

import config
import schema.enum
import schema.orm
import schema.rest
import schema.sse
import service.db
import service.event_stream
import service.ticket

logger = logging.getLogger(__name__)

_FUZZY_THRESHOLD = 85


def _parse_phone(raw_phone: str | None, default_region: str) -> tuple[str, str] | None:
    if not raw_phone:
        return None
    try:
        parsed = phonenumbers.parse(raw_phone, default_region)
    except phonenumbers.NumberParseException:
        return None
    if not phonenumbers.is_valid_number(parsed):
        return None
    phone = str(parsed.national_number)
    country_code = f"+{parsed.country_code}"
    return country_code, phone


def _names_match(
    name1: str, name2: str, name_match_mode: schema.enum.NameMatchMode
) -> bool:
    n1 = name1.strip().lower()
    n2 = name2.strip().lower()
    if n1 == n2:
        return True
    if name_match_mode is schema.enum.NameMatchMode.FUZZY:
        score = rapidfuzz.fuzz.token_sort_ratio(n1, n2)
        if score >= _FUZZY_THRESHOLD:
            return True
    return False


ExistingParticipant = schema.orm.Participant | schema.rest.ParticipantResponse


def _is_duplicate(
    new_p: schema.rest.ParticipantCreate,
    existing: ExistingParticipant,
    name_match_mode: schema.enum.NameMatchMode,
    default_region: str,
) -> bool:
    if not _names_match(new_p.name, existing.name, name_match_mode):
        return False

    new_has_email = bool(new_p.email)
    existing_has_email = bool(existing.email)
    new_has_phone = bool(new_p.raw_phone)
    existing_has_phone = bool(existing.raw_phone)

    if new_has_email and existing_has_email:
        assert new_p.email is not None and existing.email is not None
        if new_p.email.strip().lower() != existing.email.strip().lower():
            return False
    if new_has_phone and existing_has_phone:
        new_parsed = _parse_phone(new_p.raw_phone, default_region)
        existing_parsed = _parse_phone(existing.raw_phone, default_region)
        if new_parsed and existing_parsed:
            if new_parsed[1] != existing_parsed[1]:
                return False

    return True


def _apply_smart_merge(
    existing: ExistingParticipant,
    new_p: schema.rest.ParticipantCreate,
    default_region: str,
) -> dict:
    title = new_p.title if new_p.title is not None else existing.title
    name = new_p.name if new_p.name is not None else existing.name
    email = (
        new_p.email
        if new_p.email is not None and new_p.email.strip()
        else existing.email
    )
    raw_phone = (
        new_p.raw_phone
        if new_p.raw_phone is not None and new_p.raw_phone.strip()
        else existing.raw_phone
    )

    phone_info = _parse_phone(raw_phone, default_region)
    if phone_info:
        country_code, phone = phone_info
    else:
        country_code = None
        phone = None

    return {
        "title": title,
        "name": name,
        "email": email,
        "raw_phone": raw_phone,
        "country_code": country_code,
        "phone": phone,
    }


def _apply_overwrite(new_p: schema.rest.ParticipantCreate, default_region: str) -> dict:
    title = new_p.title
    name = new_p.name
    email = new_p.email
    raw_phone = new_p.raw_phone

    phone_info = _parse_phone(raw_phone, default_region)
    if phone_info:
        country_code, phone = phone_info
    else:
        country_code = None
        phone = None

    return {
        "title": title,
        "name": name,
        "email": email,
        "raw_phone": raw_phone,
        "country_code": country_code,
        "phone": phone,
    }


def _compute_phone_values(raw_phone: str | None, default_region: str) -> dict:
    phone_info = _parse_phone(raw_phone, default_region)
    if phone_info:
        country_code, phone = phone_info
    else:
        country_code = None
        phone = None
    return {"country_code": country_code, "phone": phone}


def list_participants(event_id: uuid.UUID) -> list[schema.rest.ParticipantResponse]:
    with service.db.get_session() as session:
        result = session.execute(
            select(schema.orm.Participant)
            .where(schema.orm.Participant.event_id == event_id)
            .order_by(schema.orm.Participant.name)
        )
        return [
            schema.rest.ParticipantResponse.model_validate(row)
            for row in result.scalars().all()
        ]


def get_participant(
    event_id: uuid.UUID, participant_id: uuid.UUID
) -> schema.rest.ParticipantResponse | None:
    with service.db.get_session() as session:
        result = session.execute(
            select(schema.orm.Participant).where(
                schema.orm.Participant.id == participant_id,
                schema.orm.Participant.event_id == event_id,
            )
        )
        row = result.scalars().first()
        return schema.rest.ParticipantResponse.model_validate(row) if row else None


def update_participant(
    event_id: uuid.UUID,
    participant_id: uuid.UUID,
    payload: schema.rest.ParticipantPut,
) -> schema.rest.ParticipantResponse | None:
    cfg = config.get_config()
    default_region = cfg.app.default_country_code

    phone_values = _compute_phone_values(payload.raw_phone, default_region)

    with service.db.get_session() as session:
        result = session.execute(
            update(schema.orm.Participant)
            .where(
                schema.orm.Participant.id == participant_id,
                schema.orm.Participant.event_id == event_id,
            )
            .values(
                title=payload.title,
                name=payload.name,
                email=payload.email,
                raw_phone=payload.raw_phone,
                **phone_values,
            )
            .returning(schema.orm.Participant)
        )
        row = result.scalars().first()
        return schema.rest.ParticipantResponse.model_validate(row) if row else None


def mark_ticket_delivered(event_id: uuid.UUID, participant_id: uuid.UUID) -> bool:
    with service.db.get_session() as session:
        result = session.execute(
            update(schema.orm.Participant)
            .where(
                schema.orm.Participant.id == participant_id,
                schema.orm.Participant.event_id == event_id,
            )
            .values(is_ticket_delivered=True)
        )
        return result.rowcount > 0  # type: ignore[attr-defined]


def bulk_delete(
    event_id: uuid.UUID, ids: list[uuid.UUID]
) -> schema.rest.BulkDeleteResponse:
    if not ids:
        return schema.rest.BulkDeleteResponse(num_deleted=0)
    with service.db.get_session() as session:
        result = session.execute(
            delete(schema.orm.Participant).where(
                schema.orm.Participant.event_id == event_id,
                schema.orm.Participant.id.in_(ids),
            )
        )
        return schema.rest.BulkDeleteResponse(num_deleted=result.rowcount)  # type: ignore[attr-defined]


def bulk_create_and_notify(
    event_id: uuid.UUID,
    payload: list[schema.rest.ParticipantCreate],
    strategy: schema.enum.DuplicateStrategy = schema.enum.DuplicateStrategy.SKIP,
    name_match_mode: schema.enum.NameMatchMode = schema.enum.NameMatchMode.EXACT,
) -> None:
    manager = service.event_stream.event_stream_manager
    cfg = config.get_config()
    default_region = cfg.app.default_country_code

    created: list[schema.rest.ParticipantResponse] = []
    skipped: list[schema.rest.ParticipantCreate] = []
    overwritten: list[schema.rest.ParticipantResponse] = []
    merged: list[schema.rest.ParticipantResponse] = []
    errors: list[schema.rest.BulkCreateError] = []
    num_total = len(payload)
    start_time = time.monotonic()

    def _send_progress():
        num_completed = (
            len(created) + len(skipped) + len(overwritten) + len(merged) + len(errors)
        )
        est = None
        if num_completed > 0:
            elapsed = time.monotonic() - start_time
            est_sec = (elapsed / num_completed) * (num_total - num_completed)
            est = max(1, math.ceil(est_sec / 60))
        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.CreateParticipantProgressData](
                event_type=schema.sse.SseEventType.CREATE_PARTICIPANT,
                type=schema.sse.SseType.PROGRESS,
                data=schema.sse.CreateParticipantProgressData(
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
        with service.db.get_session() as session:
            for i, p in enumerate(payload):
                _send_progress()

                if not p.name or not p.name.strip():
                    err = schema.rest.BulkCreateError(
                        participant=p, reason="Name is required"
                    )
                    errors.append(err)
                    continue

                existing_db = (
                    session.execute(
                        select(schema.orm.Participant).where(
                            schema.orm.Participant.event_id == event_id
                        )
                    )
                    .scalars()
                    .all()
                )
                all_existing = list(existing_db) + [
                    r for r in created + overwritten + merged
                ]

                dup = None
                for ex in all_existing:
                    if _is_duplicate(p, ex, name_match_mode, default_region):
                        dup = ex
                        break

                if dup is not None:
                    if strategy is schema.enum.DuplicateStrategy.SKIP:
                        skipped.append(p)
                        continue
                    elif strategy is schema.enum.DuplicateStrategy.OVERWRITE:
                        values = _apply_overwrite(p, default_region)
                        db_result = session.execute(
                            update(schema.orm.Participant)
                            .where(schema.orm.Participant.id == dup.id)
                            .values(**values)
                            .returning(schema.orm.Participant)
                        )
                        row = db_result.scalars().one()
                        overwritten.append(
                            schema.rest.ParticipantResponse.model_validate(row)
                        )
                        continue
                    elif strategy is schema.enum.DuplicateStrategy.SMART_MERGE:
                        values = _apply_smart_merge(dup, p, default_region)
                        db_result = session.execute(
                            update(schema.orm.Participant)
                            .where(schema.orm.Participant.id == dup.id)
                            .values(**values)
                            .returning(schema.orm.Participant)
                        )
                        row = db_result.scalars().one()
                        merged.append(
                            schema.rest.ParticipantResponse.model_validate(row)
                        )
                        continue

                phone_info = _parse_phone(p.raw_phone, default_region)
                if p.raw_phone and phone_info is None:
                    err = schema.rest.BulkCreateError(
                        participant=p, reason="Invalid phone number"
                    )
                    errors.append(err)
                    continue

                country_code, phone = phone_info if phone_info else (None, None)

                try:
                    participant_id = uuid.uuid4()
                    token_str = service.ticket.generate_ticket(event_id, participant_id)
                    db_result = session.execute(
                        insert(schema.orm.Participant)
                        .values(
                            id=participant_id,
                            event_id=event_id,
                            title=p.title,
                            name=p.name,
                            email=p.email,
                            raw_phone=p.raw_phone,
                            country_code=country_code,
                            phone=phone,
                            ticket_token=token_str,
                        )
                        .returning(schema.orm.Participant)
                    )
                    created.append(
                        schema.rest.ParticipantResponse.model_validate(
                            db_result.scalars().one()
                        )
                    )
                except Exception as e:
                    logger.exception("Failed to create participant")
                    err = schema.rest.BulkCreateError(
                        participant=p, reason=f"Failed to create: {e}"
                    )
                    errors.append(err)

        result = schema.rest.BulkCreateResponse(
            created=created,
            skipped=skipped,
            overwritten=overwritten,
            merged=merged,
            errors=errors,
        )

        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.CreateParticipantProgressData](
                event_type=schema.sse.SseEventType.CREATE_PARTICIPANT,
                type=schema.sse.SseType.PROGRESS,
                data=schema.sse.CreateParticipantProgressData(
                    in_progress=False,
                    num_completed=num_total,
                    num_total=num_total,
                    num_errors=len(errors),
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
            schema.sse.SseEvent[schema.sse.CreateParticipantSuccessData](
                event_type=schema.sse.SseEventType.CREATE_PARTICIPANT,
                type=schema.sse.SseType.NOTIFICATION,
                data=schema.sse.CreateParticipantSuccessData(
                    expire_on=expire_on,
                    result_id=str(result_id),
                ),
            ),
        )

        if result.created:
            try:
                service.ticket.generate_qrs_task(
                    event_id, [a.id for a in result.created]
                )
            except Exception:
                logger.exception("Ticket generation failed for event %s", event_id)

    except Exception:
        logger.exception("Bulk create participants task failed for event %s", event_id)

        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.CreateParticipantErrorData](
                event_type=schema.sse.SseEventType.CREATE_PARTICIPANT,
                type=schema.sse.SseType.NOTIFICATION,
                data=schema.sse.CreateParticipantErrorData(detail="Import task failed"),
            ),
        )

    finally:
        manager.mark_job_done(event_id, "import")
