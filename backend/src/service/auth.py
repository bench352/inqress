import hashlib
import pathlib
import secrets
from datetime import datetime, timedelta, timezone

import fastapi

import config
import schema.orm
import service.db


_EPOCH_FILE_NAME = ".admin_session_epoch"


def _epoch_file() -> pathlib.Path:
    data_dir = pathlib.Path(__file__).resolve().parent.parent.parent / "data"
    return data_dir / _EPOCH_FILE_NAME


def _current_epoch() -> str:
    """Return the current session epoch. Regenerates (and clears sessions) if the admin password changed."""
    path = _epoch_file()
    cfg = config.get_config()
    current_fp = hashlib.sha256(cfg.auth.admin_password.encode()).hexdigest()

    if path.exists():
        try:
            content = path.read_text().strip()
            if "|" in content:
                epoch, fp = content.split("|", 1)
                if fp == current_fp:
                    return epoch
        except Exception:
            pass  # corrupt file -> regenerate

    # Password changed or first run: clear all sessions and mint a new epoch
    new_epoch = secrets.token_urlsafe(16)
    path.write_text(f"{new_epoch}|{current_fp}")

    with service.db.get_session() as s:
        s.query(schema.orm.AdminSession).delete()
        s.commit()

    return new_epoch


def get_session_cookie_name() -> str:
    cfg = config.get_config()
    return "__Host-inqress_session" if cfg.auth.cookie_secure else "inqress_session"


def _get_session_durations():
    cfg = config.get_config()
    return (
        cfg.auth.session_idle_days,
        cfg.auth.session_absolute_days,
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_utc(dt: datetime) -> datetime:
    """SQLite stores datetimes as naive; treat them as UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _session_deadline(now: datetime, created_at: datetime) -> datetime:
    idle_days, absolute_days = _get_session_durations()
    return min(
        now + timedelta(days=idle_days),
        created_at + timedelta(days=absolute_days),
    )


def create_session() -> tuple[str, int]:
    """Create a new admin session.

    Returns the raw token and the cookie max-age in seconds. max-age is the
    remaining lifetime of the stored expires_at, which is the sooner of the
    idle and absolute deadlines — not a fresh full window of either.
    """
    token = secrets.token_urlsafe(32)
    token_hash = _hash_token(token)
    now = _now()
    expires = _session_deadline(now, now)
    max_age = int((expires - now).total_seconds())

    with service.db.get_session() as session:
        db_session = schema.orm.AdminSession(
            id=token_hash,
            created_at=now,
            last_seen_at=now,
            expires_at=expires,
            password_tag=_current_epoch(),
        )
        session.add(db_session)

    return token, max_age


def verify_session_cookie(
    request: fastapi.Request,
    response: fastapi.Response,
) -> str:
    """Dependency that validates the session cookie. Returns username on success.
    Refreshes the cookie on slide.
    """
    session_token = request.cookies.get(get_session_cookie_name())
    if not session_token:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token_hash = _hash_token(session_token)
    now = _now()
    tag = _current_epoch()
    _, absolute_days = _get_session_durations()

    with service.db.get_session() as db_session:
        row = (
            db_session.query(schema.orm.AdminSession)
            .filter(schema.orm.AdminSession.id == token_hash)
            .first()
        )

        if not row:
            raise fastapi.HTTPException(
                status_code=fastapi.status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        expires_at = _ensure_utc(row.expires_at)
        last_seen_at = _ensure_utc(row.last_seen_at)
        created_at = _ensure_utc(row.created_at)
        absolute_end = created_at + timedelta(days=absolute_days)

        if expires_at < now or absolute_end < now:
            db_session.delete(row)
            db_session.commit()
            raise fastapi.HTTPException(
                status_code=fastapi.status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        if row.password_tag != tag:
            db_session.delete(row)
            db_session.commit()
            raise fastapi.HTTPException(
                status_code=fastapi.status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        # Sliding: extend if last_seen older than 1 hour, and send refreshed cookie.
        if last_seen_at < now - timedelta(hours=1):
            new_expires = _session_deadline(now, created_at)
            if new_expires <= now:
                db_session.delete(row)
                raise fastapi.HTTPException(
                    status_code=fastapi.status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials",
                )
            row.last_seen_at = now
            row.expires_at = new_expires
            max_age = int((new_expires - now).total_seconds())
            _set_session_cookie(response, session_token, max_age)

    return config.get_config().auth.admin_username


def delete_session(session_token: str | None) -> None:
    """Delete a session by its raw token (used on logout)."""
    if not session_token:
        return
    token_hash = _hash_token(session_token)
    with service.db.get_session() as session:
        row = (
            session.query(schema.orm.AdminSession)
            .filter(schema.orm.AdminSession.id == token_hash)
            .first()
        )
        if row:
            session.delete(row)


def validate_basic_credentials(username: str, password: str) -> bool:
    cfg = config.get_config()
    correct_username = secrets.compare_digest(
        username.encode(), cfg.auth.admin_username.encode()
    )
    correct_password = secrets.compare_digest(
        password.encode(), cfg.auth.admin_password.encode()
    )
    return correct_username and correct_password


def _set_session_cookie(response: fastapi.Response, token: str, max_age: int) -> None:
    """Set the session cookie with correct name and flags based on config."""
    name = get_session_cookie_name()
    cfg = config.get_config()
    response.set_cookie(
        key=name,
        value=token,
        max_age=max_age,
        path="/",
        secure=cfg.auth.cookie_secure,
        httponly=True,
        samesite="lax",
    )


def _expire_cookie(response: fastapi.Response, name: str, *, secure: bool) -> None:
    response.set_cookie(
        key=name,
        value="",
        max_age=0,
        path="/",
        secure=secure,
        httponly=True,
        samesite="lax",
    )


def clear_legacy_session_cookie(response: fastapi.Response) -> None:
    """Drop the cookie name this process is not using. Does not touch the active name."""
    current = get_session_cookie_name()
    if current != "inqress_session":
        # Historical inqress_session cookies were always Secure.
        _expire_cookie(response, "inqress_session", secure=True)
    if current != "__Host-inqress_session":
        _expire_cookie(response, "__Host-inqress_session", secure=True)


def _clear_session_cookie(response: fastapi.Response) -> None:
    """Clear every session cookie name this app has issued."""
    cfg = config.get_config()
    _expire_cookie(response, "inqress_session", secure=cfg.auth.cookie_secure)
    if not cfg.auth.cookie_secure:
        # A previous process may have set this name with Secure.
        _expire_cookie(response, "inqress_session", secure=True)
    _expire_cookie(response, "__Host-inqress_session", secure=True)
