"""
Production Order Models
=======================
Pydantic models for production/assembly orders.
"""

from __future__ import annotations

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Literal
from uuid import UUID

from pydantic import BaseModel, Field


# Production Order Status
ProductionStatus = Literal["draft", "pending", "in_progress", "completed", "cancelled"]


# ============================================================================
# Production Order Component Models
# ============================================================================

class ProductionComponentBase(BaseModel):
    """Component material for production."""
    product_id: UUID
    quantity_required: Decimal = Field(...)


class ProductionComponentCreate(ProductionComponentBase):
    """Create production component."""
    pass


class ProductionComponentResponse(ProductionComponentBase):
    """Production component response."""
    id: UUID
    production_order_id: UUID
    quantity_consumed: Decimal = 0
    unit_cost: Optional[Decimal] = None
    total_cost: Optional[Decimal] = None
    is_fulfilled: bool = False
    
    # Joined fields
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    product_unit_name: Optional[str] = None
    available_stock: Optional[Decimal] = None
    
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============================================================================
# Production Order Models
# ============================================================================

class ProductionOrderBase(BaseModel):
    """Base production order fields."""
    bundle_id: UUID
    quantity_ordered: int = Field(..., gt=0)
    expected_date: Optional[date] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class ProductionOrderCreate(ProductionOrderBase):
    """Create production order request."""
    status: ProductionStatus = "draft"


class ProductionOrderUpdate(BaseModel):
    """Update production order request."""
    quantity_ordered: Optional[int] = Field(None, gt=0)
    expected_date: Optional[date] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class ProductionOrderStatusUpdate(BaseModel):
    """Update production order status."""
    status: ProductionStatus
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None


class ProductionOrderResponse(ProductionOrderBase):
    """Production order response."""
    id: UUID
    tenant_id: UUID
    order_number: str
    
    # Quantities
    quantity_produced: int = 0
    
    # Status
    status: ProductionStatus
    
    # Dates
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Cost tracking
    estimated_cost: Optional[Decimal] = None
    actual_cost: Optional[Decimal] = None
    
    # Notes
    cancellation_reason: Optional[str] = None
    
    # Audit
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Joined fields
    bundle_name: Optional[str] = None
    bundle_sku: Optional[str] = None
    
    # Components (optional - included on detail view)
    components: Optional[List[ProductionComponentResponse]] = None
    
    class Config:
        from_attributes = True


class ProductionOrderListResponse(BaseModel):
    """Paginated production order list."""
    orders: list[ProductionOrderResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class ProductionOrderSummary(BaseModel):
    """Summary stats for production orders."""
    total_orders: int
    draft_orders: int
    pending_orders: int
    in_progress_orders: int
    completed_orders: int
    cancelled_orders: int
    total_units_produced: int


# ============================================================================
# Production History Models
# ============================================================================

class ProductionHistoryEntry(BaseModel):
    """Single history entry."""
    id: UUID
    production_order_id: UUID
    action: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    quantity_change: Optional[int] = None
    notes: Optional[str] = None
    performed_by: Optional[UUID] = None
    performed_by_name: Optional[str] = None
    performed_at: datetime
    
    class Config:
        from_attributes = True


class ProductionHistoryResponse(BaseModel):
    """Production history for an order."""
    order_id: UUID
    order_number: str
    history: List[ProductionHistoryEntry]


# ============================================================================
# Production Analytics
# ============================================================================

class ProductionAnalytics(BaseModel):
    """Production analytics data."""
    period: str  # "daily", "weekly", "monthly"
    start_date: date
    end_date: date
    
    total_orders: int
    completed_orders: int
    cancelled_orders: int
    completion_rate: float
    
    total_units_ordered: int
    total_units_produced: int
    fulfillment_rate: float
    
    avg_production_time_hours: Optional[float] = None
    
    by_bundle: List[dict]  # [{bundle_name, orders, units_produced}]


# ============================================================================
# Production Order Actions
# ============================================================================

class StartProductionRequest(BaseModel):
    """Request to start production."""
    notes: Optional[str] = None


class CompleteProductionRequest(BaseModel):
    """Request to complete production."""
    quantity_produced: int = Field(..., ge=0)
    notes: Optional[str] = None


class CancelProductionRequest(BaseModel):
    """Request to cancel production."""
    reason: str


class ConsumeComponentRequest(BaseModel):
    """Request to mark component as consumed."""
    component_id: UUID
    quantity_consumed: Decimal = Field(..., ge=0)

