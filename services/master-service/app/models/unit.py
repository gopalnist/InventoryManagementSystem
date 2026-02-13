"""
Unit of Measurement Models
==========================
Pydantic models for UOM management.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class UnitBase(BaseModel):
    """Base unit fields."""
    name: str = Field(..., min_length=1, max_length=50)
    symbol: str = Field(..., min_length=1, max_length=10)
    unit_type: str = Field(
        default="quantity",
        description="Type: quantity, weight, volume, length"
    )


class UnitCreate(UnitBase):
    """Create unit request."""
    pass


class UnitUpdate(BaseModel):
    """Update unit request."""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    symbol: Optional[str] = Field(None, min_length=1, max_length=10)
    unit_type: Optional[str] = None
    is_active: Optional[bool] = None


class UnitResponse(UnitBase):
    """Unit response with all fields."""
    id: UUID
    tenant_id: UUID
    is_active: bool = True
    created_at: datetime
    
    class Config:
        from_attributes = True


class UnitListResponse(BaseModel):
    """Paginated unit list response."""
    units: list[UnitResponse]
    total: int
    page: int = 1
    limit: int = 50


# Predefined units for quick setup
PREDEFINED_UNITS = [
    {"name": "Piece", "symbol": "pcs", "unit_type": "quantity"},
    {"name": "Box", "symbol": "box", "unit_type": "quantity"},
    {"name": "Carton", "symbol": "ctn", "unit_type": "quantity"},
    {"name": "Pack", "symbol": "pack", "unit_type": "quantity"},
    {"name": "Kilogram", "symbol": "kg", "unit_type": "weight"},
    {"name": "Gram", "symbol": "g", "unit_type": "weight"},
    {"name": "Liter", "symbol": "L", "unit_type": "volume"},
    {"name": "Milliliter", "symbol": "ml", "unit_type": "volume"},
    {"name": "Meter", "symbol": "m", "unit_type": "length"},
    {"name": "Centimeter", "symbol": "cm", "unit_type": "length"},
]




