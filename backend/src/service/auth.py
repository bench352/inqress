import base64
import secrets

import fastapi
import fastapi.security

import config

security = fastapi.security.HTTPBasic(auto_error=False)


def validate_basic_credentials(username: str, password: str) -> bool:
    cfg = config.get_config()
    correct_username = secrets.compare_digest(
        username.encode(), cfg.auth.admin_username.encode()
    )
    correct_password = secrets.compare_digest(
        password.encode(), cfg.auth.admin_password.encode()
    )
    return correct_username and correct_password


def verify_basic_auth(
    credentials: fastapi.security.HTTPBasicCredentials = fastapi.Depends(security),
) -> str:
    if not credentials or not validate_basic_credentials(
        credentials.username, credentials.password
    ):
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    return credentials.username


def verify_basic_auth_query(
    credentials: fastapi.security.HTTPBasicCredentials | None = fastapi.Depends(
        security
    ),
    token: str | None = fastapi.Query(None),
    authorization: str | None = fastapi.Header(None),
) -> str:
    if isinstance(
        credentials, fastapi.security.HTTPBasicCredentials
    ) and validate_basic_credentials(credentials.username, credentials.password):
        return credentials.username

    auth_token = token
    if (
        not auth_token
        and isinstance(authorization, str)
        and authorization.startswith("Basic ")
    ):
        auth_token = authorization[len("Basic ") :]

    if auth_token:
        try:
            decoded = base64.b64decode(auth_token).decode("utf-8")
            username, sep, password = decoded.partition(":")
            if sep and validate_basic_credentials(username, password):
                return username
        except Exception:
            pass

    raise fastapi.HTTPException(
        status_code=fastapi.status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
    )
