import re
import unicodedata
import urllib.parse

_BIDI_CONTROLS = frozenset(
    "\u061c\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069"
)
_FORBIDDEN = frozenset('\\/:*?"<>|')
_EDGE = re.compile(r"^[.\s]+|[.\s]+$")


def ticket_image_name(name: str) -> str:
    """Same result as ticketFileName in ShareTicketDialog.tsx."""
    cleaned = "".join(
        ch
        for ch in name
        if unicodedata.category(ch) != "Cc"
        and ch not in _BIDI_CONTROLS
        and ch not in _FORBIDDEN
    )
    cleaned = _EDGE.sub("", cleaned)
    trimmed = cleaned[:200].strip()
    return f"QR TICKET - {trimmed}.png" if trimmed else "QR TICKET.png"


def safe_name(name: str) -> str:
    """Keep letters, numbers, spaces, and ._- . Drop header-breaking characters."""
    kept = [ch for ch in name if ch.isalnum() or ch in " ._-"]
    cleaned = "".join(kept).strip(" .")
    return cleaned or "ticket"


def attachment_disposition(filename: str) -> str:
    ascii_name = "".join(ch if ord(ch) < 128 else "_" for ch in filename) or "download"
    encoded = urllib.parse.quote(filename, safe="")
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded}"
