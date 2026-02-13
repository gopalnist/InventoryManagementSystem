"""
Purchase Orders API Routes
==========================
CRUD operations for vendor purchase orders (incoming inventory).
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from enum import Enum

from fastapi import APIRouter, HTTPException, Query, Header
from pydantic import BaseModel, Field

from shared.db.connection import get_db_cursor

router = APIRouter()


# =============================================================================
# ENUMS
# =============================================================================

class POStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    ORDERED = "ordered"
    PARTIALLY_RECEIVED = "partially_received"
    RECEIVED = "received"
    CANCELLED = "cancelled"
    CLOSED = "closed"


class PaymentStatus(str, Enum):
    UNPAID = "unpaid"
    PARTIAL = "partial"
    PAID = "paid"


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class POItemCreate(BaseModel):
    product_id: Optional[UUID] = None
    product_sku: Optional[str] = None
    product_name: str
    quantity_ordered: float = Field(..., gt=0)
    unit_price: float = Field(..., ge=0)
    tax_rate: float = Field(0, ge=0, le=100)
    discount_percent: float = Field(0, ge=0, le=100)


class POItemUpdate(BaseModel):
    quantity_ordered: Optional[float] = None
    unit_price: Optional[float] = None
    tax_rate: Optional[float] = None
    discount_percent: Optional[float] = None


class POItemResponse(BaseModel):
    id: UUID
    purchase_order_id: UUID
    product_id: Optional[UUID]
    product_sku: Optional[str]
    product_name: str
    quantity_ordered: float
    quantity_received: float
    unit_price: float
    tax_rate: float
    tax_amount: float
    discount_percent: float
    discount_amount: float
    line_total: float
    status: str


class POCreate(BaseModel):
    vendor_id: Optional[UUID] = None
    vendor_name: Optional[str] = None
    warehouse_id: Optional[UUID] = None
    order_date: Optional[date] = None
    expected_delivery_date: Optional[date] = None
    payment_terms: Optional[str] = None
    shipping_charges: float = 0
    discount_amount: float = 0
    notes: Optional[str] = None
    items: List[POItemCreate] = []


class POUpdate(BaseModel):
    vendor_id: Optional[UUID] = None
    vendor_name: Optional[str] = None
    warehouse_id: Optional[UUID] = None
    expected_delivery_date: Optional[date] = None
    payment_terms: Optional[str] = None
    shipping_charges: Optional[float] = None
    discount_amount: Optional[float] = None
    notes: Optional[str] = None


class POResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    order_number: str
    vendor_id: Optional[UUID]
    vendor_name: Optional[str]
    warehouse_id: Optional[UUID]
    warehouse_name: Optional[str]
    order_date: date
    expected_delivery_date: Optional[date]
    actual_delivery_date: Optional[date]
    status: str
    payment_terms: Optional[str]
    payment_status: str
    subtotal: float
    tax_amount: float
    shipping_charges: float
    discount_amount: float
    total_amount: float
    notes: Optional[str]
    items: Optional[List[POItemResponse]] = None
    created_at: datetime
    updated_at: datetime


class POListResponse(BaseModel):
    purchase_orders: List[POResponse]
    total: int
    page: int
    limit: int


class POStats(BaseModel):
    total_orders: int
    pending_orders: int
    orders_this_month: int
    total_value_pending: float


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_tenant_id(x_tenant_id: str) -> UUID:
    try:
        return UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant ID format")


def calculate_line_item(
    quantity: float,
    unit_price: float,
    tax_rate: float,
    discount_percent: float
) -> dict:
    """Calculate line item amounts."""
    line_total = quantity * unit_price
    discount_amount = line_total * (discount_percent / 100)
    taxable_amount = line_total - discount_amount
    tax_amount = taxable_amount * (tax_rate / 100)
    
    return {
        "line_total": round(line_total, 2),
        "discount_amount": round(discount_amount, 2),
        "tax_amount": round(tax_amount, 2),
    }


# =============================================================================
# STATS ENDPOINT
# =============================================================================

@router.get("/stats", response_model=POStats)
async def get_purchase_order_stats(x_tenant_id: str = Header(...)):
    """Get purchase order statistics."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                COUNT(*) as total_orders,
                COUNT(*) FILTER (WHERE status IN ('draft', 'pending_approval', 'approved', 'ordered', 'partially_received')) as pending_orders,
                COUNT(*) FILTER (WHERE DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE)) as orders_this_month,
                COALESCE(SUM(total_amount) FILTER (WHERE status IN ('ordered', 'partially_received')), 0) as total_value_pending
            FROM purchase_orders
            WHERE tenant_id = %s
        """, (str(tenant_id),))
        
        row = cur.fetchone()
        
        return POStats(
            total_orders=row["total_orders"],
            pending_orders=row["pending_orders"],
            orders_this_month=row["orders_this_month"],
            total_value_pending=float(row["total_value_pending"])
        )


# =============================================================================
# LIST PURCHASE ORDERS
# =============================================================================

@router.get("", response_model=POListResponse)
async def list_purchase_orders(
    x_tenant_id: str = Header(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    vendor_id: Optional[UUID] = Query(None),
    warehouse_id: Optional[UUID] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("order_date", pattern="^(order_number|order_date|total_amount|status|created_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
):
    """List purchase orders with pagination and filtering."""
    tenant_id = get_tenant_id(x_tenant_id)
    offset = (page - 1) * limit
    
    with get_db_cursor() as cur:
        conditions = ["po.tenant_id = %s"]
        params = [str(tenant_id)]
        
        if status:
            conditions.append("po.status = %s")
            params.append(status)
        
        if vendor_id:
            conditions.append("po.vendor_id = %s")
            params.append(str(vendor_id))
        
        if warehouse_id:
            conditions.append("po.warehouse_id = %s")
            params.append(str(warehouse_id))
        
        if from_date:
            conditions.append("po.order_date >= %s")
            params.append(from_date)
        
        if to_date:
            conditions.append("po.order_date <= %s")
            params.append(to_date)
        
        if search:
            conditions.append("(po.order_number ILIKE %s OR po.vendor_name ILIKE %s)")
            params.extend([f"%{search}%", f"%{search}%"])
        
        where_clause = " AND ".join(conditions)
        
        # Count
        cur.execute(f"""
            SELECT COUNT(*) as count
            FROM purchase_orders po
            WHERE {where_clause}
        """, params)
        total = cur.fetchone()["count"]
        
        # Get orders
        cur.execute(f"""
            SELECT 
                po.*,
                w.name as warehouse_name
            FROM purchase_orders po
            LEFT JOIN warehouses w ON po.warehouse_id = w.id
            WHERE {where_clause}
            ORDER BY po.{sort_by} {sort_order.upper()}
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        
        rows = cur.fetchall()
        
        orders = []
        for row in rows:
            orders.append(POResponse(
                id=row["id"],
                tenant_id=row["tenant_id"],
                order_number=row["order_number"],
                vendor_id=row["vendor_id"],
                vendor_name=row["vendor_name"],
                warehouse_id=row["warehouse_id"],
                warehouse_name=row["warehouse_name"],
                order_date=row["order_date"],
                expected_delivery_date=row["expected_delivery_date"],
                actual_delivery_date=row["actual_delivery_date"],
                status=row["status"],
                payment_terms=row["payment_terms"],
                payment_status=row["payment_status"],
                subtotal=float(row["subtotal"]),
                tax_amount=float(row["tax_amount"]),
                shipping_charges=float(row["shipping_charges"]),
                discount_amount=float(row["discount_amount"]),
                total_amount=float(row["total_amount"]),
                notes=row["notes"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            ))
        
        return POListResponse(
            purchase_orders=orders,
            total=total,
            page=page,
            limit=limit
        )


# =============================================================================
# GET SINGLE PURCHASE ORDER
# =============================================================================

@router.get("/{po_id}", response_model=POResponse)
async def get_purchase_order(
    po_id: UUID,
    x_tenant_id: str = Header(...),
    include_items: bool = Query(True),
):
    """Get a single purchase order with optional items."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT 
                po.*,
                w.name as warehouse_name
            FROM purchase_orders po
            LEFT JOIN warehouses w ON po.warehouse_id = w.id
            WHERE po.id = %s AND po.tenant_id = %s
        """, (str(po_id), str(tenant_id)))
        
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        items = None
        if include_items:
            cur.execute("""
                SELECT * FROM purchase_order_items
                WHERE purchase_order_id = %s
                ORDER BY created_at
            """, (str(po_id),))
            
            items = [
                POItemResponse(
                    id=item["id"],
                    purchase_order_id=item["purchase_order_id"],
                    product_id=item["product_id"],
                    product_sku=item["product_sku"],
                    product_name=item["product_name"],
                    quantity_ordered=float(item["quantity_ordered"]),
                    quantity_received=float(item["quantity_received"]),
                    unit_price=float(item["unit_price"]),
                    tax_rate=float(item["tax_rate"]),
                    tax_amount=float(item["tax_amount"]),
                    discount_percent=float(item["discount_percent"]),
                    discount_amount=float(item["discount_amount"]),
                    line_total=float(item["line_total"]),
                    status=item["status"],
                )
                for item in cur.fetchall()
            ]
        
        return POResponse(
            id=row["id"],
            tenant_id=row["tenant_id"],
            order_number=row["order_number"],
            vendor_id=row["vendor_id"],
            vendor_name=row["vendor_name"],
            warehouse_id=row["warehouse_id"],
            warehouse_name=row["warehouse_name"],
            order_date=row["order_date"],
            expected_delivery_date=row["expected_delivery_date"],
            actual_delivery_date=row["actual_delivery_date"],
            status=row["status"],
            payment_terms=row["payment_terms"],
            payment_status=row["payment_status"],
            subtotal=float(row["subtotal"]),
            tax_amount=float(row["tax_amount"]),
            shipping_charges=float(row["shipping_charges"]),
            discount_amount=float(row["discount_amount"]),
            total_amount=float(row["total_amount"]),
            notes=row["notes"],
            items=items,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


# =============================================================================
# CREATE PURCHASE ORDER
# =============================================================================

@router.post("", response_model=POResponse)
async def create_purchase_order(
    po: POCreate,
    x_tenant_id: str = Header(...),
):
    """Create a new purchase order."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(autocommit=True) as cur:
        # Generate PO number
        cur.execute("SELECT generate_po_number(%s)", (str(tenant_id),))
        order_number = cur.fetchone()["generate_po_number"]
        
        # Get vendor name if vendor_id provided
        vendor_name = po.vendor_name
        if po.vendor_id and not vendor_name:
            cur.execute("SELECT party_name FROM parties WHERE id = %s", (str(po.vendor_id),))
            vendor = cur.fetchone()
            if vendor:
                vendor_name = vendor["party_name"]
        
        # Create PO
        cur.execute("""
            INSERT INTO purchase_orders (
                tenant_id, order_number, vendor_id, vendor_name, warehouse_id,
                order_date, expected_delivery_date, payment_terms,
                shipping_charges, discount_amount, notes
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            RETURNING id
        """, (
            str(tenant_id),
            order_number,
            str(po.vendor_id) if po.vendor_id else None,
            vendor_name,
            str(po.warehouse_id) if po.warehouse_id else None,
            po.order_date or date.today(),
            po.expected_delivery_date,
            po.payment_terms,
            po.shipping_charges,
            po.discount_amount,
            po.notes,
        ))
        
        po_id = cur.fetchone()["id"]
        
        # Add items
        for item in po.items:
            amounts = calculate_line_item(
                item.quantity_ordered,
                item.unit_price,
                item.tax_rate,
                item.discount_percent
            )
            
            cur.execute("""
                INSERT INTO purchase_order_items (
                    purchase_order_id, product_id, product_sku, product_name,
                    quantity_ordered, unit_price, tax_rate, tax_amount,
                    discount_percent, discount_amount, line_total
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
            """, (
                str(po_id),
                str(item.product_id) if item.product_id else None,
                item.product_sku,
                item.product_name,
                item.quantity_ordered,
                item.unit_price,
                item.tax_rate,
                amounts["tax_amount"],
                item.discount_percent,
                amounts["discount_amount"],
                amounts["line_total"],
            ))
        
        # Return created PO
        return await get_purchase_order(po_id, x_tenant_id)


# =============================================================================
# UPDATE PURCHASE ORDER
# =============================================================================

@router.put("/{po_id}", response_model=POResponse)
async def update_purchase_order(
    po_id: UUID,
    po: POUpdate,
    x_tenant_id: str = Header(...),
):
    """Update a purchase order (only in draft/pending_approval status)."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(autocommit=True) as cur:
        # Check status
        cur.execute("""
            SELECT status FROM purchase_orders
            WHERE id = %s AND tenant_id = %s
        """, (str(po_id), str(tenant_id)))
        
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        if row["status"] not in ["draft", "pending_approval"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot edit purchase order in '{row['status']}' status"
            )
        
        # Build update
        updates = []
        params = []
        
        if po.vendor_id is not None:
            updates.append("vendor_id = %s")
            params.append(str(po.vendor_id))
        
        if po.vendor_name is not None:
            updates.append("vendor_name = %s")
            params.append(po.vendor_name)
        
        if po.warehouse_id is not None:
            updates.append("warehouse_id = %s")
            params.append(str(po.warehouse_id))
        
        if po.expected_delivery_date is not None:
            updates.append("expected_delivery_date = %s")
            params.append(po.expected_delivery_date)
        
        if po.payment_terms is not None:
            updates.append("payment_terms = %s")
            params.append(po.payment_terms)
        
        if po.shipping_charges is not None:
            updates.append("shipping_charges = %s")
            params.append(po.shipping_charges)
        
        if po.discount_amount is not None:
            updates.append("discount_amount = %s")
            params.append(po.discount_amount)
        
        if po.notes is not None:
            updates.append("notes = %s")
            params.append(po.notes)
        
        if updates:
            updates.append("updated_at = NOW()")
            cur.execute(f"""
                UPDATE purchase_orders
                SET {", ".join(updates)}
                WHERE id = %s AND tenant_id = %s
            """, params + [str(po_id), str(tenant_id)])
        
        return await get_purchase_order(po_id, x_tenant_id)


# =============================================================================
# STATUS TRANSITIONS
# =============================================================================

@router.post("/{po_id}/submit", response_model=POResponse)
async def submit_for_approval(
    po_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Submit purchase order for approval."""
    return await _update_po_status(po_id, x_tenant_id, "pending_approval", ["draft"])


@router.post("/{po_id}/approve", response_model=POResponse)
async def approve_purchase_order(
    po_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Approve purchase order."""
    return await _update_po_status(po_id, x_tenant_id, "approved", ["pending_approval"])


@router.post("/{po_id}/place-order", response_model=POResponse)
async def place_order(
    po_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Mark purchase order as ordered (sent to vendor)."""
    return await _update_po_status(po_id, x_tenant_id, "ordered", ["approved"])


@router.post("/{po_id}/cancel", response_model=POResponse)
async def cancel_purchase_order(
    po_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Cancel purchase order."""
    return await _update_po_status(
        po_id, x_tenant_id, "cancelled",
        ["draft", "pending_approval", "approved", "ordered"]
    )


@router.post("/{po_id}/close", response_model=POResponse)
async def close_purchase_order(
    po_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Close purchase order (after receiving)."""
    return await _update_po_status(po_id, x_tenant_id, "closed", ["received", "partially_received"])


async def _update_po_status(
    po_id: UUID,
    x_tenant_id: str,
    new_status: str,
    allowed_from: List[str],
) -> POResponse:
    """Helper to update PO status."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(autocommit=True) as cur:
        cur.execute("""
            SELECT status FROM purchase_orders
            WHERE id = %s AND tenant_id = %s
        """, (str(po_id), str(tenant_id)))
        
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        if row["status"] not in allowed_from:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot change status from '{row['status']}' to '{new_status}'"
            )
        
        cur.execute("""
            UPDATE purchase_orders
            SET status = %s, updated_at = NOW()
            WHERE id = %s AND tenant_id = %s
        """, (new_status, str(po_id), str(tenant_id)))
        
        return await get_purchase_order(po_id, x_tenant_id)


