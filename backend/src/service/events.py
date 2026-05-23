import uuid
from pathlib import Path

from sqlalchemy import delete, insert, select, update

from schema.enum import EventMode
from schema.orm import Event
from schema.rest import (
    EmailTemplateResponse,
    EventCreate,
    EventPut,
    EventResponse,
)
from service.db import get_engine

_DEFAULT_TEMPLATE_PATH = (
    Path(__file__).resolve().parent.parent / "assets" / "default_email_template.html"
)


def _load_default_template() -> str:
    return _DEFAULT_TEMPLATE_PATH.read_text()


def list_events() -> list[EventResponse]:
    with get_engine().begin() as conn:
        result = conn.execute(select(Event).order_by(Event.date))
        return [EventResponse.model_validate(row) for row in result.scalars().all()]


def get_event(event_id: uuid.UUID) -> EventResponse | None:
    with get_engine().begin() as conn:
        result = conn.execute(select(Event).where(Event.id == event_id))
        row = result.scalars().first()
        return EventResponse.model_validate(row) if row else None


def create_event(payload: EventCreate) -> EventResponse:
    default_template = _load_default_template()
    with get_engine().begin() as conn:
        result = conn.execute(
            insert(Event)
            .values(
                id=uuid.uuid4(),
                name=payload.name,
                description=payload.description,
                date=payload.date,
                email_template=default_template,
            )
            .returning(Event)
        )
        return EventResponse.model_validate(result.scalars().one())


def update_event(event_id: uuid.UUID, payload: EventPut) -> EventResponse | None:
    values = payload.model_dump(by_alias=False)
    with get_engine().begin() as conn:
        result = conn.execute(
            update(Event).where(Event.id == event_id).values(**values).returning(Event)
        )
        row = result.scalars().first()
        return EventResponse.model_validate(row) if row else None


def delete_event(event_id: uuid.UUID) -> EventResponse | None:
    with get_engine().begin() as conn:
        result = conn.execute(
            delete(Event).where(Event.id == event_id).returning(Event)
        )
        row = result.scalars().first()
        return EventResponse.model_validate(row) if row else None


def update_event_mode(event_id: uuid.UUID, mode: EventMode) -> EventResponse | None:
    with get_engine().begin() as conn:
        result = conn.execute(
            update(Event).where(Event.id == event_id).values(mode=mode).returning(Event)
        )
        row = result.scalars().first()
        return EventResponse.model_validate(row) if row else None


def get_email_template(event_id: uuid.UUID) -> EmailTemplateResponse | None:
    with get_engine().begin() as conn:
        result = conn.execute(select(Event.email_template).where(Event.id == event_id))
        text = result.scalars().first()
        return EmailTemplateResponse(text=text) if text is not None else None


def update_email_template(event_id: uuid.UUID, text: str) -> bool:
    with get_engine().begin() as conn:
        result = conn.execute(
            update(Event).where(Event.id == event_id).values(email_template=text)
        )
        return result.rowcount > 0
