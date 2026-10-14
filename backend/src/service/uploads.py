import config


def max_upload_bytes() -> int:
    return config.get_config().app.max_upload_mb * 1024 * 1024


def read_limited(file_obj, max_bytes: int) -> bytes:
    data = file_obj.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ValueError("File is too large")
    return data


def sniff_image_type(data: bytes) -> str | None:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if len(data) > 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None
