"""
Sales Order Models
==================
Pydantic models for Sales Orders, Line Items, and related entities.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


# ============================================================================
# ENUMS
# ============================================================================

class SalesOrderStatus(str, Enum):
    """Sales order status values."""
    DRAFT = "draft"
    PENDING_CONFIRMATION = "pending_confirmation"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    PACKED = "packed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    INVOICED = "invoiced"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"


class LineItemStatus(str, Enum):
    """Line item status values."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PICKING = "picking"
    PACKED = "packed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    INVOICED = "invoiced"
    CANCELLED = "cancelled"
    BACKORDERED = "backordered"
    DROPSHIPPED = "dropshipped"


class Platform(str, Enum):
    """Supported e-commerce platforms."""
    MANUAL = "manual"
    AMAZON = "amazon"
    ZEPTO = "zepto"
    BLINKIT = "blinkit"
    INSTAMART = "instamart"
    BIGBASKET = "bigbasket"


class Priority(str, Enum):
    """Order priority levels."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class DiscountType(str, Enum):
    """Discount type options."""
    PERCENTAGE = "percentage"
    FIXED = "fixed"


# ============================================================================
# ADDRESS MODEL
# ============================================================================

class Address(BaseModel):
    """Address model for billing/shipping addresses."""
    name: Optional[str] = None
    company: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "India"
    pincode: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


# ============================================================================
# FULFILLMENT CENTER MODELS
# ============================================================================

class FulfillmentCenterBase(BaseModel):
    """Base model for fulfillment center."""
    code: str = Field(..., max_length=20)
    name: str = Field(..., max_length=200)
    full_name: Optional[str] = Field(None, max_length=500)
    platform: Platform = Platform.AMAZON
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "India"
    pincode: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None


class FulfillmentCenterCreate(FulfillmentCenterBase):
    """Model for creating a fulfillment center."""
    pass


class FulfillmentCenterUpdate(BaseModel):
    """Model for updating a fulfillment center."""
    code: Optional[str] = Field(None, max_length=20)
    name: Optional[str] = Field(None, max_length=200)
    full_name: Optional[str] = Field(None, max_length=500)
    platform: Optional[Platform] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    pincode: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class FulfillmentCenter(FulfillmentCenterBase):
    """Full fulfillment center model with all fields."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime


class FulfillmentCenterListResponse(BaseModel):
    """Response model for fulfillment center list."""
    fulfillment_centers: list[FulfillmentCenter]
    total: int
    page: int
    limit: int


# ============================================================================
# SALES ORDER LINE ITEM MODELS
# ============================================================================

class SalesOrderItemBase(BaseModel):
    """Base model for sales order line item."""
    product_id: Optional[UUID] = None
    sku: Optional[str] = Field(None, max_length=100)
    product_name: str = Field(..., max_length=500)
    description: Optional[str] = None
    
    # Platform identifiers
    asin: Optional[str] = Field(None, max_length=20)
    external_id: Optional[str] = Field(None, max_length=100)
    external_id_type: Optional[str] = Field(None, max_length=20)
    
    # Quantities
    quantity_ordered: Decimal = Field(..., ge=0)
    quantity_confirmed: Optional[Decimal] = Field(None, ge=0)
    
    # Unit
    unit_id: Optional[UUID] = None
    unit_symbol: Optional[str] = Field(None, max_length=20)
    item_package_quantity: int = 1
    
    # Pricing
    list_price: Optional[Decimal] = Field(None, ge=0)
    unit_price: Decimal = Field(..., ge=0)
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0)
    discount_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    tax_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0)
    line_total: Decimal = Field(..., ge=0)
    
    # Line item status
    status: LineItemStatus = LineItemStatus.PENDING
    
    # Sequence
    line_number: int = Field(..., ge=1)
    
    # Notes
    notes: Optional[str] = None


class SalesOrderItemCreate(SalesOrderItemBase):
    """Model for creating a sales order line item."""
    pass


class SalesOrderItemUpdate(BaseModel):
    """Model for updating a sales order line item."""
    product_id: Optional[UUID] = None
    sku: Optional[str] = None
    product_name: Optional[str] = None
    description: Optional[str] = None
    asin: Optional[str] = None
    external_id: Optional[str] = None
    external_id_type: Optional[str] = None
    quantity_ordered: Optional[Decimal] = None
    quantity_confirmed: Optional[Decimal] = None
    quantity_shipped: Optional[Decimal] = None
    quantity_delivered: Optional[Decimal] = None
    quantity_cancelled: Optional[Decimal] = None
    unit_id: Optional[UUID] = None
    unit_symbol: Optional[str] = None
    list_price: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    discount_percentage: Optional[Decimal] = None
    tax_percentage: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    line_total: Optional[Decimal] = None
    status: Optional[LineItemStatus] = None
    line_number: Optional[int] = None
    notes: Optional[str] = None


class SalesOrderItem(SalesOrderItemBase):
    """Full sales order line item model."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    sales_order_id: UUID
    quantity_shipped: Decimal = Decimal("0")
    quantity_delivered: Decimal = Decimal("0")
    quantity_cancelled: Decimal = Decimal("0")
    quantity_returned: Decimal = Decimal("0")
    quantity_invoiced: Decimal = Decimal("0")
    warehouse_id: Optional[UUID] = None
    warehouse_name: Optional[str] = None
    bin_location: Optional[str] = None
    lot_number: Optional[str] = None
    serial_numbers: Optional[list[str]] = None
    expiry_date: Optional[date] = None
    is_dropship: bool = False
    dropship_vendor_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


# ============================================================================
# SALES ORDER MODELS
# ============================================================================

class SalesOrderBase(BaseModel):
    """Base model for sales order."""
    # Reference numbers
    reference_number: Optional[str] = Field(None, max_length=100)
    platform_order_id: Optional[str] = Field(None, max_length=100)
    
    # Customer/Platform
    customer_id: Optional[UUID] = None
    platform: Platform = Platform.MANUAL
    platform_vendor_code: Optional[str] = Field(None, max_length=50)
    
    # Fulfillment
    fulfillment_center_id: Optional[UUID] = None
    fulfillment_center_code: Optional[str] = Field(None, max_length=50)
    fulfillment_center_name: Optional[str] = Field(None, max_length=200)
    
    # Dates
    order_date: date = Field(default_factory=date.today)
    expected_shipment_date: Optional[date] = None
    delivery_window_start: Optional[date] = None
    delivery_window_end: Optional[date] = None
    
    # Addresses
    billing_address: Optional[Address] = None
    shipping_address: Optional[Address] = None
    
    # Status
    status: SalesOrderStatus = SalesOrderStatus.DRAFT
    availability_status: Optional[str] = None
    
    # Financial
    currency_code: str = "INR"
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0)
    discount_type: Optional[DiscountType] = None
    discount_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    shipping_charges: Decimal = Field(default=Decimal("0"), ge=0)
    adjustment: Decimal = Field(default=Decimal("0"))
    adjustment_description: Optional[str] = Field(None, max_length=200)
    
    # Payment & Terms
    payment_terms: Optional[str] = Field(None, max_length=50)
    payment_method: Optional[str] = Field(None, max_length=50)
    freight_terms: Optional[str] = Field(None, max_length=50)
    
    # Assignment
    salesperson_id: Optional[UUID] = None
    salesperson_name: Optional[str] = Field(None, max_length=200)
    
    # Notes
    notes: Optional[str] = None
    terms_conditions: Optional[str] = None
    internal_notes: Optional[str] = None
    
    # Platform metadata
    platform_metadata: Optional[dict[str, Any]] = Field(default_factory=dict)
    
    # Flags
    priority: Priority = Priority.NORMAL
    is_back_order: bool = False
    is_dropship: bool = False


class SalesOrderCreate(SalesOrderBase):
    """Model for creating a sales order."""
    items: Optional[list[SalesOrderItemCreate]] = None


class SalesOrderUpdate(BaseModel):
    """Model for updating a sales order."""
    reference_number: Optional[str] = None
    platform_order_id: Optional[str] = None
    customer_id: Optional[UUID] = None
    platform: Optional[Platform] = None
    platform_vendor_code: Optional[str] = None
    fulfillment_center_id: Optional[UUID] = None
    fulfillment_center_code: Optional[str] = None
    fulfillment_center_name: Optional[str] = None
    order_date: Optional[date] = None
    expected_shipment_date: Optional[date] = None
    delivery_window_start: Optional[date] = None
    delivery_window_end: Optional[date] = None
    billing_address: Optional[Address] = None
    shipping_address: Optional[Address] = None
    status: Optional[SalesOrderStatus] = None
    availability_status: Optional[str] = None
    discount_amount: Optional[Decimal] = None
    discount_type: Optional[DiscountType] = None
    discount_percentage: Optional[Decimal] = None
    shipping_charges: Optional[Decimal] = None
    adjustment: Optional[Decimal] = None
    adjustment_description: Optional[str] = None
    payment_terms: Optional[str] = None
    payment_method: Optional[str] = None
    freight_terms: Optional[str] = None
    salesperson_id: Optional[UUID] = None
    salesperson_name: Optional[str] = None
    notes: Optional[str] = None
    terms_conditions: Optional[str] = None
    internal_notes: Optional[str] = None
    platform_metadata: Optional[dict[str, Any]] = None
    priority: Optional[Priority] = None
    is_back_order: Optional[bool] = None
    is_dropship: Optional[bool] = None


class SalesOrder(SalesOrderBase):
    """Full sales order model with all fields."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    tenant_id: UUID
    order_number: str
    
    # Calculated fields
    subtotal: Decimal = Decimal("0")
    tax_amount: Decimal = Decimal("0")
    total_amount: Decimal = Decimal("0")
    total_items: int = 0
    total_quantity: Decimal = Decimal("0")
    
    # Actual dates
    actual_shipment_date: Optional[date] = None
    actual_delivery_date: Optional[date] = None
    
    # Audit
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None
    
    # Related data (optional, loaded on demand)
    items: Optional[list[SalesOrderItem]] = None
    customer_name: Optional[str] = None


class SalesOrderListResponse(BaseModel):
    """Response model for sales order list."""
    sales_orders: list[SalesOrder]
    total: int
    page: int
    limit: int


class SalesOrderSummary(BaseModel):
    """Summary model for sales order (used in lists)."""
    id: UUID
    order_number: str
    reference_number: Optional[str] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    platform: Platform
    fulfillment_center_name: Optional[str] = None
    order_date: date
    status: SalesOrderStatus
    total_amount: Decimal
    total_items: int
    priority: Priority
    created_at: datetime


# ============================================================================
# STATUS HISTORY MODELS
# ============================================================================

class SalesOrderStatusHistory(BaseModel):
    """Sales order status history entry."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    sales_order_id: UUID
    previous_status: Optional[str] = None
    new_status: str
    changed_by: Optional[UUID] = None
    changed_by_name: Optional[str] = None
    changed_at: datetime
    notes: Optional[str] = None
    synced_to_platform: bool = False
    platform_sync_time: Optional[datetime] = None


# ============================================================================
# STATS MODELS
# ============================================================================

class SalesOrderStats(BaseModel):
    """Sales order statistics."""
    total_orders: int = 0
    draft_count: int = 0
    confirmed_count: int = 0
    processing_count: int = 0
    shipped_count: int = 0
    delivered_count: int = 0
    cancelled_count: int = 0
    total_revenue: Decimal = Decimal("0")
    orders_today: int = 0
    orders_this_week: int = 0
    orders_this_month: int = 0


class SalesOrderStatsByPlatform(BaseModel):
    """Sales order statistics by platform."""
    platform: Platform
    order_count: int
    total_amount: Decimal


class SalesOrderStatsByStatus(BaseModel):
    """Sales order statistics by status."""
    status: SalesOrderStatus
    order_count: int
    total_amount: Decimal




