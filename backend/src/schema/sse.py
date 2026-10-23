import enum
import typing

import schema.rest

T = typing.TypeVar("T")


class SseEventType(enum.StrEnum):
    CREATE_PARTICIPANT = "CREATE_PARTICIPANT"
    SEND_EMAIL = "SEND_EMAIL"
    ATTENDANCE = "ATTENDANCE"
    SCAN_REFUSAL = "SCAN_REFUSAL"
    GENERATE_TICKET_QR = "GENERATE_TICKET_QR"
    CHANGE_MODE = "CHANGE_MODE"
    DATA_SOURCE_SYNC = "DATA_SOURCE_SYNC"
    CONTROL = "CONTROL"


class SseType(enum.StrEnum):
    PROGRESS = "PROGRESS"
    NOTIFICATION = "NOTIFICATION"
    COMMAND = "COMMAND"


class SseEvent(schema.rest.RestModel, typing.Generic[T]):
    event_type: SseEventType
    type: SseType
    data: T


class CreateParticipantProgressData(schema.rest.RestModel):
    in_progress: bool
    num_completed: int
    num_total: int
    est_remain_min: int | None = None
    num_errors: int = 0


class CreateParticipantSuccessData(schema.rest.RestModel):
    type: str = "success"
    expire_on: str
    result_id: str


class CreateParticipantErrorData(schema.rest.RestModel):
    type: str = "error"
    detail: str


class SendEmailProgressData(schema.rest.RestModel):
    in_progress: bool
    num_completed: int
    num_total: int
    est_remain_min: int | None = None
    num_errors: int = 0


class SendEmailSuccessData(schema.rest.RestModel):
    type: str = "success"


class SendEmailErrorData(schema.rest.RestModel):
    type: str = "error"
    detail: str


class AttendanceNotificationData(schema.rest.RestModel):
    participant_id: str
    title: str | None = None
    name: str
    check_in_method: str
    check_in_at: str


class ScanRefusalData(schema.rest.RestModel):
    reason: str
    title: str | None = None
    name: str | None = None


class GenerateTicketQrProgressData(schema.rest.RestModel):
    in_progress: bool
    num_completed: int
    num_total: int
    est_remain_min: int | None = None
    num_errors: int = 0


class GenerateTicketQrSuccessData(schema.rest.RestModel):
    type: str = "success"


class GenerateTicketQrErrorData(schema.rest.RestModel):
    type: str = "error"
    detail: str


class ChangeModeData(schema.rest.RestModel):
    value: str


class DataSourceSyncData(schema.rest.RestModel):
    source_id: str
    source_name: str
    in_progress: bool = False
    added: int = 0
    updated: int = 0
    skipped: int = 0
    errors: int = 0
    error_samples: list[str] = []
    detail: str | None = None


class ControlCommandData(schema.rest.RestModel):
    command: str
    params: dict = {}
