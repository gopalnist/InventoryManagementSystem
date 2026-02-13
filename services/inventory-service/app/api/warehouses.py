"""
Warehouses API
==============
CRUD operations for warehouse management
"""

from __future__ import annotations

from uuid import UUID
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, status, Query
from pydantic import BaseModel, Field
from datetime import datetime

from shared.db.connection import get_db_cursor

router = APIRouter()


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class WarehouseBase(BaseModel):
    code: str = Field(..., max_length=20, description="Unique warehouse code")
    name: str = Field(..., max_length=200, description="Warehouse name")
    warehouse_type: str = Field(default="internal", description="internal, 3pl, virtual, dropship")
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"
    pincode: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    is_active: bool = True
    is_default: bool = False
    accepts_returns: bool = True


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    warehouse_type: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    pincode: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    accepts_returns: Optional[bool] = None


class Warehouse(WarehouseBase):
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: datetime
    total_products: int = 0
    total_stock_value: float = 0

    class Config:
        from_attributes = True


class WarehouseListResponse(BaseModel):
    warehouses: list[Warehouse]
    total: int
    page: int
    limit: int


class WarehouseSummary(BaseModel):
    total_warehouses: int
    active_warehouses: int
    internal_warehouses: int
    threepl_warehouses: int
    total_stock_value: float


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_tenant_id(x_tenant_id: str = Header(...)) -> UUID:
    """Extract and validate tenant ID from header."""
    try:
        return UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid tenant ID format"
        )


def row_to_warehouse(row: dict, total_products: int = 0, total_stock_value: float = 0) -> Warehouse:
    """Convert database row to Warehouse model."""
    return Warehouse(
        id=str(row['id']),
        tenant_id=str(row['tenant_id']),
        code=row['code'],
        name=row['name'],
        warehouse_type=row['warehouse_type'] or 'internal',
        address_line1=row['address_line1'],
        address_line2=row['address_line2'],
        city=row['city'],
        state=row['state'],
        country=row['country'] or 'India',
        pincode=row['pincode'],
        contact_name=row['contact_name'],
        contact_phone=row['contact_phone'],
        contact_email=row['contact_email'],
        is_active=row['is_active'],
        is_default=row['is_default'],
        accepts_returns=row['accepts_returns'],
        created_at=row['created_at'],
        updated_at=row['updated_at'],
        total_products=total_products,
        total_stock_value=total_stock_value
    )


# =============================================================================
# WAREHOUSE ENDPOINTS
# =============================================================================

@router.get("/", response_model=WarehouseListResponse)
async def list_warehouses(
    x_tenant_id: str = Header(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    warehouse_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    city: Optional[str] = None,
):
    """List all warehouses with optional filters."""
    tenant_id = get_tenant_id(x_tenant_id)
    offset = (page - 1) * limit
    
    with get_db_cursor(dict_cursor=True) as cur:
        conditions = ["w.tenant_id = %s"]
        params = [str(tenant_id)]
        
        if search:
            conditions.append("(w.name ILIKE %s OR w.code ILIKE %s OR w.city ILIKE %s)")
            search_pattern = f"%{search}%"
            params.extend([search_pattern, search_pattern, search_pattern])
        
        if warehouse_type:
            conditions.append("w.warehouse_type = %s")
            params.append(warehouse_type)
        
        if is_active is not None:
            conditions.append("w.is_active = %s")
            params.append(is_active)
        
        if city:
            conditions.append("w.city ILIKE %s")
            params.append(f"%{city}%")
        
        where_clause = " AND ".join(conditions)
        
        cur.execute(f"""
            SELECT 
                w.*,
                COALESCE(inv.total_products, 0) as total_products,
                COALESCE(inv.total_stock_value, 0) as total_stock_value
            FROM warehouses w
            LEFT JOIN (
                SELECT 
                    warehouse_id,
                    COUNT(DISTINCT product_id) as total_products,
                    SUM(on_hand_qty * unit_cost) as total_stock_value
                FROM inventory
                WHERE tenant_id = %s
                GROUP BY warehouse_id
            ) inv ON inv.warehouse_id = w.id
            WHERE {where_clause}
            ORDER BY w.is_default DESC, w.name ASC
            LIMIT %s OFFSET %s
        """, [str(tenant_id)] + params + [limit, offset])
        
        rows = cur.fetchall()
        
        cur.execute(f"SELECT COUNT(*) as count FROM warehouses w WHERE {where_clause}", params)
        total = cur.fetchone()['count']
        
        warehouses = [
            row_to_warehouse(row, row.get('total_products', 0), float(row.get('total_stock_value', 0) or 0))
            for row in rows
        ]
        
        return WarehouseListResponse(warehouses=warehouses, total=total, page=page, limit=limit)


@router.get("/summary", response_model=WarehouseSummary)
async def get_warehouse_summary(x_tenant_id: str = Header(...)):
    """Get warehouse summary statistics."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("""
            SELECT 
                COUNT(*) as total_warehouses,
                COUNT(*) FILTER (WHERE is_active = true) as active_warehouses,
                COUNT(*) FILTER (WHERE warehouse_type = 'internal') as internal_warehouses,
                COUNT(*) FILTER (WHERE warehouse_type = '3pl') as threepl_warehouses
            FROM warehouses
            WHERE tenant_id = %s
        """, [str(tenant_id)])
        
        stats = cur.fetchone()
        
        cur.execute("""
            SELECT COALESCE(SUM(on_hand_qty * unit_cost), 0) as total_stock_value
            FROM inventory WHERE tenant_id = %s
        """, [str(tenant_id)])
        
        inv_stats = cur.fetchone()
        
        return WarehouseSummary(
            total_warehouses=stats['total_warehouses'],
            active_warehouses=stats['active_warehouses'],
            internal_warehouses=stats['internal_warehouses'],
            threepl_warehouses=stats['threepl_warehouses'],
            total_stock_value=float(inv_stats['total_stock_value'] or 0)
        )


@router.get("/{warehouse_id}", response_model=Warehouse)
async def get_warehouse(warehouse_id: UUID, x_tenant_id: str = Header(...)):
    """Get a specific warehouse by ID."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("""
            SELECT 
                w.*,
                COALESCE(inv.total_products, 0) as total_products,
                COALESCE(inv.total_stock_value, 0) as total_stock_value
            FROM warehouses w
            LEFT JOIN (
                SELECT warehouse_id, COUNT(DISTINCT product_id) as total_products,
                       SUM(on_hand_qty * unit_cost) as total_stock_value
                FROM inventory WHERE tenant_id = %s GROUP BY warehouse_id
            ) inv ON inv.warehouse_id = w.id
            WHERE w.id = %s AND w.tenant_id = %s
        """, [str(tenant_id), str(warehouse_id), str(tenant_id)])
        
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Warehouse not found")
        
        return row_to_warehouse(row, row.get('total_products', 0), float(row.get('total_stock_value', 0) or 0))


@router.post("/", response_model=Warehouse, status_code=status.HTTP_201_CREATED)
async def create_warehouse(warehouse: WarehouseCreate, x_tenant_id: str = Header(...)):
    """Create a new warehouse."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True, autocommit=True) as cur:
        cur.execute("SELECT id FROM warehouses WHERE tenant_id = %s AND code = %s",
                   [str(tenant_id), warehouse.code])
        if cur.fetchone():
            raise HTTPException(status_code=400, detail=f"Warehouse with code '{warehouse.code}' already exists")
        
        if warehouse.is_default:
            cur.execute("UPDATE warehouses SET is_default = false WHERE tenant_id = %s", [str(tenant_id)])
        
        cur.execute("""
            INSERT INTO warehouses (
                tenant_id, code, name, warehouse_type, address_line1, address_line2,
                city, state, country, pincode, contact_name, contact_phone, contact_email,
                is_active, is_default, accepts_returns
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, [
            str(tenant_id), warehouse.code, warehouse.name, warehouse.warehouse_type,
            warehouse.address_line1, warehouse.address_line2, warehouse.city,
            warehouse.state, warehouse.country, warehouse.pincode,
            warehouse.contact_name, warehouse.contact_phone, warehouse.contact_email,
            warehouse.is_active, warehouse.is_default, warehouse.accepts_returns
        ])
        
        row = cur.fetchone()
        return row_to_warehouse(row)


@router.put("/{warehouse_id}", response_model=Warehouse)
async def update_warehouse(warehouse_id: UUID, warehouse: WarehouseUpdate, x_tenant_id: str = Header(...)):
    """Update an existing warehouse."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True, autocommit=True) as cur:
        cur.execute("SELECT id FROM warehouses WHERE id = %s AND tenant_id = %s",
                   [str(warehouse_id), str(tenant_id)])
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Warehouse not found")
        
        update_fields = []
        params = []
        update_data = warehouse.model_dump(exclude_unset=True)
        
        for field, value in update_data.items():
            if value is not None:
                update_fields.append(f"{field} = %s")
                params.append(value)
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        if update_data.get('is_default'):
            cur.execute("UPDATE warehouses SET is_default = false WHERE tenant_id = %s AND id != %s",
                       [str(tenant_id), str(warehouse_id)])
        
        update_fields.append("updated_at = CURRENT_TIMESTAMP")
        params.extend([str(warehouse_id), str(tenant_id)])
        
        cur.execute(f"""
            UPDATE warehouses SET {', '.join(update_fields)}
            WHERE id = %s AND tenant_id = %s RETURNING *
        """, params)
        
        row = cur.fetchone()
        return row_to_warehouse(row)


@router.delete("/{warehouse_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_warehouse(warehouse_id: UUID, x_tenant_id: str = Header(...)):
    """Delete a warehouse (only if no inventory)."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True, autocommit=True) as cur:
        cur.execute("""
            SELECT COUNT(*) as count FROM inventory 
            WHERE warehouse_id = %s AND tenant_id = %s AND on_hand_qty > 0
        """, [str(warehouse_id), str(tenant_id)])
        
        if cur.fetchone()['count'] > 0:
            raise HTTPException(status_code=400,
                detail="Cannot delete warehouse with existing inventory. Transfer or adjust stock first.")
        
        cur.execute("DELETE FROM warehouses WHERE id = %s AND tenant_id = %s RETURNING id",
                   [str(warehouse_id), str(tenant_id)])
        
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Warehouse not found")

