"""Warehouse models"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class WarehouseBase(BaseModel):
    vendor_warehouse_code: str
    warehouse_name: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    is_active: bool = True


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseResponse(WarehouseBase):
    id: int
    vendor_id: int
    sku_count: int = 0
    total_stock: float = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WarehouseLocationBase(BaseModel):
    location_code: str
    location_name: Optional[str] = None
    is_active: bool = True


class WarehouseLocationCreate(WarehouseLocationBase):
    pass


class WarehouseLocationResponse(WarehouseLocationBase):
    id: int
    vendor_warehouse_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class FulfillmentCenterBase(BaseModel):
    channel: str
    fulfillment_center_code: str
    fulfillment_center_name: Optional[str] = None
    fulfillment_center_type: Optional[str] = None
    is_active: bool = True


class FulfillmentCenterCreate(FulfillmentCenterBase):
    pass


class FulfillmentCenterResponse(FulfillmentCenterBase):
    id: int
    mapped_warehouse_code: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FCMappingCreate(BaseModel):
    channel: str
    fulfillment_center_code: str
    vendor_warehouse_code: str


class FCMappingResponse(BaseModel):
    id: int
    vendor_id: int
    channel: str
    fulfillment_center_code: str
    vendor_warehouse_id: int
    warehouse_code: str
    warehouse_name: str
    created_at: datetime

    class Config:
        from_attributes = True


