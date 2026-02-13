"""
Inventory API
=============
Stock levels, reservations, and inventory management
"""

from __future__ import annotations

from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Header, status, Query
from pydantic import BaseModel, Field
from datetime import datetime, date
from decimal import Decimal
from enum import Enum

from shared.db.connection import get_db_cursor

router = APIRouter()


# =============================================================================
# ENUMS
# =============================================================================

class StockStatus(str, Enum):
    IN_STOCK = "in_stock"
    LOW_STOCK = "low_stock"
    OUT_OF_STOCK = "out_of_stock"


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class InventoryItem(BaseModel):
    id: str
    tenant_id: str
    product_id: str
    product_name: str
    product_sku: str
    product_image: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    warehouse_id: str
    warehouse_name: str
    warehouse_code: str
    on_hand_qty: float
    reserved_qty: float
    available_qty: float
    incoming_qty: float
    committed_qty: float
    reorder_level: float
    reorder_qty: float
    max_stock_level: Optional[float] = None
    bin_location: Optional[str] = None
    unit_cost: float
    total_value: float
    stock_status: StockStatus
    last_count_date: Optional[date] = None
    last_received_date: Optional[date] = None
    last_sold_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime


class InventoryListResponse(BaseModel):
    items: List[InventoryItem]
    total: int
    page: int
    limit: int


class InventorySummary(BaseModel):
    total_products: int
    total_stock_value: float
    low_stock_count: int
    out_of_stock_count: int
    total_warehouses: int
    total_on_hand: float
    total_reserved: float
    total_available: float


class ProductStockSummary(BaseModel):
    product_id: str
    product_name: str
    product_sku: str
    total_on_hand: float
    total_reserved: float
    total_available: float
    total_value: float
    warehouse_count: int
    stock_status: StockStatus
    reorder_level: float
    warehouses: List[dict]


class InventoryCreate(BaseModel):
    product_id: str
    warehouse_id: str
    on_hand_qty: float = 0
    unit_cost: float = 0
    reorder_level: float = 0
    reorder_qty: float = 0
    max_stock_level: Optional[float] = None
    bin_location: Optional[str] = None


class InventoryUpdate(BaseModel):
    on_hand_qty: Optional[float] = None
    reserved_qty: Optional[float] = None
    incoming_qty: Optional[float] = None
    reorder_level: Optional[float] = None
    reorder_qty: Optional[float] = None
    max_stock_level: Optional[float] = None
    bin_location: Optional[str] = None
    unit_cost: Optional[float] = None


class StockReservation(BaseModel):
    product_id: str
    warehouse_id: str
    quantity: float
    source_type: str = "sales_order"  # sales_order, production_order, transfer
    source_id: str
    source_line_id: Optional[str] = None


class StockReservationResponse(BaseModel):
    success: bool
    reservation_id: Optional[str] = None
    message: str
    available_qty: float
    reserved_qty: float


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_tenant_id(x_tenant_id: str = Header(...)) -> UUID:
    try:
        return UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant ID format")


def get_stock_status(available_qty: float, reorder_level: float) -> StockStatus:
    if available_qty <= 0:
        return StockStatus.OUT_OF_STOCK
    elif available_qty <= reorder_level:
        return StockStatus.LOW_STOCK
    return StockStatus.IN_STOCK


def row_to_inventory_item(row: dict) -> InventoryItem:
    available_qty = float(row['available_qty'] or 0)
    reorder_level = float(row['reorder_level'] or 0)
    
    return InventoryItem(
        id=str(row['id']),
        tenant_id=str(row['tenant_id']),
        product_id=str(row['product_id']),
        product_name=row['product_name'],
        product_sku=row['product_sku'],
        product_image=row.get('product_image'),
        category_id=str(row['category_id']) if row.get('category_id') else None,
        category_name=row.get('category_name'),
        warehouse_id=str(row['warehouse_id']),
        warehouse_name=row['warehouse_name'],
        warehouse_code=row['warehouse_code'],
        on_hand_qty=float(row['on_hand_qty'] or 0),
        reserved_qty=float(row['reserved_qty'] or 0),
        available_qty=available_qty,
        incoming_qty=float(row['incoming_qty'] or 0),
        committed_qty=float(row['committed_qty'] or 0),
        reorder_level=reorder_level,
        reorder_qty=float(row['reorder_qty'] or 0),
        max_stock_level=float(row['max_stock_level']) if row.get('max_stock_level') else None,
        bin_location=row.get('bin_location'),
        unit_cost=float(row['unit_cost'] or 0),
        total_value=float(row['total_value'] or 0),
        stock_status=get_stock_status(available_qty, reorder_level),
        last_count_date=row.get('last_count_date'),
        last_received_date=row.get('last_received_date'),
        last_sold_date=row.get('last_sold_date'),
        created_at=row['created_at'],
        updated_at=row['updated_at']
    )


# =============================================================================
# INVENTORY ENDPOINTS
# =============================================================================

@router.get("/", response_model=InventoryListResponse)
async def list_inventory(
    x_tenant_id: str = Header(...),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    category_id: Optional[str] = None,
    stock_status: Optional[StockStatus] = None,
    sort_by: str = Query("product_name", description="Sort field"),
    sort_order: str = Query("asc", description="asc or desc"),
):
    """List all inventory items with filters."""
    tenant_id = get_tenant_id(x_tenant_id)
    offset = (page - 1) * limit
    
    with get_db_cursor(dict_cursor=True) as cur:
        conditions = ["i.tenant_id = %s"]
        params = [str(tenant_id)]
        
        if search:
            conditions.append("(p.name ILIKE %s OR p.sku ILIKE %s)")
            search_pattern = f"%{search}%"
            params.extend([search_pattern, search_pattern])
        
        if warehouse_id:
            conditions.append("i.warehouse_id = %s")
            params.append(warehouse_id)
        
        if category_id:
            conditions.append("p.category_id = %s")
            params.append(category_id)
        
        if stock_status:
            if stock_status == StockStatus.OUT_OF_STOCK:
                conditions.append("i.available_qty <= 0")
            elif stock_status == StockStatus.LOW_STOCK:
                conditions.append("i.available_qty > 0 AND i.available_qty <= i.reorder_level")
            else:
                conditions.append("i.available_qty > i.reorder_level")
        
        where_clause = " AND ".join(conditions)
        
        # Validate sort field
        valid_sort_fields = ["product_name", "product_sku", "on_hand_qty", "available_qty", 
                            "total_value", "warehouse_name", "updated_at"]
        if sort_by not in valid_sort_fields:
            sort_by = "product_name"
        
        sort_direction = "DESC" if sort_order.lower() == "desc" else "ASC"
        
        # Map sort field to actual column
        sort_mapping = {
            "product_name": "p.name",
            "product_sku": "p.sku",
            "on_hand_qty": "i.on_hand_qty",
            "available_qty": "i.available_qty",
            "total_value": "i.total_value",
            "warehouse_name": "w.name",
            "updated_at": "i.updated_at"
        }
        sort_column = sort_mapping.get(sort_by, "p.name")
        
        cur.execute(f"""
            SELECT 
                i.*,
                p.name as product_name,
                p.sku as product_sku,
                p.image_url as product_image,
                p.category_id,
                c.name as category_name,
                w.name as warehouse_name,
                w.code as warehouse_code
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            JOIN warehouses w ON w.id = i.warehouse_id
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE {where_clause}
            ORDER BY {sort_column} {sort_direction}
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        
        rows = cur.fetchall()
        
        cur.execute(f"""
            SELECT COUNT(*) as count FROM inventory i
            JOIN products p ON p.id = i.product_id
            WHERE {where_clause}
        """, params)
        total = cur.fetchone()['count']
        
        items = [row_to_inventory_item(row) for row in rows]
        
        return InventoryListResponse(items=items, total=total, page=page, limit=limit)


@router.get("/summary", response_model=InventorySummary)
async def get_inventory_summary(x_tenant_id: str = Header(...)):
    """Get overall inventory summary."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("""
            SELECT 
                COUNT(DISTINCT product_id) as total_products,
                COALESCE(SUM(on_hand_qty * unit_cost), 0) as total_stock_value,
                COUNT(*) FILTER (WHERE available_qty > 0 AND available_qty <= reorder_level) as low_stock_count,
                COUNT(*) FILTER (WHERE available_qty <= 0) as out_of_stock_count,
                COUNT(DISTINCT warehouse_id) as total_warehouses,
                COALESCE(SUM(on_hand_qty), 0) as total_on_hand,
                COALESCE(SUM(reserved_qty), 0) as total_reserved,
                COALESCE(SUM(available_qty), 0) as total_available
            FROM inventory
            WHERE tenant_id = %s
        """, [str(tenant_id)])
        
        stats = cur.fetchone()
        
        return InventorySummary(
            total_products=stats['total_products'] or 0,
            total_stock_value=float(stats['total_stock_value'] or 0),
            low_stock_count=stats['low_stock_count'] or 0,
            out_of_stock_count=stats['out_of_stock_count'] or 0,
            total_warehouses=stats['total_warehouses'] or 0,
            total_on_hand=float(stats['total_on_hand'] or 0),
            total_reserved=float(stats['total_reserved'] or 0),
            total_available=float(stats['total_available'] or 0)
        )


@router.get("/low-stock")
async def get_low_stock_items(
    x_tenant_id: str = Header(...),
    limit: int = Query(50, ge=1, le=200)
):
    """Get items with low stock (below reorder level)."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("""
            SELECT 
                i.*,
                p.name as product_name,
                p.sku as product_sku,
                p.image_url as product_image,
                c.name as category_name,
                w.name as warehouse_name,
                w.code as warehouse_code
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            JOIN warehouses w ON w.id = i.warehouse_id
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE i.tenant_id = %s AND i.available_qty <= i.reorder_level AND i.reorder_level > 0
            ORDER BY (i.available_qty / NULLIF(i.reorder_level, 0)) ASC
            LIMIT %s
        """, [str(tenant_id), limit])
        
        rows = cur.fetchall()
        items = [row_to_inventory_item(row) for row in rows]
        
        return {"items": items, "total": len(items)}


@router.get("/out-of-stock")
async def get_out_of_stock_items(
    x_tenant_id: str = Header(...),
    limit: int = Query(50, ge=1, le=200)
):
    """Get items that are out of stock."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("""
            SELECT 
                i.*,
                p.name as product_name,
                p.sku as product_sku,
                p.image_url as product_image,
                c.name as category_name,
                w.name as warehouse_name,
                w.code as warehouse_code
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            JOIN warehouses w ON w.id = i.warehouse_id
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE i.tenant_id = %s AND i.available_qty <= 0
            ORDER BY p.name ASC
            LIMIT %s
        """, [str(tenant_id), limit])
        
        rows = cur.fetchall()
        items = [row_to_inventory_item(row) for row in rows]
        
        return {"items": items, "total": len(items)}


@router.get("/product/{product_id}", response_model=ProductStockSummary)
async def get_product_stock(product_id: UUID, x_tenant_id: str = Header(...)):
    """Get stock levels for a specific product across all warehouses."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        # Get product info
        cur.execute("""
            SELECT id, name, sku, reorder_level FROM products 
            WHERE id = %s AND tenant_id = %s
        """, [str(product_id), str(tenant_id)])
        
        product = cur.fetchone()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Get inventory across warehouses
        cur.execute("""
            SELECT 
                i.*,
                w.name as warehouse_name,
                w.code as warehouse_code
            FROM inventory i
            JOIN warehouses w ON w.id = i.warehouse_id
            WHERE i.product_id = %s AND i.tenant_id = %s
            ORDER BY w.name
        """, [str(product_id), str(tenant_id)])
        
        rows = cur.fetchall()
        
        total_on_hand = sum(float(r['on_hand_qty'] or 0) for r in rows)
        total_reserved = sum(float(r['reserved_qty'] or 0) for r in rows)
        total_available = sum(float(r['available_qty'] or 0) for r in rows)
        total_value = sum(float(r['total_value'] or 0) for r in rows)
        reorder_level = float(product['reorder_level'] or 0)
        
        warehouses = [{
            "warehouse_id": str(r['warehouse_id']),
            "warehouse_name": r['warehouse_name'],
            "warehouse_code": r['warehouse_code'],
            "on_hand_qty": float(r['on_hand_qty'] or 0),
            "reserved_qty": float(r['reserved_qty'] or 0),
            "available_qty": float(r['available_qty'] or 0),
            "unit_cost": float(r['unit_cost'] or 0),
            "bin_location": r.get('bin_location')
        } for r in rows]
        
        return ProductStockSummary(
            product_id=str(product['id']),
            product_name=product['name'],
            product_sku=product['sku'],
            total_on_hand=total_on_hand,
            total_reserved=total_reserved,
            total_available=total_available,
            total_value=total_value,
            warehouse_count=len(rows),
            stock_status=get_stock_status(total_available, reorder_level),
            reorder_level=reorder_level,
            warehouses=warehouses
        )


@router.post("/", response_model=InventoryItem, status_code=status.HTTP_201_CREATED)
async def create_inventory_record(inventory: InventoryCreate, x_tenant_id: str = Header(...)):
    """Create a new inventory record for a product in a warehouse."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True, autocommit=True) as cur:
        # Check if record already exists
        cur.execute("""
            SELECT id FROM inventory 
            WHERE tenant_id = %s AND product_id = %s AND warehouse_id = %s
        """, [str(tenant_id), inventory.product_id, inventory.warehouse_id])
        
        if cur.fetchone():
            raise HTTPException(status_code=400, 
                detail="Inventory record already exists for this product/warehouse combination")
        
        # Verify product exists
        cur.execute("SELECT id FROM products WHERE id = %s AND tenant_id = %s",
                   [inventory.product_id, str(tenant_id)])
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Verify warehouse exists
        cur.execute("SELECT id FROM warehouses WHERE id = %s AND tenant_id = %s",
                   [inventory.warehouse_id, str(tenant_id)])
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Warehouse not found")
        
        cur.execute("""
            INSERT INTO inventory (
                tenant_id, product_id, warehouse_id, on_hand_qty, unit_cost,
                reorder_level, reorder_qty, max_stock_level, bin_location
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, [
            str(tenant_id), inventory.product_id, inventory.warehouse_id,
            inventory.on_hand_qty, inventory.unit_cost, inventory.reorder_level,
            inventory.reorder_qty, inventory.max_stock_level, inventory.bin_location
        ])
        
        inv_row = cur.fetchone()
        
        # Get full inventory item with joins
        cur.execute("""
            SELECT 
                i.*,
                p.name as product_name, p.sku as product_sku, p.image_url as product_image,
                p.category_id, c.name as category_name,
                w.name as warehouse_name, w.code as warehouse_code
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            JOIN warehouses w ON w.id = i.warehouse_id
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE i.id = %s
        """, [str(inv_row['id'])])
        
        row = cur.fetchone()
        return row_to_inventory_item(row)


@router.put("/{inventory_id}", response_model=InventoryItem)
async def update_inventory_record(
    inventory_id: UUID, 
    inventory: InventoryUpdate, 
    x_tenant_id: str = Header(...)
):
    """Update an inventory record."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True, autocommit=True) as cur:
        cur.execute("SELECT id FROM inventory WHERE id = %s AND tenant_id = %s",
                   [str(inventory_id), str(tenant_id)])
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Inventory record not found")
        
        update_fields = []
        params = []
        update_data = inventory.model_dump(exclude_unset=True)
        
        for field, value in update_data.items():
            if value is not None:
                update_fields.append(f"{field} = %s")
                params.append(value)
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        update_fields.append("updated_at = CURRENT_TIMESTAMP")
        params.extend([str(inventory_id), str(tenant_id)])
        
        cur.execute(f"""
            UPDATE inventory SET {', '.join(update_fields)}
            WHERE id = %s AND tenant_id = %s RETURNING *
        """, params)
        
        inv_row = cur.fetchone()
        
        cur.execute("""
            SELECT 
                i.*,
                p.name as product_name, p.sku as product_sku, p.image_url as product_image,
                p.category_id, c.name as category_name,
                w.name as warehouse_name, w.code as warehouse_code
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            JOIN warehouses w ON w.id = i.warehouse_id
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE i.id = %s
        """, [str(inv_row['id'])])
        
        row = cur.fetchone()
        return row_to_inventory_item(row)


@router.post("/reserve", response_model=StockReservationResponse)
async def reserve_stock(reservation: StockReservation, x_tenant_id: str = Header(...)):
    """Reserve stock for an order."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True, autocommit=True) as cur:
        # Get current inventory
        cur.execute("""
            SELECT id, on_hand_qty, reserved_qty, available_qty
            FROM inventory
            WHERE tenant_id = %s AND product_id = %s AND warehouse_id = %s
            FOR UPDATE
        """, [str(tenant_id), reservation.product_id, reservation.warehouse_id])
        
        inv = cur.fetchone()
        if not inv:
            return StockReservationResponse(
                success=False,
                message="No inventory record found for this product/warehouse",
                available_qty=0,
                reserved_qty=0
            )
        
        available = float(inv['available_qty'])
        if available < reservation.quantity:
            return StockReservationResponse(
                success=False,
                message=f"Insufficient stock. Available: {available}, Requested: {reservation.quantity}",
                available_qty=available,
                reserved_qty=float(inv['reserved_qty'])
            )
        
        # Create reservation record
        cur.execute("""
            INSERT INTO inventory_reservations (
                tenant_id, inventory_id, source_type, source_id, source_line_id,
                reserved_qty, status, expires_at
            ) VALUES (%s, %s, %s, %s, %s, %s, 'active', NOW() + INTERVAL '24 hours')
            RETURNING id
        """, [
            str(tenant_id), str(inv['id']),
            reservation.source_type, reservation.source_id, reservation.source_line_id,
            reservation.quantity
        ])
        
        reservation_row = cur.fetchone()
        
        # Update inventory reserved qty
        cur.execute("""
            UPDATE inventory 
            SET reserved_qty = reserved_qty + %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING reserved_qty, available_qty
        """, [reservation.quantity, str(inv['id'])])
        
        updated = cur.fetchone()
        
        return StockReservationResponse(
            success=True,
            reservation_id=str(reservation_row['id']),
            message=f"Successfully reserved {reservation.quantity} units",
            available_qty=float(updated['available_qty']),
            reserved_qty=float(updated['reserved_qty'])
        )


@router.post("/release/{reservation_id}")
async def release_reservation(reservation_id: UUID, x_tenant_id: str = Header(...)):
    """Release a stock reservation."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True, autocommit=True) as cur:
        # Get reservation
        cur.execute("""
            SELECT ir.*, i.id as inv_id
            FROM inventory_reservations ir
            JOIN inventory i ON i.id = ir.inventory_id
            WHERE ir.id = %s AND ir.tenant_id = %s AND ir.status = 'active'
        """, [str(reservation_id), str(tenant_id)])
        
        reservation = cur.fetchone()
        if not reservation:
            raise HTTPException(status_code=404, detail="Active reservation not found")
        
        # Update reservation status - cancel all reserved qty
        cur.execute("""
            UPDATE inventory_reservations 
            SET status = 'cancelled', 
                cancelled_qty = reserved_qty,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, [str(reservation_id)])
        
        # Update inventory
        cur.execute("""
            UPDATE inventory 
            SET reserved_qty = reserved_qty - %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING *
        """, [float(reservation['reserved_qty']), str(reservation['inv_id'])])
        
        return {"success": True, "message": "Reservation released successfully"}


@router.post("/fulfill/{reservation_id}")
async def fulfill_reservation(reservation_id: UUID, x_tenant_id: str = Header(...)):
    """Fulfill a reservation (deduct from on_hand and reserved)."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True, autocommit=True) as cur:
        # Get reservation
        cur.execute("""
            SELECT ir.*, i.id as inv_id, i.product_id, i.warehouse_id, i.on_hand_qty, i.reserved_qty
            FROM inventory_reservations ir
            JOIN inventory i ON i.id = ir.inventory_id
            WHERE ir.id = %s AND ir.tenant_id = %s AND ir.status = 'active'
        """, [str(reservation_id), str(tenant_id)])
        
        reservation = cur.fetchone()
        if not reservation:
            raise HTTPException(status_code=404, detail="Active reservation not found")
        
        qty = float(reservation['reserved_qty'])
        
        # Update reservation status
        cur.execute("""
            UPDATE inventory_reservations 
            SET status = 'fulfilled', 
                fulfilled_qty = reserved_qty,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, [str(reservation_id)])
        
        # Update inventory - deduct from both on_hand and reserved
        cur.execute("""
            UPDATE inventory 
            SET on_hand_qty = on_hand_qty - %s,
                reserved_qty = reserved_qty - %s,
                last_sold_date = CURRENT_DATE,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING *
        """, [qty, qty, str(reservation['inv_id'])])
        
        # Record transaction
        cur.execute("""
            INSERT INTO inventory_transactions (
                tenant_id, product_id, warehouse_id, transaction_type, quantity,
                reference_type, notes
            ) VALUES (%s, %s, %s, 'out', %s, %s, %s)
        """, [
            str(tenant_id), str(reservation['product_id']), str(reservation['warehouse_id']), qty,
            reservation['source_type'], f"Fulfilled reservation {reservation_id}"
        ])
        
        return {"success": True, "message": f"Fulfilled {qty} units"}

