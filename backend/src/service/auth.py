import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from env import ServerSettings

security = HTTPBasic()


def verify_basic_auth(
    credentials: HTTPBasicCredentials = Depends(security),
) -> str:
    settings = ServerSettings()
    correct_username = secrets.compare_digest(
        credentials.username.encode(), settings.admin_username.encode()
    )
    correct_password = secrets.compare_digest(
        credentials.password.encode(), settings.admin_password.encode()
    )
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    return credentials.username
