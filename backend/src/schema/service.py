import uuid

import pydantic

import schema.enum


class TicketPayload(pydantic.BaseModel):
    event_id: uuid.UUID
    participant_id: uuid.UUID


class CheckinInfo(pydantic.BaseModel):
    event_mode: schema.enum.EventMode
    participant_id: uuid.UUID
    participant_title: str | None
    participant_name: str
    participant_country_code: str | None
    participant_phone: str | None
    participant_email: str | None
