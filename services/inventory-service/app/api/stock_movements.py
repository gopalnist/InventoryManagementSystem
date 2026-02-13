"""
Stock Movements API
===================
Stock adjustments, transfers, receiving, and issuing
"""

from __future__ import annotations

from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Header, status, Query
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

from shared.db.connection import get_db_cursor

router = APIRouter()


# =============================================================================
# ENUMS
# =============================================================================

class MovementType(str, Enum):
    RECEIVE = "receive"          # Goods received (purchase, return)
    ISSUE = "issue"              # Goods issued (sale, consumption)
    ADJUST_IN = "adjust_in"      # Positive adjustment
    ADJUST_OUT = "adjust_out"    # Negative adjustment
    TRANSFER_OUT = "transfer_out"  # Transfer to another warehouse
    TRANSFER_IN = "transfer_in"    # Transfer from another warehouse
    PRODUCTION_IN = "production_in"   # Production output
    PRODUCTION_OUT = "production_out"  # Production consumption


class AdjustmentReason(str, Enum):
    CYCLE_COUNT = "cycle_count"
    DAMAGED = "damaged"
    EXPIRED = "expired"
    THEFT = "theft"
    FOUND = "found"
    CORRECTION = "correction"
    OPENING_BALANCE = "opening_balance"
    OTHER = "other"


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class StockMovement(BaseModel):
    id: str
    tenant_id: str
    product_id: str
    product_name: str
    product_sku: str
    warehouse_id: str
    warehouse_name: str
    movement_type: str
    quantity: float
    unit_cost: Optional[float] = None
    total_value: Optional[float] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    reference_number: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    created_by: Optional[str] = None
    created_at: datetime


class StockMovementListResponse(BaseModel):
    movements: List[StockMovement]
    total: int
    page: int
    limit: int


class StockReceive(BaseModel):
    product_id: str
    warehouse_id: str
    quantity: float = Field(..., gt=0)
    unit_cost: Optional[float] = None
    reference_type: str = "purchase"  # purchase, return, transfer
    reference_id: Optional[str] = None
    reference_number: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    notes: Optional[str] = None


class StockIssue(BaseModel):
    product_id: str
    warehouse_id: str
    quantity: float = Field(..., gt=0)
    reference_type: str = "sale"  # sale, consumption, transfer, damaged
    reference_id: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class StockAdjustment(BaseModel):
    product_id: str
    warehouse_id: str
    quantity: float  # Positive or negative
    reason: AdjustmentReason
    notes: Optional[str] = None
    reference_number: Optional[str] = None


class StockTransfer(BaseModel):
    product_id: str
    source_warehouse_id: str
    destination_warehouse_id: str
    quantity: float = Field(..., gt=0)
    notes: Optional[str] = None


class BulkStockReceive(BaseModel):
    warehouse_id: str
    reference_type: str = "purchase"
    reference_id: Optional[str] = None
    reference_number: Optional[str] = None
    items: List[dict]  # [{product_id, quantity, unit_cost, batch_number, expiry_date}]
    notes: Optional[str] = None


class MovementResponse(BaseModel):
    success: bool
    message: str
    movement_id: Optional[str] = None
    new_on_hand: Optional[float] = None
    new_available: Optional[float] = None


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_tenant_id(x_tenant_id: str = Header(...)) -> UUID:
    try:
        return UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant ID format")


def row_to_movement(row: dict) -> StockMovement:
    return StockMovement(
        id=str(row['id']),
        tenant_id=str(row['tenant_id']),
        product_id=str(row['product_id']),
        product_name=row['product_name'],
        product_sku=row['product_sku'],
        warehouse_id=str(row['warehouse_id']),
        warehouse_name=row['warehouse_name'],
        movement_type=row['transaction_type'],
        quantity=float(row['quantity']),
        unit_cost=float(row['unit_cost']) if row.get('unit_cost') else None,
        total_value=float(row['total_value']) if row.get('total_value') else None,
        reference_type=row.get('reference_type'),
        reference_id=row.get('reference_id'),
        reference_number=row.get('reference_number'),
        reason=row.get('reason'),
        notes=row.get('notes'),
        batch_number=row.get('batch_number'),
        expiry_date=row.get('expiry_date'),
        created_by=row.get('created_by'),
        created_at=row['created_at']
    )


def get_or_create_inventory(cur, tenant_id: str, product_id: str, warehouse_id: str, unit_cost: float = 0):
    """Get existing inventory record or create new one."""
    cur.execute("""
        SELECT id, on_hand_qty, reserved_qty, available_qty, unit_cost
        FROM inventory
        WHERE tenant_id = %s AND product_id = %s AND warehouse_id = %s
    """, [tenant_id, product_id, warehouse_id])
    
    inv = cur.fetchone()
    
    if not inv:
        # Create new inventory record
        cur.execute("""
            INSERT INTO inventory (tenant_id, product_id, warehouse_id, on_hand_qty, unit_cost)
            VALUES (%s, %s, %s, 0, %s)
            RETURNING id, on_hand_qty, reserved_qty, available_qty, unit_cost
        """, [tenant_id, product_id, warehouse_id, unit_cost])
        inv = cur.fetchone()
    
    return inv


# =============================================================================
# MOVEMENT HISTORY ENDPOINTS
# =============================================================================

@router.get("/", response_model=StockMovementListResponse)
async def list_stock_movements(
    x_tenant_id: str = Header(...),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    product_id: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
):
    """List stock movements with filters."""
    tenant_id = get_tenant_id(x_tenant_id)
    offset = (page - 1) * limit
    
    with get_db_cursor(dict_cursor=True) as cur:
        conditions = ["t.tenant_id = %s"]
        params = [str(tenant_id)]
        
        if product_id:
            conditions.append("t.product_id = %s")
            params.append(product_id)
        
        if warehouse_id:
            conditions.append("t.warehouse_id = %s")
            params.append(warehouse_id)
        
        if movement_type:
            conditions.append("t.transaction_type = %s")
            params.append(movement_type)
        
        if from_date:
            conditions.append("t.created_at >= %s")
            params.append(from_date)
        
        if to_date:
            conditions.append("t.created_at <= %s")
            params.append(to_date)
        
        where_clause = " AND ".join(conditions)
        
        cur.execute(f"""
            SELECT 
                t.*,
                p.name as product_name, p.sku as product_sku,
                w.name as warehouse_name
            FROM inventory_transactions t
            JOIN products p ON p.id = t.product_id
            JOIN warehouses w ON w.id = t.warehouse_id
            WHERE {where_clause}
            ORDER BY t.created_at DESC
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        
        rows = cur.fetchall()
        
        cur.execute(f"""
            SELECT COUNT(*) as count 
            FROM inventory_transactions t
            WHERE {where_clause}
        """, params)
        total = cur.fetchone()['count']
        
        movements = [row_to_movement(row) for row in rows]
        
        return StockMovementListResponse(movements=movements, total=total, page=page, limit=limit)


@router.get("/product/{product_id}")
async def get_product_movements(
    product_id: UUID,
    x_tenant_id: str = Header(...),
    limit: int = Query(50, ge=1, le=200)
):
    """Get stock movements for a specific product."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        cur.execute("""
            SELECT 
                t.*,
                p.name as product_name, p.sku as product_sku,
                w.name as warehouse_name
            FROM inventory_transactions t
            JOIN products p ON p.id = t.product_id
            JOIN warehouses w ON w.id = t.warehouse_id
            WHERE t.tenant_id = %s AND t.product_id = %s
            ORDER BY t.created_at DESC
            LIMIT %s
        """, [str(tenant_id), str(product_id), limit])
        
        rows = cur.fetchall()
        movements = [row_to_movement(row) for row in rows]
        
        return {"product_id": str(product_id), "movements": movements, "total": len(movements)}


# =============================================================================
# STOCK RECEIVE
# =============================================================================

@router.post("/receive", response_model=MovementResponse)
async def receive_stock(data: StockReceive, x_tenant_id: str = Header(...)):
    """Receive stock into inventory (goods receipt)."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True, autocommit=True) as cur:
        # Verify product exists
        cur.execute("SELECT id, cost_price FROM products WHERE id = %s AND tenant_id = %s",
                   [data.product_id, str(tenant_id)])
        product = cur.fetchone()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Verify warehouse exists
        cur.execute("SELECT id FROM warehouses WHERE id = %s AND tenant_id = %s",
                   [data.warehouse_id, str(tenant_id)])
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Warehouse not found")
        
        unit_cost = data.unit_cost or float(product['cost_price'] or 0)
        
        # Get or create inventory record
        inv = get_or_create_inventory(cur, str(tenant_id), data.product_id, data.warehouse_id, unit_cost)
        
        # Update inventory
        cur.execute("""
            UPDATE inventory 
            SET on_hand_qty = on_hand_qty + %s,
                unit_cost = CASE WHEN on_hand_qty = 0 THEN %s 
                            ELSE (on_hand_qty * unit_cost + %s * %s) / (on_hand_qty + %s) END,
                last_received_date = CURRENT_DATE,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING on_hand_qty, available_qty
        """, [data.quantity, unit_cost, data.quantity, unit_cost, data.quantity, str(inv['id'])])
        
        updated = cur.fetchone()
        
        # Record transaction
        cur.execute("""
            INSERT INTO inventory_transactions (
                tenant_id, product_id, warehouse_id, transaction_type, quantity, unit_cost,
                reference_type, reference_number, notes
            ) VALUES (%s, %s, %s, 'in', %s, %s, %s, %s, %s)
            RETURNING id
        """, [
            str(tenant_id), data.product_id, data.warehouse_id, data.quantity, unit_cost,
            data.reference_type, data.reference_number, data.notes
        ])
        
        txn = cur.fetchone()
        
        return MovementResponse(
            success=True,
            message=f"Received {data.quantity} units",
            movement_id=str(txn['id']),
            new_on_hand=float(updated['on_hand_qty']),
            new_available=float(updated['available_qty'])
        )


@router.post("/receive/bulk", response_model=dict)
async def bulk_receive_stock(data: BulkStockReceive, x_tenant_id: str = Header(...)):
    """Bulk receive multiple products."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True, autocommit=True) as cur:
        # Verify warehouse exists
        cur.execute("SELECT id FROM warehouses WHERE id = %s AND tenant_id = %s",
                   [data.warehouse_id, str(tenant_id)])
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Warehouse not found")
        
        results = []
        
        for item in data.items:
            product_id = item.get('product_id')
            quantity = item.get('quantity', 0)
            unit_cost = item.get('unit_cost', 0)
            
            if not product_id or quantity <= 0:
                results.append({"product_id": product_id, "success": False, "error": "Invalid data"})
                continue
            
            # Verify product
            cur.execute("SELECT id, cost_price FROM products WHERE id = %s AND tenant_id = %s",
                       [product_id, str(tenant_id)])
            product = cur.fetchone()
            if not product:
                results.append({"product_id": product_id, "success": False, "error": "Product not found"})
                continue
            
            cost = unit_cost or float(product['cost_price'] or 0)
            
            # Get or create inventory
            inv = get_or_create_inventory(cur, str(tenant_id), product_id, data.warehouse_id, cost)
            
            # Update inventory
            cur.execute("""
                UPDATE inventory 
                SET on_hand_qty = on_hand_qty + %s,
                    unit_cost = CASE WHEN on_hand_qty = 0 THEN %s 
                                ELSE (on_hand_qty * unit_cost + %s * %s) / (on_hand_qty + %s) END,
                    last_received_date = CURRENT_DATE,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING on_hand_qty
            """, [quantity, cost, quantity, cost, quantity, str(inv['id'])])
            
            updated = cur.fetchone()
            
            # Record transaction
            cur.execute("""
                INSERT INTO inventory_transactions (
                    tenant_id, product_id, warehouse_id, transaction_type, quantity, unit_cost,
                    reference_type, reference_number, notes
                ) VALUES (%s, %s, %s, 'in', %s, %s, %s, %s, %s)
            """, [
                str(tenant_id), product_id, data.warehouse_id, quantity, cost,
                data.reference_type, data.reference_number, data.notes
            ])
            
            results.append({
                "product_id": product_id,
                "success": True,
                "quantity_received": quantity,
                "new_on_hand": float(updated['on_hand_qty'])
            })
        
        success_count = len([r for r in results if r.get('success')])
        
        return {
            "success": True,
            "message": f"Received {success_count}/{len(data.items)} items",
            "results": results
        }


# =============================================================================
# STOCK ISSUE
# =============================================================================

@router.post("/issue", response_model=MovementResponse)
async def issue_stock(data: StockIssue, x_tenant_id: str = Header(...)):
    """Issue stock from inventory."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True, autocommit=True) as cur:
        # Get inventory
        cur.execute("""
            SELECT id, on_hand_qty, available_qty, unit_cost
            FROM inventory
            WHERE tenant_id = %s AND product_id = %s AND warehouse_id = %s
            FOR UPDATE
        """, [str(tenant_id), data.product_id, data.warehouse_id])
        
        inv = cur.fetchone()
        if not inv:
            raise HTTPException(status_code=404, detail="No inventory for this product/warehouse")
        
        if float(inv['available_qty']) < data.quantity:
            raise HTTPException(status_code=400, 
                detail=f"Insufficient stock. Available: {inv['available_qty']}, Requested: {data.quantity}")
        
        # Update inventory
        cur.execute("""
            UPDATE inventory 
            SET on_hand_qty = on_hand_qty - %s,
                last_sold_date = CURRENT_DATE,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING on_hand_qty, available_qty
        """, [data.quantity, str(inv['id'])])
        
        updated = cur.fetchone()
        
        # Record transaction
        cur.execute("""
            INSERT INTO inventory_transactions (
                tenant_id, product_id, warehouse_id, transaction_type, quantity, unit_cost,
                reference_type, reference_number, notes
            ) VALUES (%s, %s, %s, 'out', %s, %s, %s, %s, %s)
            RETURNING id
        """, [
            str(tenant_id), data.product_id, data.warehouse_id, data.quantity, float(inv['unit_cost']),
            data.reference_type, data.reference_number, data.notes
        ])
        
        txn = cur.fetchone()
        
        return MovementResponse(
            success=True,
            message=f"Issued {data.quantity} units",
            movement_id=str(txn['id']),
            new_on_hand=float(updated['on_hand_qty']),
            new_available=float(updated['available_qty'])
        )


# =============================================================================
# STOCK ADJUSTMENT
# =============================================================================

@router.post("/adjust", response_model=MovementResponse)
async def adjust_stock(data: StockAdjustment, x_tenant_id: str = Header(...)):
    """Adjust stock (positive or negative)."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True, autocommit=True) as cur:
        # Get or create inventory
        inv = get_or_create_inventory(cur, str(tenant_id), data.product_id, data.warehouse_id, 0)
        
        # Validate negative adjustment
        if data.quantity < 0:
            available = float(inv['available_qty'])
            if available + data.quantity < 0:
                raise HTTPException(status_code=400,
                    detail=f"Cannot adjust below zero. Available: {available}")
        
        # Update inventory
        cur.execute("""
            UPDATE inventory 
            SET on_hand_qty = on_hand_qty + %s,
                last_count_date = CURRENT_DATE,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING on_hand_qty, available_qty
        """, [data.quantity, str(inv['id'])])
        
        updated = cur.fetchone()
        
        # Record transaction
        txn_type = 'adjust_in' if data.quantity >= 0 else 'adjust_out'
        cur.execute("""
            INSERT INTO inventory_transactions (
                tenant_id, product_id, warehouse_id, transaction_type, quantity,
                reason, reference_number, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, [
            str(tenant_id), data.product_id, data.warehouse_id, txn_type, abs(data.quantity),
            data.reason.value, data.reference_number, data.notes
        ])
        
        txn = cur.fetchone()
        
        direction = "Increased" if data.quantity >= 0 else "Decreased"
        return MovementResponse(
            success=True,
            message=f"{direction} stock by {abs(data.quantity)} units ({data.reason.value})",
            movement_id=str(txn['id']),
            new_on_hand=float(updated['on_hand_qty']),
            new_available=float(updated['available_qty'])
        )


# =============================================================================
# STOCK TRANSFER
# =============================================================================

@router.post("/transfer", response_model=dict)
async def transfer_stock(data: StockTransfer, x_tenant_id: str = Header(...)):
    """Transfer stock between warehouses."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    if data.source_warehouse_id == data.destination_warehouse_id:
        raise HTTPException(status_code=400, detail="Source and destination warehouses must be different")
    
    with get_db_cursor(dict_cursor=True, autocommit=True) as cur:
        # Verify warehouses exist
        cur.execute("SELECT id, name FROM warehouses WHERE id = %s AND tenant_id = %s",
                   [data.source_warehouse_id, str(tenant_id)])
        source_wh = cur.fetchone()
        if not source_wh:
            raise HTTPException(status_code=404, detail="Source warehouse not found")
        
        cur.execute("SELECT id, name FROM warehouses WHERE id = %s AND tenant_id = %s",
                   [data.destination_warehouse_id, str(tenant_id)])
        dest_wh = cur.fetchone()
        if not dest_wh:
            raise HTTPException(status_code=404, detail="Destination warehouse not found")
        
        # Get source inventory
        cur.execute("""
            SELECT id, on_hand_qty, available_qty, unit_cost
            FROM inventory
            WHERE tenant_id = %s AND product_id = %s AND warehouse_id = %s
            FOR UPDATE
        """, [str(tenant_id), data.product_id, data.source_warehouse_id])
        
        source_inv = cur.fetchone()
        if not source_inv or float(source_inv['available_qty']) < data.quantity:
            available = float(source_inv['available_qty']) if source_inv else 0
            raise HTTPException(status_code=400,
                detail=f"Insufficient stock in source warehouse. Available: {available}")
        
        unit_cost = float(source_inv['unit_cost'] or 0)
        
        # Deduct from source
        cur.execute("""
            UPDATE inventory 
            SET on_hand_qty = on_hand_qty - %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING on_hand_qty, available_qty
        """, [data.quantity, str(source_inv['id'])])
        
        source_updated = cur.fetchone()
        
        # Get or create destination inventory
        dest_inv = get_or_create_inventory(cur, str(tenant_id), data.product_id, 
                                           data.destination_warehouse_id, unit_cost)
        
        # Add to destination
        cur.execute("""
            UPDATE inventory 
            SET on_hand_qty = on_hand_qty + %s,
                unit_cost = CASE WHEN on_hand_qty = 0 THEN %s 
                            ELSE (on_hand_qty * unit_cost + %s * %s) / (on_hand_qty + %s) END,
                last_received_date = CURRENT_DATE,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING on_hand_qty, available_qty
        """, [data.quantity, unit_cost, data.quantity, unit_cost, data.quantity, str(dest_inv['id'])])
        
        dest_updated = cur.fetchone()
        
        # Generate transfer reference
        transfer_ref = f"TRF-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Record transactions
        cur.execute("""
            INSERT INTO inventory_transactions (
                tenant_id, product_id, warehouse_id, transaction_type, quantity, unit_cost,
                reference_type, reference_number, notes
            ) VALUES (%s, %s, %s, 'transfer_out', %s, %s, 'transfer', %s, %s)
        """, [str(tenant_id), data.product_id, data.source_warehouse_id, data.quantity, unit_cost, 
              transfer_ref, f"Transfer to {dest_wh['name']}"])
        
        cur.execute("""
            INSERT INTO inventory_transactions (
                tenant_id, product_id, warehouse_id, transaction_type, quantity, unit_cost,
                reference_type, reference_number, notes
            ) VALUES (%s, %s, %s, 'transfer_in', %s, %s, 'transfer', %s, %s)
        """, [str(tenant_id), data.product_id, data.destination_warehouse_id, data.quantity, unit_cost,
              transfer_ref, f"Transfer from {source_wh['name']}"])
        
        return {
            "success": True,
            "message": f"Transferred {data.quantity} units from {source_wh['name']} to {dest_wh['name']}",
            "transfer_reference": transfer_ref,
            "source_warehouse": {
                "id": str(source_wh['id']),
                "name": source_wh['name'],
                "new_on_hand": float(source_updated['on_hand_qty']),
                "new_available": float(source_updated['available_qty'])
            },
            "destination_warehouse": {
                "id": str(dest_wh['id']),
                "name": dest_wh['name'],
                "new_on_hand": float(dest_updated['on_hand_qty']),
                "new_available": float(dest_updated['available_qty'])
            }
        }

