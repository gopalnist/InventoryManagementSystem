"""
Items API Routes
================
CRUD operations for items/products.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional
from uuid import UUID, uuid4
import math

from fastapi import APIRouter, HTTPException, Query, Header, UploadFile, File

# Add shared to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent.parent))

from shared.db import get_db_cursor

from ..models.item import (
    ItemCreate,
    ItemUpdate,
    ItemResponse,
    ItemListResponse,
    ItemImportResult,
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

@router.get("", response_model=ItemListResponse)
async def list_items(
    x_tenant_id: str = Header(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by SKU or name"),
    category_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
):
    """
    List items with pagination and filtering.
    """
    tenant_id = get_tenant_id(x_tenant_id)
    offset = (page - 1) * limit
    
    with get_db_cursor() as cur:
        # Base query
        base_query = """
            FROM items i
            LEFT JOIN categories c ON i.category_id = c.id
            LEFT JOIN units pu ON i.primary_unit_id = pu.id
            LEFT JOIN units su ON i.secondary_unit_id = su.id
            WHERE i.tenant_id = %s
        """
        params = [str(tenant_id)]
        
        # Filters
        if search:
            base_query += " AND (i.sku_code ILIKE %s OR i.name ILIKE %s)"
            params.extend([f"%{search}%", f"%{search}%"])
        
        if category_id:
            base_query += " AND i.category_id = %s"
            params.append(str(category_id))
        
        if is_active is not None:
            base_query += " AND i.is_active = %s"
            params.append(is_active)
        
        # Count total
        cur.execute(f"SELECT COUNT(*) {base_query}", params)
        total = cur.fetchone()["count"]
        
        # Get paginated results
        allowed_sort_fields = ["sku_code", "name", "created_at", "updated_at", "selling_rate"]
        if sort_by not in allowed_sort_fields:
            sort_by = "created_at"
        
        select_query = f"""
            SELECT 
                i.id, i.tenant_id, i.sku_code, i.name, i.description,
                i.category_id, i.primary_unit_id, i.secondary_unit_id, i.conversion_rate,
                i.purchase_rate, i.selling_rate, i.mrp, i.tax_rate, i.hsn_code,
                i.track_batches, i.track_serials, i.track_expiry, i.has_variants,
                i.reorder_level, i.reorder_qty, i.min_stock, i.max_stock,
                i.is_active, i.created_at, i.updated_at,
                c.name as category_name,
                pu.name as primary_unit_name,
                su.name as secondary_unit_name
            {base_query}
            ORDER BY i.{sort_by} {sort_order}
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])
        
        cur.execute(select_query, params)
        rows = cur.fetchall()
        
        items = [ItemResponse(**dict(row)) for row in rows]
        total_pages = math.ceil(total / limit) if total > 0 else 0
        
        return ItemListResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages
        )


@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(
    item_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Get a single item by ID."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT 
                i.id, i.tenant_id, i.sku_code, i.name, i.description,
                i.category_id, i.primary_unit_id, i.secondary_unit_id, i.conversion_rate,
                i.purchase_rate, i.selling_rate, i.mrp, i.tax_rate, i.hsn_code,
                i.track_batches, i.track_serials, i.track_expiry, i.has_variants,
                i.reorder_level, i.reorder_qty, i.min_stock, i.max_stock,
                i.is_active, i.created_at, i.updated_at,
                c.name as category_name,
                pu.name as primary_unit_name,
                su.name as secondary_unit_name
            FROM items i
            LEFT JOIN categories c ON i.category_id = c.id
            LEFT JOIN units pu ON i.primary_unit_id = pu.id
            LEFT JOIN units su ON i.secondary_unit_id = su.id
            WHERE i.id = %s AND i.tenant_id = %s
            """,
            (str(item_id), str(tenant_id))
        )
        row = cur.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Item not found")
        
        return ItemResponse(**dict(row))


@router.post("", response_model=ItemResponse, status_code=201)
async def create_item(
    data: ItemCreate,
    x_tenant_id: str = Header(...),
):
    """Create a new item."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check for duplicate SKU
        cur.execute(
            "SELECT id FROM items WHERE tenant_id = %s AND sku_code = %s",
            (str(tenant_id), data.sku_code)
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Item with this SKU already exists")
        
        # Validate category if provided
        if data.category_id:
            cur.execute(
                "SELECT id FROM categories WHERE id = %s AND tenant_id = %s",
                (str(data.category_id), str(tenant_id))
            )
            if not cur.fetchone():
                raise HTTPException(status_code=400, detail="Category not found")
        
        # Insert
        item_id = uuid4()
        cur.execute(
            """
            INSERT INTO items (
                id, tenant_id, sku_code, name, description,
                category_id, primary_unit_id, secondary_unit_id, conversion_rate,
                purchase_rate, selling_rate, mrp, tax_rate, hsn_code,
                track_batches, track_serials, track_expiry, has_variants,
                reorder_level, reorder_qty, min_stock, max_stock,
                is_active, created_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                true, NOW()
            )
            RETURNING id, tenant_id, sku_code, name, description,
                category_id, primary_unit_id, secondary_unit_id, conversion_rate,
                purchase_rate, selling_rate, mrp, tax_rate, hsn_code,
                track_batches, track_serials, track_expiry, has_variants,
                reorder_level, reorder_qty, min_stock, max_stock,
                is_active, created_at, updated_at
            """,
            (
                str(item_id), str(tenant_id), data.sku_code, data.name, data.description,
                str(data.category_id) if data.category_id else None,
                str(data.primary_unit_id) if data.primary_unit_id else None,
                str(data.secondary_unit_id) if data.secondary_unit_id else None,
                data.conversion_rate,
                data.purchase_rate, data.selling_rate, data.mrp, data.tax_rate, data.hsn_code,
                data.track_batches, data.track_serials, data.track_expiry, data.has_variants,
                data.reorder_level, data.reorder_qty, data.min_stock, data.max_stock,
            )
        )
        row = cur.fetchone()
        
        return ItemResponse(**dict(row))


@router.put("/{item_id}", response_model=ItemResponse)
async def update_item(
    item_id: UUID,
    data: ItemUpdate,
    x_tenant_id: str = Header(...),
):
    """Update an existing item."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check exists
        cur.execute(
            "SELECT id FROM items WHERE id = %s AND tenant_id = %s",
            (str(item_id), str(tenant_id))
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Build update query dynamically
        updates = []
        params = []
        
        update_fields = data.model_dump(exclude_unset=True)
        
        for field, value in update_fields.items():
            if value is not None:
                # Handle UUID fields
                if field in ("category_id", "primary_unit_id", "secondary_unit_id"):
                    updates.append(f"{field} = %s")
                    params.append(str(value) if value else None)
                else:
                    updates.append(f"{field} = %s")
                    params.append(value)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        updates.append("updated_at = NOW()")
        params.extend([str(item_id), str(tenant_id)])
        
        cur.execute(
            f"""
            UPDATE items 
            SET {', '.join(updates)}
            WHERE id = %s AND tenant_id = %s
            RETURNING id, tenant_id, sku_code, name, description,
                category_id, primary_unit_id, secondary_unit_id, conversion_rate,
                purchase_rate, selling_rate, mrp, tax_rate, hsn_code,
                track_batches, track_serials, track_expiry, has_variants,
                reorder_level, reorder_qty, min_stock, max_stock,
                is_active, created_at, updated_at
            """,
            params
        )
        row = cur.fetchone()
        
        return ItemResponse(**dict(row))


@router.delete("/{item_id}", status_code=204)
async def delete_item(
    item_id: UUID,
    x_tenant_id: str = Header(...),
):
    """
    Delete an item.
    
    Note: Will fail if item has inventory or is used in orders.
    """
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check for inventory (will be implemented in inventory service)
        # For now, just delete
        
        cur.execute(
            "DELETE FROM items WHERE id = %s AND tenant_id = %s",
            (str(item_id), str(tenant_id))
        )
        
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Item not found")


@router.post("/import", response_model=ItemImportResult)
async def import_items(
    file: UploadFile = File(...),
    x_tenant_id: str = Header(...),
):
    """
    Bulk import items from Excel/CSV file.
    
    Expected columns: sku_code, name, category, unit, purchase_rate, selling_rate, mrp, reorder_level
    """
    tenant_id = get_tenant_id(x_tenant_id)
    
    # Check file type
    if not file.filename.endswith(('.xlsx', '.csv')):
        raise HTTPException(status_code=400, detail="File must be .xlsx or .csv")
    
    import pandas as pd
    import io
    
    content = await file.read()
    
    try:
        if file.filename.endswith('.xlsx'):
            df = pd.read_excel(io.BytesIO(content))
        else:
            df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")
    
    # Validate required columns
    required_cols = ['sku_code', 'name']
    missing_cols = [c for c in required_cols if c not in df.columns]
    if missing_cols:
        raise HTTPException(
            status_code=400, 
            detail=f"Missing required columns: {', '.join(missing_cols)}"
        )
    
    success_count = 0
    error_count = 0
    errors = []
    
    with get_db_cursor() as cur:
        for idx, row in df.iterrows():
            try:
                sku_code = str(row['sku_code']).strip()
                name = str(row['name']).strip()
                
                if not sku_code or not name:
                    errors.append({"row": idx + 2, "error": "SKU or name is empty"})
                    error_count += 1
                    continue
                
                # Check if exists
                cur.execute(
                    "SELECT id FROM items WHERE tenant_id = %s AND sku_code = %s",
                    (str(tenant_id), sku_code)
                )
                if cur.fetchone():
                    errors.append({"row": idx + 2, "error": f"SKU {sku_code} already exists"})
                    error_count += 1
                    continue
                
                # Insert
                cur.execute(
                    """
                    INSERT INTO items (id, tenant_id, sku_code, name, 
                        purchase_rate, selling_rate, mrp, reorder_level,
                        is_active, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, true, NOW())
                    """,
                    (
                        str(uuid4()),
                        str(tenant_id),
                        sku_code,
                        name,
                        row.get('purchase_rate') if pd.notna(row.get('purchase_rate')) else None,
                        row.get('selling_rate') if pd.notna(row.get('selling_rate')) else None,
                        row.get('mrp') if pd.notna(row.get('mrp')) else None,
                        int(row.get('reorder_level')) if pd.notna(row.get('reorder_level')) else None,
                    )
                )
                success_count += 1
                
            except Exception as e:
                errors.append({"row": idx + 2, "error": str(e)})
                error_count += 1
    
    return ItemImportResult(
        success_count=success_count,
        error_count=error_count,
        errors=errors[:50]  # Limit errors in response
    )




