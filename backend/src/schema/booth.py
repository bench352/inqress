from enum import StrEnum

from schema.rest import RestModel


class BoothLifecycleStatus(StrEnum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"


class BoothCommand(StrEnum):
    SHOW_CAMERA_PREVIEW = "SHOW_CAMERA_PREVIEW"
    HIDE_CAMERA_PREVIEW = "HIDE_CAMERA_PREVIEW"
    REFRESH = "REFRESH"
    CLOSE = "CLOSE"


class BoothCommandRequest(RestModel):
    command: BoothCommand
    params: dict = {}


class BoothStatusResponse(RestModel):
    connected: bool
