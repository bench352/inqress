import enum


class EventMode(enum.StrEnum):
    DISABLED = "disabled"
    TEST = "test"
    LIVE = "live"


class CheckinMethod(enum.StrEnum):
    SCAN = "scan"
    PHONE = "phone"
    MANUAL = "manual"
