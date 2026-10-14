import urllib.parse


def safe_name(name: str) -> str:
    """Keep letters, numbers, spaces, and ._- . Drop header-breaking characters."""
    kept = [ch for ch in name if ch.isalnum() or ch in " ._-"]
    cleaned = "".join(kept).strip(" .")
    return cleaned or "ticket"


def attachment_disposition(filename: str) -> str:
    ascii_name = "".join(ch if ord(ch) < 128 else "_" for ch in filename) or "download"
    encoded = urllib.parse.quote(filename, safe="")
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded}"