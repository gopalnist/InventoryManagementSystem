"""
Item Models
===========
Pydantic models for item/product management.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ItemBase(BaseModel):
    """Base item fields."""
    sku_code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    
    # Category
    category_id: Optional[UUID] = None
    
    # Units
    primary_unit_id: Optional[UUID] = None
    secondary_unit_id: Optional[UUID] = None
    conversion_rate: Optional[Decimal] = Field(None)
    
    # Pricing
    purchase_rate: Optional[Decimal] = Field(None)
    selling_rate: Optional[Decimal] = Field(None)
    mrp: Optional[Decimal] = Field(None)
    tax_rate: Optional[Decimal] = Field(None)
    hsn_code: Optional[str] = Field(None, max_length=20)
    
    # Tracking options
    track_batches: bool = False
    track_serials: bool = False
    track_expiry: bool = False
    has_variants: bool = False
    
    # Stock settings
    reorder_level: Optional[int] = None
    reorder_qty: Optional[int] = None
    min_stock: Optional[int] = None
    max_stock: Optional[int] = None


class ItemCreate(ItemBase):
    """Create item request."""
    pass


class ItemUpdate(BaseModel):
    """Update item request - all fields optional."""
    sku_code: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category_id: Optional[UUID] = None
    primary_unit_id: Optional[UUID] = None
    secondary_unit_id: Optional[UUID] = None
    conversion_rate: Optional[Decimal] = None
    purchase_rate: Optional[Decimal] = None
    selling_rate: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    hsn_code: Optional[str] = None
    track_batches: Optional[bool] = None
    track_serials: Optional[bool] = None
    track_expiry: Optional[bool] = None
    has_variants: Optional[bool] = None
    reorder_level: Optional[int] = None
    reorder_qty: Optional[int] = None
    min_stock: Optional[int] = None
    max_stock: Optional[int] = None
    is_active: Optional[bool] = None


class ItemResponse(ItemBase):
    """Item response with all fields."""
    id: UUID
    tenant_id: UUID
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Joined fields
    category_name: Optional[str] = None
    primary_unit_name: Optional[str] = None
    secondary_unit_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class ItemListResponse(BaseModel):
    """Paginated item list response."""
    items: list[ItemResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class ItemImportRow(BaseModel):
    """Single row for bulk import."""
    sku_code: str
    name: str
    category: Optional[str] = None
    unit: Optional[str] = None
    purchase_rate: Optional[Decimal] = None
    selling_rate: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    reorder_level: Optional[int] = None


class ItemImportResult(BaseModel):
    """Result of bulk import."""
    success_count: int
    error_count: int
    errors: list[dict]




