import logging
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
from service.db import get_engine
from service import ticket

logger = logging.getLogger(__name__)


def list_attendees(event_id: uuid.UUID) -> list[AttendeeResponse]:
    with get_engine().begin() as conn:
        result = conn.execute(select(Attendee).where(Attendee.event_id == event_id))
        return [AttendeeResponse.model_validate(row) for row in result.scalars().all()]


def get_attendee(
    event_id: uuid.UUID, attendee_id: uuid.UUID
) -> AttendeeResponse | None:
    with get_engine().begin() as conn:
        result = conn.execute(
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

        phone = f"{parsed.country_code}{parsed.national_number}"
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

    with get_engine().begin() as conn:
        existing_rows = (
            conn.execute(
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

                result = conn.execute(
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
    with get_engine().begin() as conn:
        result = conn.execute(
            update(Attendee)
            .where(Attendee.id == attendee_id, Attendee.event_id == event_id)
            .values(is_ticket_delivered=True)
        )
        return result.rowcount > 0


def bulk_delete(event_id: uuid.UUID, ids: list[uuid.UUID]) -> BulkDeleteResponse:
    if not ids:
        return BulkDeleteResponse(num_deleted=0)
    with get_engine().begin() as conn:
        result = conn.execute(
            delete(Attendee).where(Attendee.event_id == event_id, Attendee.id.in_(ids))
        )
        return BulkDeleteResponse(num_deleted=result.rowcount)
