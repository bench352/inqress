from pathlib import Path

import pydantic_settings

_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class ServerSettings(pydantic_settings.BaseSettings):
    admin_username: str
    admin_password: str

    model_config = pydantic_settings.SettingsConfigDict(env_file=_ENV_FILE)


_settings: ServerSettings | None = None


def get_settings() -> ServerSettings:
    global _settings
    if _settings is None:
        _settings = ServerSettings()
    return _settings
