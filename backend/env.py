import pydantic_settings


class ServerSettings(pydantic_settings.BaseSettings):
    admin_username: str
    admin_password: str
