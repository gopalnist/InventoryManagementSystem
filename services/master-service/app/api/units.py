"""
Units API Routes
================
CRUD operations for units of measurement.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query, Header

# Add shared to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent.parent))

from shared.db import get_db_cursor

from ..models.unit import (
    UnitCreate,
    UnitUpdate,
    UnitResponse,
    PREDEFINED_UNITS,
)

router = APIRouter()


# --- Helper Functions ---

def get_tenant_id(x_tenant_id: str = Header(...)) -> UUID:
    """Extract tenant ID from header."""
    try:
        return UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant ID")


# --- API Endpoints ---

@router.get("")
async def list_units(
    x_tenant_id: str = Header(...),
    unit_type: Optional[str] = Query(None, description="Filter by type"),
    include_inactive: bool = Query(False),
):
    """List all units for the tenant."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        query = """
            SELECT id, tenant_id, name, symbol, unit_type, is_active, created_at
            FROM units
            WHERE tenant_id = %s
        """
        params = [str(tenant_id)]
        
        if unit_type:
            query += " AND unit_type = %s"
            params.append(unit_type)
        
        if not include_inactive:
            query += " AND is_active = true"
        
        query += " ORDER BY unit_type, name"
        
        cur.execute(query, params)
        rows = cur.fetchall()
        
        return {
            "units": [UnitResponse(**dict(row)) for row in rows],
            "total": len(rows)
        }


@router.get("/predefined")
async def get_predefined_units():
    """Get list of predefined units for quick setup."""
    return {"units": PREDEFINED_UNITS}


@router.post("/setup-defaults", status_code=201)
async def setup_default_units(
    x_tenant_id: str = Header(...),
):
    """
    Create all predefined units for the tenant.
    
    Useful for initial setup.
    """
    tenant_id = get_tenant_id(x_tenant_id)
    
    created = 0
    skipped = 0
    
    with get_db_cursor() as cur:
        for unit in PREDEFINED_UNITS:
            # Check if exists
            cur.execute(
                "SELECT id FROM units WHERE tenant_id = %s AND symbol = %s",
                (str(tenant_id), unit["symbol"])
            )
            if cur.fetchone():
                skipped += 1
                continue
            
            # Create
            cur.execute(
                """
                INSERT INTO units (id, tenant_id, name, symbol, unit_type, is_active, created_at)
                VALUES (%s, %s, %s, %s, %s, true, NOW())
                """,
                (str(uuid4()), str(tenant_id), unit["name"], unit["symbol"], unit["unit_type"])
            )
            created += 1
    
    return {
        "message": f"Created {created} units, skipped {skipped} existing",
        "created": created,
        "skipped": skipped
    }


@router.get("/{unit_id}", response_model=UnitResponse)
async def get_unit(
    unit_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Get a single unit by ID."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT id, tenant_id, name, symbol, unit_type, is_active, created_at
            FROM units
            WHERE id = %s AND tenant_id = %s
            """,
            (str(unit_id), str(tenant_id))
        )
        row = cur.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Unit not found")
        
        return UnitResponse(**dict(row))


@router.post("", response_model=UnitResponse, status_code=201)
async def create_unit(
    data: UnitCreate,
    x_tenant_id: str = Header(...),
):
    """Create a new unit."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check for duplicate symbol
        cur.execute(
            "SELECT id FROM units WHERE tenant_id = %s AND symbol = %s",
            (str(tenant_id), data.symbol)
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Unit with this symbol already exists")
        
        # Insert
        unit_id = uuid4()
        cur.execute(
            """
            INSERT INTO units (id, tenant_id, name, symbol, unit_type, is_active, created_at)
            VALUES (%s, %s, %s, %s, %s, true, NOW())
            RETURNING id, tenant_id, name, symbol, unit_type, is_active, created_at
            """,
            (str(unit_id), str(tenant_id), data.name, data.symbol, data.unit_type)
        )
        row = cur.fetchone()
        
        return UnitResponse(**dict(row))


@router.put("/{unit_id}", response_model=UnitResponse)
async def update_unit(
    unit_id: UUID,
    data: UnitUpdate,
    x_tenant_id: str = Header(...),
):
    """Update an existing unit."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check exists
        cur.execute(
            "SELECT id FROM units WHERE id = %s AND tenant_id = %s",
            (str(unit_id), str(tenant_id))
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Unit not found")
        
        # Build update query
        updates = []
        params = []
        
        if data.name is not None:
            updates.append("name = %s")
            params.append(data.name)
        if data.symbol is not None:
            updates.append("symbol = %s")
            params.append(data.symbol)
        if data.unit_type is not None:
            updates.append("unit_type = %s")
            params.append(data.unit_type)
        if data.is_active is not None:
            updates.append("is_active = %s")
            params.append(data.is_active)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        params.extend([str(unit_id), str(tenant_id)])
        
        cur.execute(
            f"""
            UPDATE units 
            SET {', '.join(updates)}
            WHERE id = %s AND tenant_id = %s
            RETURNING id, tenant_id, name, symbol, unit_type, is_active, created_at
            """,
            params
        )
        row = cur.fetchone()
        
        return UnitResponse(**dict(row))


@router.delete("/{unit_id}", status_code=204)
async def delete_unit(
    unit_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Delete a unit."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check if used by items
        cur.execute(
            """
            SELECT id FROM items 
            WHERE (primary_unit_id = %s OR secondary_unit_id = %s) AND tenant_id = %s
            LIMIT 1
            """,
            (str(unit_id), str(unit_id), str(tenant_id))
        )
        if cur.fetchone():
            raise HTTPException(
                status_code=409,
                detail="Cannot delete unit used by items"
            )
        
        # Delete
        cur.execute(
            "DELETE FROM units WHERE id = %s AND tenant_id = %s",
            (str(unit_id), str(tenant_id))
        )
        
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Unit not found")




