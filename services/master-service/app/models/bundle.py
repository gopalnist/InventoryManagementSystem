"""
Product Bundle Models
=====================
Pydantic models for product bundles (composite products) and their components.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================================
# Bundle Component Models
# ============================================================================

class BundleComponentBase(BaseModel):
    """Base component fields."""
    product_id: Optional[UUID] = None  # Reference to product
    component_bundle_id: Optional[UUID] = None  # Reference to another bundle (nested)
    quantity: Decimal = Field(default=1)
    unit_cost: Optional[Decimal] = Field(None)
    notes: Optional[str] = None
    sort_order: int = 0


class BundleComponentCreate(BundleComponentBase):
    """Create component request."""
    pass


class BundleComponentUpdate(BaseModel):
    """Update component request."""
    quantity: Optional[Decimal] = None
    unit_cost: Optional[Decimal] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None


class BundleComponentResponse(BundleComponentBase):
    """Component response with computed fields."""
    id: UUID
    bundle_id: UUID
    line_cost: Optional[Decimal] = None
    
    # Joined fields (from product)
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    product_unit_name: Optional[str] = None
    
    # If component is another bundle
    component_bundle_name: Optional[str] = None
    component_bundle_sku: Optional[str] = None
    
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ============================================================================
# Product Bundle Models
# ============================================================================

class ProductBundleBase(BaseModel):
    """Base bundle fields."""
    sku: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    
    # Classification
    category_id: Optional[UUID] = None
    brand_id: Optional[UUID] = None
    
    # Unit (how the bundle is sold)
    unit_id: Optional[UUID] = None
    
    # Pricing
    auto_calculate_cost: bool = True
    additional_cost: Optional[Decimal] = Field(default=0)
    selling_price: Optional[Decimal] = Field(None)
    mrp: Optional[Decimal] = Field(None)
    
    # Tax
    hsn_code: Optional[str] = Field(None, max_length=20)
    tax_rate: Optional[Decimal] = Field(None)
    
    # Inventory
    reorder_level: int = 0
    
    # Image
    image_url: Optional[str] = None


class ProductBundleCreate(ProductBundleBase):
    """Create bundle request - can include components."""
    components: Optional[List[BundleComponentCreate]] = None


class ProductBundleUpdate(BaseModel):
    """Update bundle request."""
    sku: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category_id: Optional[UUID] = None
    brand_id: Optional[UUID] = None
    unit_id: Optional[UUID] = None
    auto_calculate_cost: Optional[bool] = None
    additional_cost: Optional[Decimal] = None
    total_cost: Optional[Decimal] = None  # For manual override
    selling_price: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    hsn_code: Optional[str] = None
    tax_rate: Optional[Decimal] = None
    reorder_level: Optional[int] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None


class ProductBundleResponse(ProductBundleBase):
    """Bundle response with all fields."""
    id: UUID
    tenant_id: UUID
    
    # Computed costs
    total_component_cost: Optional[Decimal] = None
    total_cost: Optional[Decimal] = None
    
    # Status
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Joined fields
    category_name: Optional[str] = None
    brand_name: Optional[str] = None
    unit_name: Optional[str] = None
    unit_symbol: Optional[str] = None
    
    # Components (optional - included on detail view)
    components: Optional[List[BundleComponentResponse]] = None
    component_count: Optional[int] = None
    
    # Inventory (from inventory service)
    stock_on_hand: Optional[int] = None
    
    class Config:
        from_attributes = True


class ProductBundleListResponse(BaseModel):
    """Paginated bundle list response."""
    bundles: list[ProductBundleResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class ProductBundleSummary(BaseModel):
    """Summary stats for bundles."""
    total_bundles: int
    active_bundles: int
    low_stock_bundles: int
    total_component_value: Decimal


# ============================================================================
# Bundle Cost Calculation
# ============================================================================

class BundleCostBreakdown(BaseModel):
    """Detailed cost breakdown for a bundle."""
    bundle_id: UUID
    components: List[dict]  # List of {product_name, quantity, unit_cost, line_cost}
    total_component_cost: Decimal
    additional_cost: Decimal
    total_cost: Decimal
    suggested_selling_price: Optional[Decimal] = None  # e.g., with 30% margin

