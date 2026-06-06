import enum


class EventMode(enum.StrEnum):
    DISABLED = "disabled"
    TEST = "test"
    LIVE = "live"


class CheckinMethod(enum.StrEnum):
    SCAN = "scan"
    PHONE = "phone"
    MANUAL = "manual"


class DuplicateStrategy(enum.StrEnum):
    SKIP = "skip"
    OVERWRITE = "overwrite"
    SMART_MERGE = "smartMerge"


class NameMatchMode(enum.StrEnum):
    EXACT = "exact"
    FUZZY = "fuzzy"
