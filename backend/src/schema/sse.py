from enum import StrEnum
from typing import Generic, TypeVar

from schema.rest import RestModel

T = TypeVar("T")


class SseEventType(StrEnum):
    CREATE_ATTENDEE = "CREATE_ATTENDEE"
    SEND_EMAIL = "SEND_EMAIL"
    ATTENDANCE = "ATTENDANCE"
    GENERATE_TICKET_QR = "GENERATE_TICKET_QR"


class SseType(StrEnum):
    PROGRESS = "PROGRESS"
    NOTIFICATION = "NOTIFICATION"


class SseEvent(RestModel, Generic[T]):
    event_type: SseEventType
    type: SseType
    data: T


class CreateAttendeeProgressData(RestModel):
    in_progress: bool
    num_completed: int
    num_total: int
    est_remain_min: int | None = None
    num_errors: int = 0


class CreateAttendeeSuccessData(RestModel):
    type: str = "success"
    expire_on: str
    result_id: str


class CreateAttendeeErrorData(RestModel):
    type: str = "error"
    detail: str


class SendEmailProgressData(RestModel):
    in_progress: bool
    num_completed: int
    num_total: int
    est_remain_min: int | None = None
    num_errors: int = 0


class SendEmailSuccessData(RestModel):
    type: str = "success"


class SendEmailErrorData(RestModel):
    type: str = "error"
    detail: str


class AttendanceNotificationData(RestModel):
    attendee_id: str
    title: str
    name: str
    check_in_method: str
    check_in_at: str


class GenerateTicketQrProgressData(RestModel):
    in_progress: bool
    num_completed: int
    num_total: int
    est_remain_min: int | None = None
    num_errors: int = 0


class GenerateTicketQrSuccessData(RestModel):
    type: str = "success"


class GenerateTicketQrErrorData(RestModel):
    type: str = "error"
    detail: str
