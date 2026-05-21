import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

import schema.enum


class RestModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        from_attributes=True,
        populate_by_name=True,
    )


class EventCreate(RestModel):
    name: str
    description: str | None = None
    date: datetime.date


class EventUpdate(RestModel):
    name: str | None = None
    description: str | None = None
    date: str | None = None
    mode: schema.enum.EventMode | None = None


class EventResponse(RestModel):
    id: uuid.UUID
    name: str
    description: str | None
    date: str
    mode: schema.enum.EventMode


class AttendeeCreate(RestModel):
    title: str
    name: str
    email: str = Field(min_length=1)
    raw_phone: str = Field(min_length=1)


class AttendeeResponse(RestModel):
    id: uuid.UUID
    event_id: uuid.UUID
    title: str
    name: str
    email: str
    raw_phone: str
    country_code: str
    phone: str


class ScanRequest(RestModel):
    ticket: str


class ScanSuccessDetail(RestModel):
    attendee_title: str
    attendee_name: str


class ScanErrorDetail(RestModel):
    reason: str


class ScanResponse(RestModel):
    success: bool
    detail: ScanSuccessDetail | ScanErrorDetail


class PhoneCheckinRequest(RestModel):
    country_code: str
    phone_no: str


class ManualCheckinRequest(RestModel):
    attendee_id: uuid.UUID


class BulkCreateError(RestModel):
    attendee: AttendeeCreate
    reason: str


class BulkCreateResponse(RestModel):
    created: list[AttendeeResponse]
    skipped: list[AttendeeCreate]
    errors: list[BulkCreateError]


class BulkDeleteResponse(RestModel):
    num_deleted: int
