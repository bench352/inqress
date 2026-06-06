import datetime
import re
import uuid

import pydantic.alias_generators

import schema.enum


class RestModel(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(
        alias_generator=pydantic.alias_generators.to_camel,
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


class AccentColorRequest(RestModel):
    color_code: str

    @pydantic.field_validator("color_code")
    @classmethod
    def validate_hex_color(cls, v: str) -> str:
        if not re.match(r"^#[0-9a-fA-F]{6}$", v):
            raise ValueError("color_code must be a valid hex color (e.g., #FF0000)")
        return v


class AccentColorResponse(RestModel):
    color_code: str


class ParticipantCreate(RestModel):
    title: str | None = None
    name: str
    email: str | None = None
    raw_phone: str | None = None


class ParticipantPut(RestModel):
    title: str | None = None
    name: str
    email: str | None = None
    raw_phone: str | None = None


class ParticipantResponse(RestModel):
    id: uuid.UUID
    event_id: uuid.UUID
    title: str | None = None
    name: str
    email: str | None = None
    raw_phone: str | None = None
    country_code: str | None = None
    phone: str | None = None
    is_ticket_delivered: bool
    is_ticket_ready: bool
    checked_in_at: str | None = None


class ScanRequest(RestModel):
    ticket: str


class CheckinSuccessDetail(RestModel):
    title: str | None = None
    name: str


class CheckinErrorDetail(RestModel):
    reason: str


class CheckinConflictDetail(RestModel):
    reason: str
    conflicting_participants: list[ParticipantResponse]


class CheckinResponse(RestModel):
    success: bool
    detail: CheckinSuccessDetail | CheckinConflictDetail | CheckinErrorDetail


class PhoneCheckinRequest(RestModel):
    country_code: str
    phone_no: str


class ManualCheckinRequest(RestModel):
    participant_id: uuid.UUID


class AssistedCheckinRequest(RestModel):
    participant_id: uuid.UUID


class AssistedCheckinResponse(RestModel):
    success: bool


class BulkCreateError(RestModel):
    participant: ParticipantCreate
    reason: str


class BulkCreateResponse(RestModel):
    created: list[ParticipantResponse]
    skipped: list[ParticipantCreate]
    overwritten: list[ParticipantResponse]
    merged: list[ParticipantResponse]
    errors: list[BulkCreateError]


class BulkDeleteResponse(RestModel):
    num_deleted: int


class CountryCodesResponse(RestModel):
    default: str
    options: list[str]


class SheetPreview(RestModel):
    columns: list[str]
    heads: list[list[str]]


class SpreadsheetPreviewResponse(RestModel):
    task_id: uuid.UUID
    expire_in: datetime.datetime
    sheets: dict[str, SheetPreview]


class RowMapping(RestModel):
    title_column: str | None = None
    name_column: str | None = None
    raw_phone_column: str | None = None
    email_column: str | None = None


class SpreadsheetImportRequest(RestModel):
    task_id: uuid.UUID
    sheet_name: str
    strategy: schema.enum.DuplicateStrategy
    name_match_mode: schema.enum.NameMatchMode
    row_mapping: RowMapping


class InfoResponse(RestModel):
    org_name: str | None
    send_via_email: str
