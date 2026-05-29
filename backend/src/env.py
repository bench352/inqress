import pydantic_settings


class ServerSettings(pydantic_settings.BaseSettings):
    admin_username: str
    admin_password: str
    default_country_code: str
    host: str = "localhost"
    port: int = 8000
    debug: bool = False


class SmtpSettings(pydantic_settings.BaseSettings):
    smtp_server: str = ""
    smtp_port: int = 465
    smtp_username: str = ""
    smtp_password: str = ""
