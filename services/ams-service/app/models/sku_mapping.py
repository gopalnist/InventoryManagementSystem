"""SKU Mapping models"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class SKUBase(BaseModel):
    sku_code: str
    sku_name: Optional[str] = None
    ean: Optional[str] = None
    is_active: bool = True


class SKUCreate(SKUBase):
    pass


class SKUResponse(SKUBase):
    id: int
    vendor_id: int
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    cost_price: Optional[float] = None
    currency: Optional[str] = None
    hsn_code: Optional[str] = None
    gst_rate: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChannelMappingBase(BaseModel):
    channel: str
    channel_item_id_type: str  # EAN, ASIN, FSN, MERCHANT_SKU, etc.
    channel_item_id: str


class ChannelMappingCreate(ChannelMappingBase):
    vendor_sku_id: int


class ChannelMappingResponse(ChannelMappingBase):
    id: int
    vendor_id: int
    vendor_sku_id: int
    sku_code: str
    sku_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SKUWithMappingsResponse(SKUResponse):
    mappings: List[ChannelMappingBase] = []


