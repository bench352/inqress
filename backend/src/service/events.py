import uuid

from sqlalchemy import delete, insert, select, update

from schema.orm import Event
from schema.rest import EventCreate, EventResponse, EventUpdate
from service.db import get_engine


def list_events() -> list[EventResponse]:
    with get_engine().begin() as conn:
        result = conn.execute(select(Event).order_by(Event.date))
        return [EventResponse.model_validate(row) for row in result.mappings().all()]


def get_event(event_id: str) -> EventResponse | None:
    with get_engine().begin() as conn:
        result = conn.execute(select(Event).where(Event.id == event_id))
        row = result.mappings().first()
        return EventResponse.model_validate(row) if row else None


def create_event(payload: EventCreate) -> EventResponse:
    with get_engine().begin() as conn:
        result = conn.execute(
            insert(Event)
            .values(
                id=str(uuid.uuid4()),
                name=payload.name,
                description=payload.description,
                date=payload.date,
            )
            .returning(Event)
        )
        return EventResponse.model_validate(result.mappings().one())


def update_event(event_id: str, payload: EventUpdate) -> EventResponse | None:
    values = payload.model_dump(exclude_unset=True, by_alias=False)
    if not values:
        return get_event(event_id)
    with get_engine().begin() as conn:
        result = conn.execute(
            update(Event).where(Event.id == event_id).values(**values).returning(Event)
        )
        row = result.mappings().first()
        return EventResponse.model_validate(row) if row else None


def delete_event(event_id: str) -> EventResponse | None:
    with get_engine().begin() as conn:
        result = conn.execute(
            delete(Event).where(Event.id == event_id).returning(Event)
        )
        row = result.mappings().first()
        return EventResponse.model_validate(row) if row else None
