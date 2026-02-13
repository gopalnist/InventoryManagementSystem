"""Vendor models"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class VendorBase(BaseModel):
    vendor_code: str
    vendor_name: str
    is_active: bool = True


class VendorCreate(VendorBase):
    pass


class VendorResponse(VendorBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


