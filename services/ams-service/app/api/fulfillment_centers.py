"""Fulfillment Centers API"""
from fastapi import APIRouter, HTTPException, Depends, Header, Query
from typing import List, Optional

from shared.db.connection import get_db_cursor
from ..models.warehouse import (
    FulfillmentCenterCreate,
    FulfillmentCenterResponse,
    FCMappingCreate,
    FCMappingResponse,
)

router = APIRouter()


def get_vendor_id(vendor_code: str = Header(default="NU8FU", alias="X-Vendor-Code")) -> str:
    return vendor_code.upper()


@router.get("/", response_model=List[FulfillmentCenterResponse])
async def list_fulfillment_centers(
    channel: Optional[str] = Query(None, description="Filter by channel"),
    vendor_code: str = Depends(get_vendor_id),
):
    """List fulfillment centers."""
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("SELECT id FROM vendors WHERE vendor_code = %s", (vendor_code,))
        vendor = cur.fetchone()
        vendor_id = vendor["id"] if vendor else None
        
        query = """
            SELECT 
                fc.id, fc.channel, fc.fulfillment_center_code, 
                fc.fulfillment_center_name, fc.fulfillment_center_type,
                fc.is_active, fc.created_at,
                (
                    SELECT w.vendor_warehouse_code 
                    FROM warehouse_fulfillment_center_mappings m
                    JOIN vendor_warehouses w ON w.id = m.vendor_warehouse_id
                    WHERE m.channel = fc.channel 
                      AND m.fulfillment_center_code = fc.fulfillment_center_code
                      AND m.vendor_id = %s
                    LIMIT 1
                ) as mapped_warehouse_code
            FROM channel_fulfillment_centers fc
            WHERE 1=1
        """
        params = [vendor_id]
        
        if channel:
            query += " AND fc.channel = %s"
            params.append(channel.lower())
        
        query += " ORDER BY fc.channel, fc.fulfillment_center_code"
        
        cur.execute(query, params)
        return cur.fetchall()


@router.post("/", response_model=FulfillmentCenterResponse)
async def create_fulfillment_center(fc: FulfillmentCenterCreate):
    """Create or update a fulfillment center."""
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("""
            INSERT INTO channel_fulfillment_centers 
                (channel, fulfillment_center_code, fulfillment_center_name, 
                 fulfillment_center_type, is_active)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (channel, fulfillment_center_code) 
            DO UPDATE SET
                fulfillment_center_name = EXCLUDED.fulfillment_center_name,
                fulfillment_center_type = EXCLUDED.fulfillment_center_type,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
            RETURNING id, channel, fulfillment_center_code, fulfillment_center_name,
                      fulfillment_center_type, is_active, created_at
        """, (
            fc.channel.lower(),
            fc.fulfillment_center_code,
            fc.fulfillment_center_name,
            fc.fulfillment_center_type,
            fc.is_active,
        ))
        result = cur.fetchone()
        return {**result, "mapped_warehouse_code": None}


# FC Mappings

@router.get("/mappings", response_model=List[FCMappingResponse])
async def list_fc_mappings(
    channel: Optional[str] = Query(None, description="Filter by channel"),
    vendor_code: str = Depends(get_vendor_id),
):
    """List FC to warehouse mappings."""
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("SELECT id FROM vendors WHERE vendor_code = %s", (vendor_code,))
        vendor = cur.fetchone()
        if not vendor:
            return []
        vendor_id = vendor["id"]
        
        query = """
            SELECT 
                m.id, m.vendor_id, m.channel, m.fulfillment_center_code,
                m.vendor_warehouse_id, 
                w.vendor_warehouse_code as warehouse_code,
                w.warehouse_name,
                m.created_at
            FROM warehouse_fulfillment_center_mappings m
            JOIN vendor_warehouses w ON w.id = m.vendor_warehouse_id
            WHERE m.vendor_id = %s
        """
        params = [vendor_id]
        
        if channel:
            query += " AND m.channel = %s"
            params.append(channel.lower())
        
        query += " ORDER BY m.channel, m.fulfillment_center_code"
        
        cur.execute(query, params)
        return cur.fetchall()


@router.post("/mappings", response_model=FCMappingResponse)
async def create_fc_mapping(
    mapping: FCMappingCreate,
    vendor_code: str = Depends(get_vendor_id),
):
    """Create a mapping between FC and warehouse."""
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("SELECT id FROM vendors WHERE vendor_code = %s", (vendor_code,))
        vendor = cur.fetchone()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
        vendor_id = vendor["id"]
        
        # Get warehouse
        cur.execute("""
            SELECT id, warehouse_name FROM vendor_warehouses 
            WHERE vendor_id = %s AND vendor_warehouse_code = %s
        """, (vendor_id, mapping.vendor_warehouse_code))
        warehouse = cur.fetchone()
        if not warehouse:
            raise HTTPException(status_code=404, detail="Warehouse not found")
        
        # Ensure FC exists
        cur.execute("""
            INSERT INTO channel_fulfillment_centers 
                (channel, fulfillment_center_code, fulfillment_center_name, is_active)
            VALUES (%s, %s, %s, TRUE)
            ON CONFLICT (channel, fulfillment_center_code) DO NOTHING
        """, (mapping.channel.lower(), mapping.fulfillment_center_code, mapping.fulfillment_center_code))
        
        # Create mapping
        cur.execute("""
            INSERT INTO warehouse_fulfillment_center_mappings 
                (vendor_id, vendor_warehouse_id, channel, fulfillment_center_code)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (vendor_id, channel, fulfillment_center_code, vendor_warehouse_id)
            DO UPDATE SET updated_at = NOW()
            RETURNING id, vendor_id, channel, fulfillment_center_code, vendor_warehouse_id, created_at
        """, (vendor_id, warehouse["id"], mapping.channel.lower(), mapping.fulfillment_center_code))
        
        result = cur.fetchone()
        return {
            **result,
            "warehouse_code": mapping.vendor_warehouse_code,
            "warehouse_name": warehouse["warehouse_name"],
        }


@router.delete("/mappings/{mapping_id}")
async def delete_fc_mapping(
    mapping_id: int,
    vendor_code: str = Depends(get_vendor_id),
):
    """Delete an FC mapping."""
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("SELECT id FROM vendors WHERE vendor_code = %s", (vendor_code,))
        vendor = cur.fetchone()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
        
        cur.execute("""
            DELETE FROM warehouse_fulfillment_center_mappings 
            WHERE id = %s AND vendor_id = %s
        """, (mapping_id, vendor["id"]))
        
        return {"ok": True}


