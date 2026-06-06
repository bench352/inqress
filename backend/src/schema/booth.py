import enum

import schema.rest


class BoothLifecycleStatus(enum.StrEnum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"


class BoothCommand(enum.StrEnum):
    SHOW_CAMERA_PREVIEW = "SHOW_CAMERA_PREVIEW"
    HIDE_CAMERA_PREVIEW = "HIDE_CAMERA_PREVIEW"
    REFRESH = "REFRESH"
    CLOSE = "CLOSE"


class BoothCommandRequest(schema.rest.RestModel):
    command: BoothCommand
    params: dict = {}


class BoothStatusResponse(schema.rest.RestModel):
    connected: bool
