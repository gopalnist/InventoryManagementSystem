"""SKU Mappings API"""
from fastapi import APIRouter, HTTPException, Depends, Header, Query
from typing import List, Optional

from shared.db.connection import get_db_cursor
from ..models.sku_mapping import (
    SKUCreate,
    SKUResponse,
    SKUWithMappingsResponse,
    ChannelMappingCreate,
    ChannelMappingResponse,
)

router = APIRouter()


def get_vendor_id(vendor_code: str = Header(default="NU8FU", alias="X-Vendor-Code")) -> str:
    return vendor_code.upper()


@router.get("/skus", response_model=List[SKUWithMappingsResponse])
async def list_skus(
    vendor_code: str = Depends(get_vendor_id),
    search: Optional[str] = Query(None, description="Search term"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List vendor SKUs with their channel mappings."""
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("SELECT id FROM vendors WHERE vendor_code = %s", (vendor_code,))
        vendor = cur.fetchone()
        if not vendor:
            return []
        vendor_id = vendor["id"]
        
        # Get SKUs
        query = """
            SELECT 
                s.id, s.vendor_id, s.sku_code, s.sku_name, s.ean, s.is_active,
                s.mrp, s.selling_price, s.cost_price, s.currency, s.hsn_code, s.gst_rate,
                s.created_at, s.updated_at
            FROM vendor_skus s
            WHERE s.vendor_id = %s
        """
        params = [vendor_id]
        
        if search:
            query += " AND (s.sku_code ILIKE %s OR s.sku_name ILIKE %s OR s.ean ILIKE %s)"
            search_term = f"%{search}%"
            params.extend([search_term, search_term, search_term])
        
        query += " ORDER BY s.sku_code LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        cur.execute(query, params)
        skus = cur.fetchall()
        
        # Get mappings for each SKU
        result = []
        for sku in skus:
            cur.execute("""
                SELECT channel, channel_item_id_type, channel_item_id
                FROM channel_item_mappings
                WHERE vendor_sku_id = %s
            """, (sku["id"],))
            mappings = cur.fetchall()
            result.append({**sku, "mappings": mappings})
        
        return result


@router.post("/skus", response_model=SKUResponse)
async def create_sku(
    sku: SKUCreate,
    vendor_code: str = Depends(get_vendor_id),
):
    """Create a new SKU."""
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("SELECT id FROM vendors WHERE vendor_code = %s", (vendor_code,))
        vendor = cur.fetchone()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
        vendor_id = vendor["id"]
        
        # Check if exists
        cur.execute("""
            SELECT id FROM vendor_skus 
            WHERE vendor_id = %s AND sku_code = %s
        """, (vendor_id, sku.sku_code))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="SKU code already exists")
        
        cur.execute("""
            INSERT INTO vendor_skus (vendor_id, sku_code, sku_name, ean, is_active)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, vendor_id, sku_code, sku_name, ean, is_active,
                      mrp, selling_price, cost_price, currency, hsn_code, gst_rate,
                      created_at, updated_at
        """, (vendor_id, sku.sku_code, sku.sku_name, sku.ean, sku.is_active))
        
        return cur.fetchone()


@router.get("/skus/{sku_code}", response_model=SKUWithMappingsResponse)
async def get_sku(
    sku_code: str,
    vendor_code: str = Depends(get_vendor_id),
):
    """Get SKU with mappings."""
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("SELECT id FROM vendors WHERE vendor_code = %s", (vendor_code,))
        vendor = cur.fetchone()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
        
        cur.execute("""
            SELECT 
                s.id, s.vendor_id, s.sku_code, s.sku_name, s.ean, s.is_active,
                s.mrp, s.selling_price, s.cost_price, s.currency, s.hsn_code, s.gst_rate,
                s.created_at, s.updated_at
            FROM vendor_skus s
            WHERE s.vendor_id = %s AND s.sku_code = %s
        """, (vendor["id"], sku_code))
        sku = cur.fetchone()
        if not sku:
            raise HTTPException(status_code=404, detail="SKU not found")
        
        cur.execute("""
            SELECT channel, channel_item_id_type, channel_item_id
            FROM channel_item_mappings
            WHERE vendor_sku_id = %s
        """, (sku["id"],))
        mappings = cur.fetchall()
        
        return {**sku, "mappings": mappings}


# Channel Mappings

@router.get("/channel-mappings", response_model=List[ChannelMappingResponse])
async def list_channel_mappings(
    vendor_code: str = Depends(get_vendor_id),
    channel: Optional[str] = Query(None),
    id_type: Optional[str] = Query(None, description="EAN, ASIN, FSN, etc."),
):
    """List channel item mappings."""
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("SELECT id FROM vendors WHERE vendor_code = %s", (vendor_code,))
        vendor = cur.fetchone()
        if not vendor:
            return []
        vendor_id = vendor["id"]
        
        query = """
            SELECT 
                m.id, m.vendor_id, m.vendor_sku_id,
                m.channel, m.channel_item_id_type, m.channel_item_id,
                s.sku_code, s.sku_name,
                m.created_at
            FROM channel_item_mappings m
            JOIN vendor_skus s ON s.id = m.vendor_sku_id
            WHERE m.vendor_id = %s
        """
        params = [vendor_id]
        
        if channel:
            query += " AND m.channel = %s"
            params.append(channel.lower())
        if id_type:
            query += " AND m.channel_item_id_type = %s"
            params.append(id_type.upper())
        
        query += " ORDER BY s.sku_code, m.channel"
        
        cur.execute(query, params)
        return cur.fetchall()


@router.post("/channel-mappings", response_model=ChannelMappingResponse)
async def create_channel_mapping(
    mapping: ChannelMappingCreate,
    vendor_code: str = Depends(get_vendor_id),
):
    """Create a channel mapping for a SKU."""
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("SELECT id FROM vendors WHERE vendor_code = %s", (vendor_code,))
        vendor = cur.fetchone()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
        vendor_id = vendor["id"]
        
        # Get SKU
        cur.execute("""
            SELECT id, sku_code, sku_name FROM vendor_skus 
            WHERE id = %s AND vendor_id = %s
        """, (mapping.vendor_sku_id, vendor_id))
        sku = cur.fetchone()
        if not sku:
            raise HTTPException(status_code=404, detail="SKU not found")
        
        # Create mapping
        cur.execute("""
            INSERT INTO channel_item_mappings 
                (vendor_id, vendor_sku_id, channel, channel_item_id_type, channel_item_id)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (vendor_id, channel, channel_item_id_type, channel_item_id)
            DO UPDATE SET vendor_sku_id = EXCLUDED.vendor_sku_id, updated_at = NOW()
            RETURNING id, vendor_id, vendor_sku_id, channel, channel_item_id_type, channel_item_id, created_at
        """, (
            vendor_id,
            mapping.vendor_sku_id,
            mapping.channel.lower(),
            mapping.channel_item_id_type.upper(),
            mapping.channel_item_id,
        ))
        
        result = cur.fetchone()
        return {
            **result,
            "sku_code": sku["sku_code"],
            "sku_name": sku["sku_name"],
        }


@router.delete("/channel-mappings/{mapping_id}")
async def delete_channel_mapping(
    mapping_id: int,
    vendor_code: str = Depends(get_vendor_id),
):
    """Delete a channel mapping."""
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("SELECT id FROM vendors WHERE vendor_code = %s", (vendor_code,))
        vendor = cur.fetchone()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
        
        cur.execute("""
            DELETE FROM channel_item_mappings 
            WHERE id = %s AND vendor_id = %s
        """, (mapping_id, vendor["id"]))
        
        return {"ok": True}


