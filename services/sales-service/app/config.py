"""
Sales Service Configuration
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SERVICE_NAME: str = "sales-service"
    SERVICE_PORT: int = 8002
    DEBUG: bool = False

    # Database settings (shared with master service for now)
    DB_HOST: str = "localhost"
    DB_PORT: int = 5441
    DB_NAME: str = "ims_master"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "mypassword"


def get_settings() -> Settings:
    return Settings()
