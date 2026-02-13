"""
Master Service Configuration
============================
"""

from __future__ import annotations

import os
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment."""
    
    # Service
    SERVICE_NAME: str = "master-service"
    SERVICE_PORT: int = 8002
    DEBUG: bool = True
    
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "ims_db"
    DB_USER: str = "ims_user"
    DB_PASSWORD: str = "ims_password"
    
    # Auth Service URL (for token validation)
    AUTH_SERVICE_URL: str = "http://localhost:8001"
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()




