import enum
import typing

import schema.booth
import schema.rest

T = typing.TypeVar("T")


class SseEventType(enum.StrEnum):
    CREATE_PARTICIPANT = "CREATE_PARTICIPANT"
    SEND_EMAIL = "SEND_EMAIL"
    ATTENDANCE = "ATTENDANCE"
    GENERATE_TICKET_QR = "GENERATE_TICKET_QR"
    CHANGE_MODE = "CHANGE_MODE"
    CONTROL = "CONTROL"
    BOOTH_LIFECYCLE = "BOOTH_LIFECYCLE"


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


class ControlCommandData(schema.rest.RestModel):
    command: str
    params: dict = {}


class BoothLifecycleData(schema.rest.RestModel):
    event_id: str
    event_name: str
    status: schema.booth.BoothLifecycleStatus
