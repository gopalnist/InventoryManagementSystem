"""Purchase Order models"""
from datetime import datetime
from enum import Enum
from typing import Optional, List, Any
from pydantic import BaseModel


class POStatus(str, Enum):
    RECEIVED = "RECEIVED"
    NORMALIZED = "NORMALIZED"
    VALIDATED = "VALIDATED"
    FAILED_NORMALIZATION = "FAILED_NORMALIZATION"
    FAILED_VALIDATION = "FAILED_VALIDATION"


class POFulfillmentStatus(str, Enum):
    FULFILLED = "FULFILLED"
    PARTIAL_FULFILLED = "PARTIAL_FULFILLED"
    NONE = "NONE"


class LineStatus(str, Enum):
    FULFILLED = "FULFILLED"
    PARTIAL_FULFILLED = "PARTIAL_FULFILLED"
    NONE = "NONE"


class POLineBase(BaseModel):
    line_number: str
    ordered_qty: float
    channel_item_id_type: Optional[str] = None
    channel_item_id: Optional[str] = None
    item_name: Optional[str] = None


class POLineResponse(POLineBase):
    id: int
    vendor_sku_id: Optional[int] = None
    vendor_sku_code: Optional[str] = None
    available_qty: Optional[float] = None
    allocatable_qty: Optional[float] = None
    unallocatable_qty: Optional[float] = None
    line_status: Optional[str] = None
    reason: Optional[str] = None
    inventory_scope: Optional[str] = None
    validated_warehouse_code: Optional[str] = None

    class Config:
        from_attributes = True


class POBase(BaseModel):
    channel: str
    po_number: str
    fulfillment_center_code: Optional[str] = None


class POCreate(POBase):
    po_date: Optional[datetime] = None


class POResponse(POBase):
    id: int
    vendor_id: int
    status: str
    po_status: Optional[str] = None
    is_cancelled: bool = False
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    validated_at: Optional[datetime] = None
    source_filename: Optional[str] = None
    validation_report_path: Optional[str] = None
    line_count: int = 0

    class Config:
        from_attributes = True


class PODetailResponse(POResponse):
    lines: List[POLineResponse] = []


class POUploadResponse(BaseModel):
    ok: bool
    po_ids: List[int] = []
    message: Optional[str] = None
    error: Optional[str] = None


class POValidateResponse(BaseModel):
    ok: bool
    po_status: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None


class POStatsResponse(BaseModel):
    total_pos: int = 0
    validated_pos: int = 0
    pending_pos: int = 0
    fulfilled_pos: int = 0
    partial_pos: int = 0
    none_pos: int = 0
    cancelled_pos: int = 0


