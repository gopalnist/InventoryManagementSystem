"""AMS Service Configuration"""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """AMS Service settings."""
    
    # Service info
    SERVICE_NAME: str = "AMS Service"
    SERVICE_VERSION: str = "1.0.0"
    SERVICE_PORT: int = 8003
    
    # Database - Dedicated AMS database
    DB_HOST: str = "localhost"
    DB_PORT: int = 5441
    DB_NAME: str = "ams_db"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "mypassword"
    
    # Default vendor for demo
    DEFAULT_VENDOR_CODE: str = "NU8FU"
    DEFAULT_VENDOR_NAME: str = "Nourish You"
    
    # File upload paths
    UPLOAD_DIR: str = "uploads"
    PO_FILES_DIR: str = "uploads/po_files"
    PO_REPORTS_DIR: str = "uploads/po_reports"
    INVENTORY_ERROR_DIR: str = "uploads/error_reports"
    
    class Config:
        env_prefix = ""
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()

