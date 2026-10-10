import threading
import time
from ipaddress import ip_address, ip_network

import fastapi
import pydantic

import config
import service.auth

router = fastapi.APIRouter(prefix="/auth", tags=["Auth"])


# In-memory rate limit state: client_key -> (failure_count, window_start)
_login_failures: dict[str, tuple[int, float]] = {}
_login_failures_lock = threading.Lock()


def _ip_is_trusted(host: str, trusted: list[str]) -> bool:
    try:
        parsed = ip_address(host)
    except ValueError:
        return False
    for entry in trusted:
        try:
            if parsed in ip_network(entry, strict=False):
                return True
        except ValueError:
            continue
    return False


def _get_client_key(request: fastapi.Request) -> str:
    """Return a rate-limit key for the real client, or a global bucket."""
    cfg = config.get_config().auth.login_rate_limit
    if not cfg.enabled:
        return "disabled"

    peer = request.client.host if request.client else "unknown"
    trusted = cfg.trusted_proxies
    if not _ip_is_trusted(peer, trusted):
        # Direct connection. Ignore X-Forwarded-For; the client can forge it.
        return peer

    # Peer is a trusted proxy. Walk X-Forwarded-For from the right and skip
    # trusted hops, so a client-supplied address at the front cannot rotate the key.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        for candidate in reversed([part.strip() for part in forwarded.split(",")]):
            if candidate and not _ip_is_trusted(candidate, trusted):
                return candidate

    return "global"


def _rate_limit_retry_after(key: str) -> int | None:
    """Seconds until this key may try again, or None if it is not limited."""
    cfg = config.get_config().auth.login_rate_limit
    if not cfg.enabled or key == "disabled":
        return None
    now = time.time()
    with _login_failures_lock:
        count, start = _login_failures.get(key, (0, now))
        if now - start >= cfg.window_seconds:
            _login_failures.pop(key, None)
            return None
        if count >= cfg.max_failures:
            return max(int(cfg.window_seconds - (now - start)), 1)
    return None


def _record_login_failure(key: str) -> None:
    cfg = config.get_config().auth.login_rate_limit
    if not cfg.enabled or key == "disabled":
        return
    now = time.time()
    with _login_failures_lock:
        count, start = _login_failures.get(key, (0, now))
        if now - start >= cfg.window_seconds:
            count, start = 0, now
        _login_failures[key] = (count + 1, start)


def _clear_login_failures(key: str) -> None:
    with _login_failures_lock:
        _login_failures.pop(key, None)


class LoginBody(pydantic.BaseModel):
    username: str
    password: str


@router.post("/login")
def login(
    body: LoginBody,
    request: fastapi.Request,
    response: fastapi.Response,
) -> dict:
    key = _get_client_key(request)
    retry_after = _rate_limit_retry_after(key)
    if retry_after is not None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    if not service.auth.validate_basic_credentials(body.username, body.password):
        _record_login_failure(key)
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    _clear_login_failures(key)

    token = service.auth.create_session()
    idle_days, absolute_days = service.auth._get_session_durations()
    max_age = min(idle_days, absolute_days) * 24 * 3600
    service.auth._set_session_cookie(response, token, max_age)
    service.auth.clear_legacy_session_cookie(response)

    return {"username": body.username}


@router.post("/logout", status_code=fastapi.status.HTTP_204_NO_CONTENT)
def logout(
    request: fastapi.Request,
    response: fastapi.Response,
    _: str = fastapi.Depends(service.auth.verify_session_cookie),
) -> None:
    cookie = request.cookies.get(service.auth.get_session_cookie_name())
    service.auth.delete_session(cookie)
    service.auth._clear_session_cookie(response)


@router.get("/session")
def get_session(
    _: str = fastapi.Depends(service.auth.verify_session_cookie),
) -> dict:
    cfg = config.get_config()
    return {"username": cfg.auth.admin_username}
