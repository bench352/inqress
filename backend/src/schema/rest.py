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


class EmailSettingsResponse(RestModel):
    subject: str | None = None
    sender_name: str | None = None
    # Computed for the preview, not stored and not accepted on save.
    from_header: str | None = None
    from_error: str | None = None


class EmailSettingsRequest(RestModel):
    subject: str | None = None
    sender_name: str | None = None

    @pydantic.field_validator("subject", "sender_name")
    @classmethod
    def clean(cls, v: str | None) -> str | None:
        if v is None:
            return None
        # Line breaks would otherwise reach a mail header.
        cleaned = " ".join(v.splitlines()).strip()
        if not cleaned:
            return None
        if len(cleaned) > 200:
            raise ValueError("must be at most 200 characters")
        return cleaned


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


class ParticipantActivatedUpdate(RestModel):
    activated: bool


class ParticipantDetachedUpdate(RestModel):
    detached: bool


class ParticipantsCreateRequest(RestModel):
    strategy: schema.enum.DuplicateStrategy = schema.enum.DuplicateStrategy.SKIP
    name_match_mode: schema.enum.NameMatchMode = schema.enum.NameMatchMode.EXACT
    activate_new: bool = True
    data: list[ParticipantCreate] = []


class ManagedBy(RestModel):
    id: uuid.UUID
    name: str
    overwrites_details: bool


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
    activated: bool | None
    # None when the participant is not managed by a data source.
    detached: bool | None = None
    managed_by: ManagedBy | None = None


class ScanRequest(RestModel):
    ticket: str


class CheckinSuccessDetail(RestModel):
    title: str | None = None
    name: str


class CheckinErrorDetail(RestModel):
    reason: str
    # Set when the refused scan identified the guest. Other check-in errors omit these.
    title: str | None = None
    name: str | None = None


class CheckinConflictDetail(RestModel):
    reason: str
    conflicting_participants: list[ParticipantResponse]


class CheckinResponse(RestModel):
    success: bool
    detail: CheckinSuccessDetail | CheckinConflictDetail | CheckinErrorDetail


class PhoneCheckinRequest(RestModel):
    country_code: str
    phone_no: str


class EmailCheckinRequest(RestModel):
    email: str


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
    activate_new: bool = True


class DataSourceHeader(RestModel):
    name: str
    value: str


class DataSourceBase(RestModel):
    name: str
    headers: list[DataSourceHeader] = []
    sheet_name: str
    tracking: schema.enum.DataSourceTracking
    strategy: schema.enum.DuplicateStrategy | None = None
    name_match_mode: schema.enum.NameMatchMode | None = None
    activate_new: bool = True
    title_column: str | None = None
    name_column: str
    raw_phone_column: str | None = None
    email_column: str | None = None


class DataSourceCreate(DataSourceBase):
    url: str


class DataSourceUpdate(DataSourceBase):
    clear_row_links: bool = False


class DataSourceActivatedUpdate(RestModel):
    activated: bool


class DataSourceConflictDetail(RestModel):
    code: str
    message: str


class DataSourceSummary(RestModel):
    added: int = 0
    updated: int = 0
    skipped: int = 0
    errors: int = 0
    error_samples: list[str] = []


class DataSourceResponse(DataSourceBase):
    id: uuid.UUID
    url: str
    activated: bool
    last_attempt_at: str | None = None
    last_success_at: str | None = None
    last_error: str | None = None
    last_summary: DataSourceSummary | None = None
    sync_skipped: bool = False


class DataSourcePreviewRequest(RestModel):
    url: str
    headers: list[DataSourceHeader] = []


class DataSourcePreviewResponse(RestModel):
    sheets: dict[str, SheetPreview]


class InfoResponse(RestModel):
    org_name: str | None
    from_header: str
    from_error: str | None = None
    email_footer_enabled: bool
    app_version: str
    max_upload_mb: int


class CompanionSessionRequest(RestModel):
    event_id: uuid.UUID
    token: str


class CompanionSessionResponse(RestModel):
    event_id: uuid.UUID
    name: str


class CompanionTokenResponse(RestModel):
    token: str


class KioskMessageRequest(RestModel):
    message: str


class KioskMessageResponse(RestModel):
    message: str
