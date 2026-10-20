import os
import pathlib

import pydantic
import yaml

_DATA_DIR = pathlib.Path(__file__).resolve().parent.parent / "data"


class ServerConfig(pydantic.BaseModel):
    host: str = "localhost"
    port: int = 8000
    debug: bool = False
    api_docs: bool = False


class AppConfig(pydantic.BaseModel):
    organization_name: str | None = None
    default_country_code: str = "HK"
    max_upload_mb: int = pydantic.Field(default=30, ge=1)
    data_source_poll_minutes: int = pydantic.Field(default=5, ge=1)


class LoginRateLimitConfig(pydantic.BaseModel):
    enabled: bool = True
    max_failures: int = 10
    window_seconds: int = 900
    trusted_proxies: list[str] = []


class AuthConfig(pydantic.BaseModel):
    admin_username: str = pydantic.Field(min_length=1)
    admin_password: str = pydantic.Field(min_length=1)
    cookie_secure: bool = True
    session_idle_days: int = 30
    session_absolute_days: int = 90
    login_rate_limit: LoginRateLimitConfig = LoginRateLimitConfig()


class EmailSmtpConfig(pydantic.BaseModel):
    host: str = ""
    port: int = 465
    username: str = ""
    password: str = ""
    display_email: str | None = None
    wait_between_delivery_second: int = 5


class Config(pydantic.BaseModel):
    server: ServerConfig = ServerConfig()
    app: AppConfig = AppConfig()
    auth: AuthConfig
    email_smtp: EmailSmtpConfig = EmailSmtpConfig()


_config: Config | None = None


def get_config(*, fresh: bool = False) -> Config:
    """The process-wide config. `fresh` reads the file again without replacing it,
    for a long-running loop that has to see an edited file."""
    global _config
    if _config is not None and not fresh:
        return _config

    config_path = os.getenv("CONFIG_PATH", str(_DATA_DIR / "config.yaml"))
    config_file = pathlib.Path(config_path)

    if not config_file.exists():
        raise FileNotFoundError(
            f"Config file not found: {config_file}\n"
            "Create a config.yaml file or set the CONFIG_PATH environment variable "
            "to point to an existing configuration file."
        )

    with open(config_file) as f:
        data = yaml.safe_load(f) or {}

    loaded = Config(**data)
    if not fresh:
        _config = loaded
    return loaded
