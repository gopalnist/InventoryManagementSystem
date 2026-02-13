"""AMS Warehouses API"""
from fastapi import APIRouter, Depends, Header, HTTPException
from typing import Optional, List
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
from ..config import get_settings

router = APIRouter(prefix="/warehouses", tags=["Warehouses"])
settings = get_settings()

DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"


def get_db_connection():
    return psycopg2.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        dbname=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD
    )


def get_tenant_id(x_tenant_id: Optional[str] = Header(None)) -> str:
    return x_tenant_id or DEFAULT_TENANT_ID


class WarehouseCreate(BaseModel):
    warehouse_code: str
    warehouse_name: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None


class WarehouseUpdate(BaseModel):
    warehouse_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/")
def list_warehouses(tenant_id: str = Depends(get_tenant_id)):
    """List all warehouses."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id FROM vendors 
                WHERE tenant_id = %s AND is_active = TRUE LIMIT 1
            """, (tenant_id,))
            vendor = cur.fetchone()
            
            if not vendor:
                return []
            
            cur.execute("""
                SELECT 
                    w.*,
                    (SELECT COUNT(*) FROM inventory i WHERE i.warehouse_id = w.id) as sku_count,
                    (SELECT COALESCE(SUM(on_hand_qty), 0) FROM inventory i WHERE i.warehouse_id = w.id) as total_stock
                FROM vendor_warehouses w
                WHERE w.tenant_id = %s AND w.vendor_id = %s
                ORDER BY w.warehouse_name
            """, (tenant_id, vendor['id']))
            
            warehouses = cur.fetchall()
            return [dict(w) for w in warehouses]
            
    finally:
        conn.close()


@router.post("/")
def create_warehouse(
    warehouse: WarehouseCreate,
    tenant_id: str = Depends(get_tenant_id)
):
    """Create a new warehouse."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id FROM vendors 
                WHERE tenant_id = %s AND is_active = TRUE LIMIT 1
            """, (tenant_id,))
            vendor = cur.fetchone()
            
            if not vendor:
                raise HTTPException(status_code=400, detail="No vendor found")
            
            cur.execute("""
                INSERT INTO vendor_warehouses 
                (tenant_id, vendor_id, warehouse_code, warehouse_name, 
                 address, city, state, pincode)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (
                tenant_id, vendor['id'], warehouse.warehouse_code,
                warehouse.warehouse_name, warehouse.address,
                warehouse.city, warehouse.state, warehouse.pincode
            ))
            
            result = cur.fetchone()
            conn.commit()
            return dict(result)
            
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Warehouse code already exists")
    finally:
        conn.close()


@router.get("/{warehouse_id}")
def get_warehouse(warehouse_id: int, tenant_id: str = Depends(get_tenant_id)):
    """Get a specific warehouse."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM vendor_warehouses 
                WHERE id = %s AND tenant_id = %s
            """, (warehouse_id, tenant_id))
            
            result = cur.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="Warehouse not found")
            
            return dict(result)
            
    finally:
        conn.close()


@router.put("/{warehouse_id}")
def update_warehouse(
    warehouse_id: int,
    update: WarehouseUpdate,
    tenant_id: str = Depends(get_tenant_id)
):
    """Update a warehouse."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Build update query dynamically
            updates = []
            params = []
            
            if update.warehouse_name is not None:
                updates.append("warehouse_name = %s")
                params.append(update.warehouse_name)
            if update.address is not None:
                updates.append("address = %s")
                params.append(update.address)
            if update.city is not None:
                updates.append("city = %s")
                params.append(update.city)
            if update.state is not None:
                updates.append("state = %s")
                params.append(update.state)
            if update.pincode is not None:
                updates.append("pincode = %s")
                params.append(update.pincode)
            if update.is_active is not None:
                updates.append("is_active = %s")
                params.append(update.is_active)
            
            if not updates:
                raise HTTPException(status_code=400, detail="No updates provided")
            
            updates.append("updated_at = NOW()")
            params.extend([warehouse_id, tenant_id])
            
            cur.execute(f"""
                UPDATE vendor_warehouses 
                SET {', '.join(updates)}
                WHERE id = %s AND tenant_id = %s
                RETURNING *
            """, params)
            
            result = cur.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="Warehouse not found")
            
            conn.commit()
            return dict(result)
            
    finally:
        conn.close()
