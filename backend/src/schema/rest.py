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
    description: str = ""
    date: datetime.date


class EventPut(RestModel):
    name: str
    description: str
    date: datetime.date


class EventResponse(RestModel):
    id: uuid.UUID
    name: str
    description: str
    date: str
    mode: schema.enum.EventMode
    has_booth_image: bool


class EventModeUpdate(RestModel):
    mode: schema.enum.EventMode


class EmailTemplateResponse(RestModel):
    text: str


class EmailTemplateRequest(RestModel):
    text: str


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
    is_ticket_delivered: bool
    is_ticket_ready: bool
    checked_in_at: str | None = None


class ScanRequest(RestModel):
    ticket: str


class CheckinSuccessDetail(RestModel):
    title: str
    name: str


class CheckinErrorDetail(RestModel):
    reason: str


class CheckinResponse(RestModel):
    success: bool
    detail: CheckinSuccessDetail | CheckinErrorDetail


class PhoneCheckinRequest(RestModel):
    country_code: str
    phone_no: str


class ManualCheckinRequest(RestModel):
    attendee_id: uuid.UUID


class AssistedCheckinRequest(RestModel):
    attendee_id: uuid.UUID


class AssistedCheckinResponse(RestModel):
    success: bool


class BulkCreateError(RestModel):
    attendee: AttendeeCreate
    reason: str


class BulkCreateResponse(RestModel):
    created: list[AttendeeResponse]
    skipped: list[AttendeeCreate]
    errors: list[BulkCreateError]


class BulkDeleteResponse(RestModel):
    num_deleted: int


class CountryCodesResponse(RestModel):
    default: str
    options: list[str]


class SheetPreview(RestModel):
    columns: list[str]
    heads: list[list[str]]


class ExcelPreviewResponse(RestModel):
    task_id: uuid.UUID
    expire_in: datetime.datetime
    sheet_names: list[str]
    sheets: dict[str, SheetPreview]


class RowMapping(RestModel):
    title_column: str | None = None
    name_column: str | None = None
    raw_phone_column: str | None = None
    email_column: str | None = None


class ExcelImportRequest(RestModel):
    task_id: uuid.UUID
    sheet_name: str
    row_mapping: RowMapping
