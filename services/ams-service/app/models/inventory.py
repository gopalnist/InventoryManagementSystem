"""Inventory models"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class InventoryItemBase(BaseModel):
    vendor_warehouse_id: int
    vendor_sku_id: int
    on_hand_qty: float = 0
    reserved_qty: float = 0


class InventoryItemResponse(BaseModel):
    id: int
    vendor_id: int
    warehouse_code: str
    warehouse_name: str
    sku_code: str
    sku_name: Optional[str] = None
    on_hand_qty: float
    reserved_qty: float
    available_qty: float
    updated_at: datetime

    class Config:
        from_attributes = True


class InventoryUploadResponse(BaseModel):
    ok: bool
    upload_id: int
    total_rows: int = 0
    accepted_rows: int = 0
    rejected_rows: int = 0
    error_report_path: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None


class InventoryStatsResponse(BaseModel):
    total_skus: int = 0
    total_warehouses: int = 0
    total_on_hand: float = 0
    total_reserved: float = 0
    total_available: float = 0


