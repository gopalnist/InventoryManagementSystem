"""
Parties API Routes (Suppliers & Customers)
==========================================
CRUD operations for parties.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional
from uuid import UUID, uuid4
import math

from fastapi import APIRouter, HTTPException, Query, Header

# Add shared to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent.parent))

from shared.db import get_db_cursor
from shared.utils import generate_code

from ..models.party import (
    PartyType,
    PartyCreate,
    PartyUpdate,
    PartyResponse,
    PartyListResponse,
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

@router.get("", response_model=PartyListResponse)
async def list_parties(
    x_tenant_id: str = Header(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    party_type: Optional[PartyType] = Query(None, description="Filter by type"),
    search: Optional[str] = Query(None, description="Search by name or code"),
    is_active: Optional[bool] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
):
    """List all parties (suppliers and customers)."""
    tenant_id = get_tenant_id(x_tenant_id)
    offset = (page - 1) * limit
    
    with get_db_cursor() as cur:
        # Base query
        base_query = """
            FROM parties
            WHERE tenant_id = %s
        """
        params = [str(tenant_id)]
        
        # Filters
        if party_type:
            if party_type == PartyType.SUPPLIER:
                base_query += " AND party_type IN ('supplier', 'both')"
            elif party_type == PartyType.CUSTOMER:
                base_query += " AND party_type IN ('customer', 'both')"
            else:
                base_query += " AND party_type = %s"
                params.append(party_type.value)
        
        if search:
            base_query += " AND (party_code ILIKE %s OR party_name ILIKE %s)"
            params.extend([f"%{search}%", f"%{search}%"])
        
        if is_active is not None:
            base_query += " AND is_active = %s"
            params.append(is_active)
        
        # Count total
        cur.execute(f"SELECT COUNT(*) {base_query}", params)
        total = cur.fetchone()["count"]
        
        # Get paginated results
        allowed_sort_fields = ["party_code", "party_name", "created_at", "city"]
        if sort_by not in allowed_sort_fields:
            sort_by = "created_at"
        
        select_query = f"""
            SELECT id, tenant_id, party_code, party_name, party_type,
                contact_person, email, phone,
                address, city, state, pincode, country,
                gstin, pan, payment_terms, credit_limit, credit_days,
                lead_time_days, customer_group,
                is_active, created_at, updated_at
            {base_query}
            ORDER BY {sort_by} {sort_order}
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])
        
        cur.execute(select_query, params)
        rows = cur.fetchall()
        
        parties = [PartyResponse(**dict(row)) for row in rows]
        total_pages = math.ceil(total / limit) if total > 0 else 0
        
        return PartyListResponse(
            parties=parties,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages
        )


# Convenience endpoints for suppliers and customers

@router.get("/suppliers")
async def list_suppliers(
    x_tenant_id: str = Header(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
):
    """List suppliers only."""
    return await list_parties(
        x_tenant_id=x_tenant_id,
        page=page,
        limit=limit,
        party_type=PartyType.SUPPLIER,
        search=search,
        is_active=True,
        sort_by="party_name",
        sort_order="asc"
    )


@router.get("/customers")
async def list_customers(
    x_tenant_id: str = Header(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
):
    """List customers only."""
    return await list_parties(
        x_tenant_id=x_tenant_id,
        page=page,
        limit=limit,
        party_type=PartyType.CUSTOMER,
        search=search,
        is_active=True,
        sort_by="party_name",
        sort_order="asc"
    )


@router.get("/{party_id}", response_model=PartyResponse)
async def get_party(
    party_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Get a single party by ID."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT id, tenant_id, party_code, party_name, party_type,
                contact_person, email, phone,
                address, city, state, pincode, country,
                gstin, pan, payment_terms, credit_limit, credit_days,
                lead_time_days, customer_group,
                is_active, created_at, updated_at
            FROM parties
            WHERE id = %s AND tenant_id = %s
            """,
            (str(party_id), str(tenant_id))
        )
        row = cur.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Party not found")
        
        return PartyResponse(**dict(row))


@router.post("", response_model=PartyResponse, status_code=201)
async def create_party(
    data: PartyCreate,
    x_tenant_id: str = Header(...),
):
    """Create a new party (supplier or customer)."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Generate party code if not provided
        party_code = data.party_code
        if not party_code:
            prefix = "SUP" if data.party_type == PartyType.SUPPLIER else "CUS"
            party_code = generate_code(prefix)
        
        # Check for duplicate code
        cur.execute(
            "SELECT id FROM parties WHERE tenant_id = %s AND party_code = %s",
            (str(tenant_id), party_code)
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Party with this code already exists")
        
        # Insert
        party_id = uuid4()
        cur.execute(
            """
            INSERT INTO parties (
                id, tenant_id, party_code, party_name, party_type,
                contact_person, email, phone,
                address, city, state, pincode, country,
                gstin, pan, payment_terms, credit_limit, credit_days,
                lead_time_days, customer_group,
                is_active, created_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s,
                true, NOW()
            )
            RETURNING id, tenant_id, party_code, party_name, party_type,
                contact_person, email, phone,
                address, city, state, pincode, country,
                gstin, pan, payment_terms, credit_limit, credit_days,
                lead_time_days, customer_group,
                is_active, created_at, updated_at
            """,
            (
                str(party_id), str(tenant_id), party_code, data.party_name, data.party_type.value,
                data.contact_person, data.email, data.phone,
                data.address, data.city, data.state, data.pincode, data.country,
                data.gstin, data.pan, data.payment_terms, data.credit_limit, data.credit_days,
                data.lead_time_days, data.customer_group,
            )
        )
        row = cur.fetchone()
        
        return PartyResponse(**dict(row))


@router.put("/{party_id}", response_model=PartyResponse)
async def update_party(
    party_id: UUID,
    data: PartyUpdate,
    x_tenant_id: str = Header(...),
):
    """Update an existing party."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check exists
        cur.execute(
            "SELECT id FROM parties WHERE id = %s AND tenant_id = %s",
            (str(party_id), str(tenant_id))
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Party not found")
        
        # Build update query
        updates = []
        params = []
        
        update_fields = data.model_dump(exclude_unset=True)
        
        for field, value in update_fields.items():
            if value is not None:
                if field == "party_type":
                    updates.append(f"{field} = %s")
                    params.append(value.value if hasattr(value, 'value') else value)
                else:
                    updates.append(f"{field} = %s")
                    params.append(value)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        updates.append("updated_at = NOW()")
        params.extend([str(party_id), str(tenant_id)])
        
        cur.execute(
            f"""
            UPDATE parties 
            SET {', '.join(updates)}
            WHERE id = %s AND tenant_id = %s
            RETURNING id, tenant_id, party_code, party_name, party_type,
                contact_person, email, phone,
                address, city, state, pincode, country,
                gstin, pan, payment_terms, credit_limit, credit_days,
                lead_time_days, customer_group,
                is_active, created_at, updated_at
            """,
            params
        )
        row = cur.fetchone()
        
        return PartyResponse(**dict(row))


@router.delete("/{party_id}", status_code=204)
async def delete_party(
    party_id: UUID,
    x_tenant_id: str = Header(...),
):
    """
    Delete a party.
    
    Note: Will fail if party has orders.
    """
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # TODO: Check for purchase orders and sales orders
        
        cur.execute(
            "DELETE FROM parties WHERE id = %s AND tenant_id = %s",
            (str(party_id), str(tenant_id))
        )
        
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Party not found")




