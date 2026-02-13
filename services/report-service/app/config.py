"""
Report Service Configuration
============================
"""

import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    
    # Service info
    SERVICE_NAME: str = "report-service"
    SERVICE_PORT: int = 8005
    DEBUG: bool = True
    
    # Database
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "5441"))
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "mypassword")
    DB_NAME: str = os.getenv("DB_NAME", "ams_db")
    
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    # Set environment variables for shared.db.connection
    os.environ.setdefault("DB_HOST", settings.DB_HOST)
    os.environ.setdefault("DB_PORT", str(settings.DB_PORT))
    os.environ.setdefault("DB_USER", settings.DB_USER)
    os.environ.setdefault("DB_PASSWORD", settings.DB_PASSWORD)
    os.environ.setdefault("DB_NAME", settings.DB_NAME)
    return settings

