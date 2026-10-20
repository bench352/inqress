import datetime
import logging
import math
import time
import typing
import uuid
from dataclasses import dataclass

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


def _name_relation(
    name1: str, name2: str, name_match_mode: schema.enum.NameMatchMode
) -> str:
    n1 = name1.strip().lower()
    n2 = name2.strip().lower()
    if n1 == n2:
        return "exact"
    if name_match_mode is schema.enum.NameMatchMode.FUZZY:
        score = rapidfuzz.fuzz.token_sort_ratio(n1, n2)
        if score >= _FUZZY_THRESHOLD:
            return "fuzzy"
    return "none"


def _text(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    return value.strip()


ExistingParticipant = schema.orm.Participant | schema.rest.ParticipantResponse


@dataclass
class _Match:
    participant: ExistingParticipant
    replace_name: bool


def _contact_keys(
    new_p: schema.rest.ParticipantCreate,
    existing: ExistingParticipant,
    default_region: str,
) -> tuple[str | None, str | None, str | None, str | None]:
    new_email = _text(new_p.email)
    existing_email = _text(existing.email)
    new_phone = _parse_phone(new_p.raw_phone, default_region)
    existing_phone = _parse_phone(existing.raw_phone, default_region)
    return (
        new_email.lower() if new_email else None,
        existing_email.lower() if existing_email else None,
        new_phone[1] if new_phone else None,
        existing_phone[1] if existing_phone else None,
    )


def _find_match(
    new_p: schema.rest.ParticipantCreate,
    existing_rows: list[ExistingParticipant],
    name_match_mode: schema.enum.NameMatchMode,
    default_region: str,
) -> _Match | None | str:
    sure: list[ExistingParticipant] = []
    name_only: list[ExistingParticipant] = []
    exact_unconfirmed: list[ExistingParticipant] = []
    exact_holders: list[ExistingParticipant] = []

    for existing in existing_rows:
        relation = _name_relation(new_p.name, existing.name, name_match_mode)
        if relation == "exact":
            exact_holders.append(existing)
        if relation == "none":
            continue

        new_email, existing_email, new_phone, existing_phone = _contact_keys(
            new_p, existing, default_region
        )
        emails_differ = (
            new_email is not None
            and existing_email is not None
            and new_email != existing_email
        )
        phones_differ = (
            new_phone is not None
            and existing_phone is not None
            and new_phone != existing_phone
        )
        if emails_differ or phones_differ:
            continue

        emails_match = (
            new_email is not None
            and existing_email is not None
            and new_email == existing_email
        )
        phones_match = (
            new_phone is not None
            and existing_phone is not None
            and new_phone == existing_phone
        )
        if emails_match or phones_match:
            sure.append(existing)
            continue
        if relation != "exact":
            continue
        if (
            new_email is None
            and existing_email is None
            and new_phone is None
            and existing_phone is None
        ):
            name_only.append(existing)
        else:
            exact_unconfirmed.append(existing)

    if len(sure) > 1:
        return "ambiguous"
    if len(sure) == 1:
        return _Match(
            participant=sure[0],
            replace_name=name_match_mode is schema.enum.NameMatchMode.FUZZY,
        )

    if len(exact_holders) == 1:
        holder = exact_holders[0]
        if holder in exact_unconfirmed or holder in name_only:
            return _Match(participant=holder, replace_name=False)
        return None

    if name_only or exact_unconfirmed:
        return "ambiguous"
    return None


def _apply_smart_merge(
    existing: ExistingParticipant,
    new_p: schema.rest.ParticipantCreate,
    default_region: str,
    replace_name: bool,
) -> dict:
    title = new_p.title if new_p.title is not None else existing.title
    name = new_p.name if replace_name else existing.name
    email = new_p.email if _text(existing.email) is None else existing.email
    if _text(new_p.email) is None:
        email = existing.email
    raw_phone = (
        new_p.raw_phone if _text(existing.raw_phone) is None else existing.raw_phone
    )
    if _text(new_p.raw_phone) is None:
        raw_phone = existing.raw_phone

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


def _apply_overwrite(
    new_p: schema.rest.ParticipantCreate,
    default_region: str,
    columns: set[str] | None = None,
) -> dict:
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

    values = {
        "title": title,
        "name": name,
        "email": email,
        "raw_phone": raw_phone,
        "country_code": country_code,
        "phone": phone,
    }
    if columns is not None:
        values = {key: value for key, value in values.items() if key in columns}
    return values


def _compute_phone_values(raw_phone: str | None, default_region: str) -> dict:
    phone_info = _parse_phone(raw_phone, default_region)
    if phone_info:
        country_code, phone = phone_info
    else:
        country_code = None
        phone = None
    return {"country_code": country_code, "phone": phone}


def _changed_values(existing: ExistingParticipant, values: dict) -> dict:
    """Only the fields whose stored value differs from the new one."""
    return {
        key: value for key, value in values.items() if getattr(existing, key) != value
    }


def _claim_differs(
    existing: ExistingParticipant,
    source_id: uuid.UUID | None,
    claimed_ids: set[uuid.UUID],
) -> bool:
    if source_id is None:
        return False
    return existing.id not in claimed_ids


def _write_match(
    session,
    existing: ExistingParticipant,
    values: dict,
    source_id: uuid.UUID | None,
    claimed_ids: set[uuid.UUID],
) -> bool:
    """Write the changed fields and take the claim. True when a field changed."""
    changed = _changed_values(existing, values)
    field_changed = bool(changed)
    if _claim_differs(existing, source_id, claimed_ids):
        changed["managed_by_data_source_id"] = source_id
    if changed:
        session.execute(
            update(schema.orm.Participant)
            .where(schema.orm.Participant.id == existing.id)
            .values(**changed)
        )
    return field_changed


def _reload(session, participant_id: uuid.UUID) -> schema.orm.Participant:
    return session.execute(
        select(schema.orm.Participant).where(
            schema.orm.Participant.id == participant_id
        )
    ).scalar_one()


def _managed_by(source: schema.orm.DataSource) -> schema.rest.ManagedBy:
    writes_details = source.tracking == schema.enum.DataSourceTracking.ROW or (
        source.strategy
        in (
            schema.enum.DuplicateStrategy.SMART_MERGE,
            schema.enum.DuplicateStrategy.OVERWRITE,
        )
    )
    return schema.rest.ManagedBy(
        id=source.id, name=source.name, writes_details=writes_details
    )


def _to_response(
    row: schema.orm.Participant, source: schema.orm.DataSource | None = None
) -> schema.rest.ParticipantResponse:
    response = schema.rest.ParticipantResponse.model_validate(row)
    if source is not None:
        response.managed_by = _managed_by(source)
    return response


def _managed_source(
    session, row: schema.orm.Participant
) -> schema.orm.DataSource | None:
    if row.managed_by_data_source_id is None:
        return None
    return session.get(schema.orm.DataSource, row.managed_by_data_source_id)


def list_participants(event_id: uuid.UUID) -> list[schema.rest.ParticipantResponse]:
    with service.db.get_session() as session:
        result = session.execute(
            select(schema.orm.Participant, schema.orm.DataSource)
            .outerjoin(
                schema.orm.DataSource,
                schema.orm.Participant.managed_by_data_source_id
                == schema.orm.DataSource.id,
            )
            .where(schema.orm.Participant.event_id == event_id)
            .order_by(schema.orm.Participant.name)
        )
        return [_to_response(row, source) for row, source in result.all()]


def get_participant(
    event_id: uuid.UUID, participant_id: uuid.UUID
) -> schema.rest.ParticipantResponse | None:
    with service.db.get_session() as session:
        result = session.execute(
            select(schema.orm.Participant, schema.orm.DataSource)
            .outerjoin(
                schema.orm.DataSource,
                schema.orm.Participant.managed_by_data_source_id
                == schema.orm.DataSource.id,
            )
            .where(
                schema.orm.Participant.id == participant_id,
                schema.orm.Participant.event_id == event_id,
            )
        )
        row = result.first()
        return _to_response(*row) if row else None


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
        return _to_response(row, _managed_source(session, row)) if row else None


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


def set_participant_activated(
    event_id: uuid.UUID, participant_id: uuid.UUID, activated: bool
) -> schema.rest.ParticipantResponse | None:
    with service.db.get_session() as session:
        result = session.execute(
            update(schema.orm.Participant)
            .where(
                schema.orm.Participant.id == participant_id,
                schema.orm.Participant.event_id == event_id,
            )
            .values(activated=activated)
            .returning(schema.orm.Participant)
        )
        row = result.scalars().first()
        return _to_response(row, _managed_source(session, row)) if row else None


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


def apply_participant_rows(
    event_id: uuid.UUID,
    payload: list[schema.rest.ParticipantCreate],
    strategy: schema.enum.DuplicateStrategy = schema.enum.DuplicateStrategy.SKIP,
    name_match_mode: schema.enum.NameMatchMode = schema.enum.NameMatchMode.EXACT,
    activate_new: bool = True,
    overwrite_columns: set[str] | None = None,
    on_row: typing.Callable[[str], None] | None = None,
    source_id: uuid.UUID | None = None,
) -> schema.rest.BulkCreateResponse:
    """Match rows against the event's participants and apply them. Sends nothing.

    overwrite_columns limits an Overwrite to those fields; None writes every field.
    on_row hears the outcome of each row: created, skipped, overwritten, merged,
    or error. source_id claims the matched participant for that data source; a
    row whose values already match is reported as skipped, never updated.
    """
    cfg = config.get_config()
    default_region = cfg.app.default_country_code

    created: list[schema.rest.ParticipantResponse] = []
    skipped: list[schema.rest.ParticipantCreate] = []
    overwritten: list[schema.rest.ParticipantResponse] = []
    merged: list[schema.rest.ParticipantResponse] = []
    errors: list[schema.rest.BulkCreateError] = []

    def _report(outcome: str) -> None:
        if on_row is not None:
            on_row(outcome)

    try:
        with service.db.get_session() as session:
            private_key = service.ticket.paseto_key(
                session.execute(
                    select(schema.orm.Event.paseto_private_key).where(
                        schema.orm.Event.id == event_id
                    )
                ).scalar_one()
            )
            claimed_ids: set[uuid.UUID] = set()
            if source_id is not None:
                claimed_ids = set(
                    session.execute(
                        select(schema.orm.Participant.id).where(
                            schema.orm.Participant.event_id == event_id,
                            schema.orm.Participant.managed_by_data_source_id
                            == source_id,
                        )
                    ).scalars()
                )
            for p in payload:
                if not p.name or not p.name.strip():
                    err = schema.rest.BulkCreateError(
                        participant=p, reason="Name is required"
                    )
                    errors.append(err)
                    _report("error")
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
                by_id: dict[uuid.UUID, ExistingParticipant] = {
                    row.id: row for row in existing_db
                }
                for updated in created + overwritten + merged:
                    by_id[updated.id] = updated

                found = _find_match(
                    p, list(by_id.values()), name_match_mode, default_region
                )
                if found == "ambiguous":
                    errors.append(
                        schema.rest.BulkCreateError(
                            participant=p,
                            reason="More than one participant has this name, and this row does not say which one.",
                        )
                    )
                    _report("error")
                    continue

                if found is not None:
                    assert isinstance(found, _Match)
                    dup = found.participant
                    if strategy is schema.enum.DuplicateStrategy.SKIP:
                        # A skip source owns nobody's details, but it still protects
                        # the people it matches from deletion (and being re-added).
                        if (
                            source_id is not None
                            and isinstance(dup, schema.orm.Participant)
                            and dup.managed_by_data_source_id is None
                        ):
                            session.execute(
                                update(schema.orm.Participant)
                                .where(schema.orm.Participant.id == dup.id)
                                .values(managed_by_data_source_id=source_id)
                            )
                        skipped.append(p)
                        _report("skipped")
                        continue
                    elif strategy is schema.enum.DuplicateStrategy.OVERWRITE:
                        values = _apply_overwrite(p, default_region, overwrite_columns)
                        field_changed = _write_match(
                            session, dup, values, source_id, claimed_ids
                        )
                        if field_changed:
                            row = _reload(session, dup.id)
                            overwritten.append(
                                _to_response(row, _managed_source(session, row))
                            )
                            _report("overwritten")
                        else:
                            skipped.append(p)
                            _report("skipped")
                        continue
                    elif strategy is schema.enum.DuplicateStrategy.SMART_MERGE:
                        values = _apply_smart_merge(
                            dup, p, default_region, found.replace_name
                        )
                        field_changed = _write_match(
                            session, dup, values, source_id, claimed_ids
                        )
                        if field_changed:
                            row = _reload(session, dup.id)
                            merged.append(
                                _to_response(row, _managed_source(session, row))
                            )
                            _report("merged")
                        else:
                            skipped.append(p)
                            _report("skipped")
                        continue

                phone_info = _parse_phone(p.raw_phone, default_region)
                if p.raw_phone and phone_info is None:
                    err = schema.rest.BulkCreateError(
                        participant=p, reason="Invalid phone number"
                    )
                    errors.append(err)
                    _report("error")
                    continue

                country_code, phone = phone_info if phone_info else (None, None)

                try:
                    participant_id = uuid.uuid4()
                    token_str = service.ticket.generate_ticket(
                        private_key, event_id, participant_id
                    )
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
                            activated=True if activate_new else None,
                            managed_by_data_source_id=source_id,
                        )
                        .returning(schema.orm.Participant)
                    )
                    created.append(
                        schema.rest.ParticipantResponse.model_validate(
                            db_result.scalars().one()
                        )
                    )
                    _report("created")
                except Exception as e:
                    logger.exception("Failed to create participant")
                    err = schema.rest.BulkCreateError(
                        participant=p, reason=f"Failed to create: {e}"
                    )
                    errors.append(err)
                    _report("error")

        return schema.rest.BulkCreateResponse(
            created=created,
            skipped=skipped,
            overwritten=overwritten,
            merged=merged,
            errors=errors,
        )

    except Exception:
        logger.exception("Applying participant rows failed for event %s", event_id)
        raise


def bulk_create_and_notify(
    event_id: uuid.UUID,
    payload: list[schema.rest.ParticipantCreate],
    strategy: schema.enum.DuplicateStrategy = schema.enum.DuplicateStrategy.SKIP,
    name_match_mode: schema.enum.NameMatchMode = schema.enum.NameMatchMode.EXACT,
    activate_new: bool = True,
) -> None:
    manager = service.event_stream.event_stream_manager
    num_total = len(payload)
    start_time = time.monotonic()
    counts = {"created": 0, "skipped": 0, "overwritten": 0, "merged": 0, "error": 0}

    def _send_progress(in_progress: bool) -> None:
        num_completed = sum(counts.values())
        est = None
        if in_progress and num_completed > 0:
            elapsed = time.monotonic() - start_time
            est_sec = (elapsed / num_completed) * (num_total - num_completed)
            est = max(1, math.ceil(est_sec / 60))
        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.CreateParticipantProgressData](
                event_type=schema.sse.SseEventType.CREATE_PARTICIPANT,
                type=schema.sse.SseType.PROGRESS,
                data=schema.sse.CreateParticipantProgressData(
                    in_progress=in_progress,
                    num_completed=num_completed,
                    num_total=num_total,
                    est_remain_min=est,
                    num_errors=counts["error"],
                ),
            ),
            sticky=True,
        )

    def _on_row(outcome: str) -> None:
        counts[outcome] += 1
        _send_progress(in_progress=True)

    try:
        _send_progress(in_progress=True)
        result = apply_participant_rows(
            event_id,
            payload,
            strategy,
            name_match_mode,
            activate_new,
            on_row=_on_row,
        )
        _send_progress(in_progress=False)

        result_id = uuid.uuid4()
        manager.store_result(result_id, result)
        expire_on = (
            datetime.datetime.now(datetime.timezone.utc)
            + datetime.timedelta(minutes=30)
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
