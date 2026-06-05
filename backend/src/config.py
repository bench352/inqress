import os
from pathlib import Path

import yaml
from pydantic import BaseModel, Field

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


class ServerConfig(BaseModel):
    host: str = "localhost"
    port: int = 8000
    debug: bool = False
    frontend_dir: str | None = None


class AppConfig(BaseModel):
    organization_name: str | None = None
    default_country_code: str = "HK"


class AuthConfig(BaseModel):
    admin_username: str = Field(min_length=1)
    admin_password: str = Field(min_length=1)


class EmailSmtpConfig(BaseModel):
    host: str = ""
    port: int = 465
    username: str = ""
    password: str = ""
    display_email: str | None = None
    wait_between_delivery_second: int = 5


class Config(BaseModel):
    server: ServerConfig = ServerConfig()
    app: AppConfig = AppConfig()
    auth: AuthConfig
    email_smtp: EmailSmtpConfig = EmailSmtpConfig()


_config: Config | None = None


def get_config() -> Config:
    global _config
    if _config is not None:
        return _config

    config_path = os.getenv("CONFIG_PATH", str(_DATA_DIR / "config.yaml"))
    config_file = Path(config_path)

    if not config_file.exists():
        raise FileNotFoundError(
            f"Config file not found: {config_file}\n"
            "Create a config.yaml file or set the CONFIG_PATH environment variable "
            "to point to an existing configuration file."
        )

    with open(config_file) as f:
        data = yaml.safe_load(f) or {}

    _config = Config(**data)
    return _config
