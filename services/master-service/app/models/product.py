"""
Product Models
==============
Pydantic models for product management (formerly items).
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field


class ProductBase(BaseModel):
    """Base product fields."""
    sku: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    
    # Product Type
    product_type: str = Field(default="goods", description="goods, service, raw_material")
    
    # Classification
    category_id: Optional[UUID] = None
    brand_id: Optional[UUID] = None
    manufacturer_id: Optional[UUID] = None
    
    # Product Identifiers
    upc: Optional[str] = Field(None, max_length=20)
    ean: Optional[str] = Field(None, max_length=20)
    mpn: Optional[str] = Field(None, max_length=50)
    isbn: Optional[str] = Field(None, max_length=20)
    
    # Units
    primary_unit_id: Optional[UUID] = None
    secondary_unit_id: Optional[UUID] = None
    conversion_rate: Optional[Decimal] = Field(None)
    
    # Dimensions
    length: Optional[Decimal] = Field(None)
    width: Optional[Decimal] = Field(None)
    height: Optional[Decimal] = Field(None)
    dimension_unit_id: Optional[UUID] = None
    weight: Optional[Decimal] = Field(None)
    weight_unit_id: Optional[UUID] = None
    
    # Sales Information
    selling_price: Optional[Decimal] = Field(None)
    mrp: Optional[Decimal] = Field(None)
    sales_description: Optional[str] = None
    sales_tax_rate: Optional[Decimal] = Field(None)
    is_taxable: bool = True
    
    # Purchase Information
    cost_price: Optional[Decimal] = Field(None)
    purchase_description: Optional[str] = None
    purchase_tax_rate: Optional[Decimal] = Field(None)
    preferred_vendor_id: Optional[UUID] = None
    
    # Tax & Compliance
    hsn_code: Optional[str] = Field(None, max_length=20)
    
    # Tracking options
    track_batches: bool = False
    track_serials: bool = False
    track_expiry: bool = False
    has_variants: bool = False
    
    # Inventory Settings
    reorder_level: Optional[int] = None
    reorder_qty: Optional[int] = None
    min_stock: Optional[int] = None
    max_stock: Optional[int] = None
    lead_time_days: Optional[int] = None
    
    # Opening Stock
    opening_stock: Optional[Decimal] = Field(default=0)
    opening_stock_value: Optional[Decimal] = Field(default=0)
    
    # Images
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None


class ProductCreate(ProductBase):
    """Create product request."""
    pass


class ProductUpdate(BaseModel):
    """Update product request - all fields optional."""
    sku: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    product_type: Optional[str] = None
    
    category_id: Optional[UUID] = None
    brand_id: Optional[UUID] = None
    manufacturer_id: Optional[UUID] = None
    
    upc: Optional[str] = None
    ean: Optional[str] = None
    mpn: Optional[str] = None
    isbn: Optional[str] = None
    
    primary_unit_id: Optional[UUID] = None
    secondary_unit_id: Optional[UUID] = None
    conversion_rate: Optional[Decimal] = None
    
    length: Optional[Decimal] = None
    width: Optional[Decimal] = None
    height: Optional[Decimal] = None
    dimension_unit_id: Optional[UUID] = None
    weight: Optional[Decimal] = None
    weight_unit_id: Optional[UUID] = None
    
    selling_price: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    sales_description: Optional[str] = None
    sales_tax_rate: Optional[Decimal] = None
    is_taxable: Optional[bool] = None
    
    cost_price: Optional[Decimal] = None
    purchase_description: Optional[str] = None
    purchase_tax_rate: Optional[Decimal] = None
    preferred_vendor_id: Optional[UUID] = None
    
    hsn_code: Optional[str] = None
    
    track_batches: Optional[bool] = None
    track_serials: Optional[bool] = None
    track_expiry: Optional[bool] = None
    has_variants: Optional[bool] = None
    
    reorder_level: Optional[int] = None
    reorder_qty: Optional[int] = None
    min_stock: Optional[int] = None
    max_stock: Optional[int] = None
    lead_time_days: Optional[int] = None
    
    opening_stock: Optional[Decimal] = None
    opening_stock_value: Optional[Decimal] = None
    
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    """Product response with all fields."""
    id: UUID
    tenant_id: UUID
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Joined fields
    category_name: Optional[str] = None
    brand_name: Optional[str] = None
    manufacturer_name: Optional[str] = None
    primary_unit_name: Optional[str] = None
    primary_unit_symbol: Optional[str] = None
    secondary_unit_name: Optional[str] = None
    preferred_vendor_name: Optional[str] = None
    
    # Computed fields (from inventory service)
    stock_on_hand: Optional[Decimal] = None
    stock_value: Optional[Decimal] = None
    
    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    """Paginated product list response."""
    products: list[ProductResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class ProductImportResult(BaseModel):
    """Result of bulk import."""
    success_count: int
    error_count: int
    errors: list[dict]


# ============================================================================
# Brand Models
# ============================================================================

class BrandBase(BaseModel):
    """Base brand fields."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None


class BrandCreate(BrandBase):
    """Create brand request."""
    pass


class BrandUpdate(BaseModel):
    """Update brand request."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None
    is_active: Optional[bool] = None


class BrandResponse(BrandBase):
    """Brand response."""
    id: UUID
    tenant_id: UUID
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Computed
    product_count: Optional[int] = None
    
    class Config:
        from_attributes = True


class BrandListResponse(BaseModel):
    """Paginated brand list."""
    brands: list[BrandResponse]
    total: int
    page: int
    limit: int


# ============================================================================
# Manufacturer Models
# ============================================================================

class ManufacturerBase(BaseModel):
    """Base manufacturer fields."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    contact_info: Optional[str] = None
    website: Optional[str] = None
    country: Optional[str] = None


class ManufacturerCreate(ManufacturerBase):
    """Create manufacturer request."""
    pass


class ManufacturerUpdate(BaseModel):
    """Update manufacturer request."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    contact_info: Optional[str] = None
    website: Optional[str] = None
    country: Optional[str] = None
    is_active: Optional[bool] = None


class ManufacturerResponse(ManufacturerBase):
    """Manufacturer response."""
    id: UUID
    tenant_id: UUID
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ManufacturerListResponse(BaseModel):
    """Paginated manufacturer list."""
    manufacturers: list[ManufacturerResponse]
    total: int
    page: int
    limit: int

