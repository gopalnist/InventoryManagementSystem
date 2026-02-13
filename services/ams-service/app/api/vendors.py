"""Vendor API"""
from fastapi import APIRouter, HTTPException
from typing import List

from shared.db.connection import get_db_cursor
from ..models.vendor import VendorCreate, VendorResponse

router = APIRouter()


@router.get("/", response_model=List[VendorResponse])
async def list_vendors():
    """List all vendors."""
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("""
            SELECT id, vendor_code, vendor_name, is_active, created_at, updated_at
            FROM vendors
            ORDER BY vendor_name
        """)
        return cur.fetchall()


@router.post("/", response_model=VendorResponse)
async def create_vendor(vendor: VendorCreate):
    """Create a new vendor."""
    with get_db_cursor(dict_cursor=True) as cur:
        # Check if vendor code exists
        cur.execute("SELECT id FROM vendors WHERE vendor_code = %s", (vendor.vendor_code.upper(),))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Vendor code already exists")
        
        cur.execute("""
            INSERT INTO vendors (vendor_code, vendor_name, is_active)
            VALUES (%s, %s, %s)
            RETURNING id, vendor_code, vendor_name, is_active, created_at, updated_at
        """, (vendor.vendor_code.upper(), vendor.vendor_name, vendor.is_active))
        
        return cur.fetchone()


@router.get("/{vendor_code}", response_model=VendorResponse)
async def get_vendor(vendor_code: str):
    """Get vendor by code."""
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("""
            SELECT id, vendor_code, vendor_name, is_active, created_at, updated_at
            FROM vendors
            WHERE vendor_code = %s
        """, (vendor_code.upper(),))
        vendor = cur.fetchone()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
        return vendor


