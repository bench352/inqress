import base64
import secrets

from fastapi import Depends, HTTPException, Header, Query, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from env import ServerSettings

security = HTTPBasic(auto_error=False)


def validate_basic_credentials(username: str, password: str) -> bool:
    settings = ServerSettings()
    correct_username = secrets.compare_digest(
        username.encode(), settings.admin_username.encode()
    )
    correct_password = secrets.compare_digest(
        password.encode(), settings.admin_password.encode()
    )
    return correct_username and correct_password


def verify_basic_auth(
    credentials: HTTPBasicCredentials = Depends(security),
) -> str:
    if not credentials or not validate_basic_credentials(
        credentials.username, credentials.password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    return credentials.username


def verify_basic_auth_query(
    credentials: HTTPBasicCredentials | None = Depends(security),
    token: str | None = Query(None),
    authorization: str | None = Header(None),
) -> str:
    if isinstance(credentials, HTTPBasicCredentials) and validate_basic_credentials(
        credentials.username, credentials.password
    ):
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

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
    )
