"""
Production Orders API Routes
============================
CRUD operations for production/assembly orders.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional, List
from uuid import UUID, uuid4
from datetime import datetime
import math
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, Header

# Add shared to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent.parent))

from shared.db import get_db_cursor

from ..models.production import (
    ProductionOrderCreate,
    ProductionOrderUpdate,
    ProductionOrderResponse,
    ProductionOrderListResponse,
    ProductionOrderStatusUpdate,
    ProductionOrderSummary,
    ProductionComponentResponse,
    ProductionHistoryEntry,
    ProductionHistoryResponse,
    StartProductionRequest,
    CompleteProductionRequest,
    CancelProductionRequest,
)

router = APIRouter()


# --- Helper Functions ---

def get_tenant_id(x_tenant_id: str = Header(...)) -> UUID:
    """Extract tenant ID from header."""
    try:
        return UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant ID")


def generate_order_number(cur, tenant_id: UUID) -> str:
    """Generate next production order number."""
    cur.execute(
        """
        SELECT order_number FROM production_orders 
        WHERE tenant_id = %s 
        ORDER BY created_at DESC 
        LIMIT 1
        """,
        (str(tenant_id),)
    )
    row = cur.fetchone()
    
    if row:
        # Parse last number and increment
        last_num = row["order_number"]
        try:
            prefix, year, num = last_num.rsplit("-", 2)
            next_num = int(num) + 1
            current_year = datetime.now().year
            if int(year) != current_year:
                # Reset for new year
                return f"PO-{current_year}-001"
            return f"{prefix}-{year}-{str(next_num).zfill(3)}"
        except:
            pass
    
    # First order
    return f"PO-{datetime.now().year}-001"


def add_history_entry(cur, order_id: UUID, action: str, prev_status: str = None, 
                      new_status: str = None, quantity_change: int = None, 
                      notes: str = None, performed_by: UUID = None, 
                      performed_by_name: str = None):
    """Add an entry to production history."""
    cur.execute(
        """
        INSERT INTO production_history (
            id, production_order_id, action, previous_status, new_status,
            quantity_change, notes, performed_by, performed_by_name, performed_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        """,
        (
            str(uuid4()), str(order_id), action, prev_status, new_status,
            quantity_change, notes, str(performed_by) if performed_by else None,
            performed_by_name or "System"
        )
    )


# ============================================================================
# PRODUCTION ORDERS ENDPOINTS
# ============================================================================

@router.get("", response_model=ProductionOrderListResponse)
async def list_production_orders(
    x_tenant_id: str = Header(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by order number or bundle name"),
    bundle_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None, description="draft, pending, in_progress, completed, cancelled"),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
):
    """List production orders with pagination and filtering."""
    tenant_id = get_tenant_id(x_tenant_id)
    offset = (page - 1) * limit
    
    with get_db_cursor() as cur:
        # Base query
        base_query = """
            FROM production_orders po
            JOIN product_bundles pb ON po.bundle_id = pb.id
            WHERE po.tenant_id = %s
        """
        params = [str(tenant_id)]
        
        # Filters
        if search:
            base_query += " AND (po.order_number ILIKE %s OR pb.name ILIKE %s)"
            params.extend([f"%{search}%", f"%{search}%"])
        
        if bundle_id:
            base_query += " AND po.bundle_id = %s"
            params.append(str(bundle_id))
        
        if status:
            base_query += " AND po.status = %s"
            params.append(status)
        
        # Count total
        cur.execute(f"SELECT COUNT(*) {base_query}", params)
        total = cur.fetchone()["count"]
        
        # Get paginated results
        allowed_sort_fields = ["order_number", "created_at", "expected_date", "status"]
        if sort_by not in allowed_sort_fields:
            sort_by = "created_at"
        
        select_query = f"""
            SELECT 
                po.*,
                pb.name as bundle_name,
                pb.sku as bundle_sku
            {base_query}
            ORDER BY po.{sort_by} {sort_order}
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])
        
        cur.execute(select_query, params)
        rows = cur.fetchall()
        
        orders = [ProductionOrderResponse(**dict(row)) for row in rows]
        total_pages = math.ceil(total / limit) if total > 0 else 0
        
        return ProductionOrderListResponse(
            orders=orders,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages
        )


@router.get("/summary", response_model=ProductionOrderSummary)
async def get_production_summary(
    x_tenant_id: str = Header(...),
):
    """Get summary statistics for production orders."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT 
                COUNT(*) as total_orders,
                COUNT(*) FILTER (WHERE status = 'draft') as draft_orders,
                COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
                COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_orders,
                COUNT(*) FILTER (WHERE status = 'completed') as completed_orders,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
                COALESCE(SUM(quantity_produced) FILTER (WHERE status = 'completed'), 0) as total_units_produced
            FROM production_orders
            WHERE tenant_id = %s
            """,
            (str(tenant_id),)
        )
        row = cur.fetchone()
        
        return ProductionOrderSummary(**dict(row))


@router.get("/{order_id}", response_model=ProductionOrderResponse)
async def get_production_order(
    order_id: UUID,
    x_tenant_id: str = Header(...),
    include_components: bool = Query(True),
):
    """Get a single production order by ID."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT 
                po.*,
                pb.name as bundle_name,
                pb.sku as bundle_sku
            FROM production_orders po
            JOIN product_bundles pb ON po.bundle_id = pb.id
            WHERE po.id = %s AND po.tenant_id = %s
            """,
            (str(order_id), str(tenant_id))
        )
        row = cur.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Production order not found")
        
        order = ProductionOrderResponse(**dict(row))
        
        # Get components if requested
        if include_components:
            cur.execute(
                """
                SELECT 
                    poc.*,
                    p.name as product_name,
                    p.sku as product_sku,
                    u.name as product_unit_name
                FROM production_order_components poc
                JOIN products p ON poc.product_id = p.id
                LEFT JOIN units u ON p.primary_unit_id = u.id
                WHERE poc.production_order_id = %s
                """,
                (str(order_id),)
            )
            order.components = [ProductionComponentResponse(**dict(c)) for c in cur.fetchall()]
        
        return order


@router.post("", response_model=ProductionOrderResponse, status_code=201)
async def create_production_order(
    data: ProductionOrderCreate,
    x_tenant_id: str = Header(...),
):
    """Create a new production order."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Verify bundle exists
        cur.execute(
            "SELECT id, total_cost FROM product_bundles WHERE id = %s AND tenant_id = %s",
            (str(data.bundle_id), str(tenant_id))
        )
        bundle = cur.fetchone()
        if not bundle:
            raise HTTPException(status_code=400, detail="Bundle not found")
        
        # Generate order number
        order_number = generate_order_number(cur, tenant_id)
        
        # Calculate estimated cost
        bundle_cost = bundle["total_cost"] or Decimal(0)
        estimated_cost = bundle_cost * data.quantity_ordered
        
        # Insert order
        order_id = uuid4()
        cur.execute(
            """
            INSERT INTO production_orders (
                id, tenant_id, order_number, bundle_id,
                quantity_ordered, quantity_produced,
                status, expected_date, assigned_to,
                estimated_cost, notes,
                created_at
            ) VALUES (
                %s, %s, %s, %s,
                %s, 0,
                %s, %s, %s,
                %s, %s,
                NOW()
            )
            RETURNING *
            """,
            (
                str(order_id), str(tenant_id), order_number, str(data.bundle_id),
                data.quantity_ordered,
                data.status, data.expected_date, data.assigned_to,
                estimated_cost, data.notes,
            )
        )
        
        # Create component requirements from bundle BOM
        cur.execute(
            """
            SELECT bc.product_id, bc.quantity, bc.unit_cost, p.cost_price
            FROM bundle_components bc
            JOIN products p ON bc.product_id = p.id
            WHERE bc.bundle_id = %s AND bc.product_id IS NOT NULL
            """,
            (str(data.bundle_id),)
        )
        
        for comp in cur.fetchall():
            quantity_required = comp["quantity"] * data.quantity_ordered
            unit_cost = comp["unit_cost"] or comp["cost_price"] or Decimal(0)
            total_cost = unit_cost * quantity_required
            
            cur.execute(
                """
                INSERT INTO production_order_components (
                    id, production_order_id, product_id,
                    quantity_required, quantity_consumed,
                    unit_cost, total_cost, is_fulfilled, created_at
                ) VALUES (%s, %s, %s, %s, 0, %s, %s, false, NOW())
                """,
                (
                    str(uuid4()), str(order_id), str(comp["product_id"]),
                    quantity_required, unit_cost, total_cost,
                )
            )
        
        # Add history entry
        add_history_entry(cur, order_id, "created", new_status=data.status)
        
        return await get_production_order(order_id, x_tenant_id)


@router.put("/{order_id}", response_model=ProductionOrderResponse)
async def update_production_order(
    order_id: UUID,
    data: ProductionOrderUpdate,
    x_tenant_id: str = Header(...),
):
    """Update a production order (only allowed for draft/pending orders)."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check exists and status
        cur.execute(
            "SELECT id, status FROM production_orders WHERE id = %s AND tenant_id = %s",
            (str(order_id), str(tenant_id))
        )
        order = cur.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Production order not found")
        
        if order["status"] not in ("draft", "pending"):
            raise HTTPException(
                status_code=400,
                detail="Can only update orders in draft or pending status"
            )
        
        # Build update
        updates = []
        params = []
        
        for field, value in data.model_dump(exclude_unset=True).items():
            if value is not None:
                updates.append(f"{field} = %s")
                params.append(value)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        updates.append("updated_at = NOW()")
        params.extend([str(order_id), str(tenant_id)])
        
        cur.execute(
            f"""
            UPDATE production_orders 
            SET {', '.join(updates)}
            WHERE id = %s AND tenant_id = %s
            RETURNING *
            """,
            params
        )
        
        return await get_production_order(order_id, x_tenant_id)


@router.post("/{order_id}/start", response_model=ProductionOrderResponse)
async def start_production(
    order_id: UUID,
    data: StartProductionRequest,
    x_tenant_id: str = Header(...),
):
    """Start a production order (move from pending to in_progress)."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT id, status FROM production_orders WHERE id = %s AND tenant_id = %s",
            (str(order_id), str(tenant_id))
        )
        order = cur.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Production order not found")
        
        if order["status"] not in ("draft", "pending"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot start order in {order['status']} status"
            )
        
        cur.execute(
            """
            UPDATE production_orders 
            SET status = 'in_progress', started_at = NOW(), updated_at = NOW()
            WHERE id = %s
            """,
            (str(order_id),)
        )
        
        add_history_entry(
            cur, order_id, "started", 
            prev_status=order["status"], 
            new_status="in_progress",
            notes=data.notes
        )
        
        return await get_production_order(order_id, x_tenant_id)


@router.post("/{order_id}/complete", response_model=ProductionOrderResponse)
async def complete_production(
    order_id: UUID,
    data: CompleteProductionRequest,
    x_tenant_id: str = Header(...),
):
    """Complete a production order."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT * FROM production_orders WHERE id = %s AND tenant_id = %s",
            (str(order_id), str(tenant_id))
        )
        order = cur.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Production order not found")
        
        if order["status"] != "in_progress":
            raise HTTPException(
                status_code=400,
                detail="Can only complete orders that are in progress"
            )
        
        # Determine final status
        final_status = "completed"
        if data.quantity_produced < order["quantity_ordered"]:
            # Partial completion - still mark as completed but track difference
            pass
        
        cur.execute(
            """
            UPDATE production_orders 
            SET status = %s, quantity_produced = %s, completed_at = NOW(), 
                actual_cost = estimated_cost, updated_at = NOW()
            WHERE id = %s
            """,
            (final_status, data.quantity_produced, str(order_id))
        )
        
        add_history_entry(
            cur, order_id, "completed",
            prev_status="in_progress",
            new_status=final_status,
            quantity_change=data.quantity_produced,
            notes=data.notes
        )
        
        # TODO: Update inventory - add produced bundles, deduct components
        
        return await get_production_order(order_id, x_tenant_id)


@router.post("/{order_id}/cancel", response_model=ProductionOrderResponse)
async def cancel_production(
    order_id: UUID,
    data: CancelProductionRequest,
    x_tenant_id: str = Header(...),
):
    """Cancel a production order."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT id, status FROM production_orders WHERE id = %s AND tenant_id = %s",
            (str(order_id), str(tenant_id))
        )
        order = cur.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Production order not found")
        
        if order["status"] in ("completed", "cancelled"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel order in {order['status']} status"
            )
        
        cur.execute(
            """
            UPDATE production_orders 
            SET status = 'cancelled', cancellation_reason = %s, updated_at = NOW()
            WHERE id = %s
            """,
            (data.reason, str(order_id))
        )
        
        add_history_entry(
            cur, order_id, "cancelled",
            prev_status=order["status"],
            new_status="cancelled",
            notes=data.reason
        )
        
        return await get_production_order(order_id, x_tenant_id)


@router.delete("/{order_id}", status_code=204)
async def delete_production_order(
    order_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Delete a production order (only draft orders)."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT status FROM production_orders WHERE id = %s AND tenant_id = %s",
            (str(order_id), str(tenant_id))
        )
        order = cur.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Production order not found")
        
        if order["status"] != "draft":
            raise HTTPException(
                status_code=400,
                detail="Can only delete draft orders"
            )
        
        cur.execute(
            "DELETE FROM production_orders WHERE id = %s",
            (str(order_id),)
        )


@router.get("/{order_id}/history", response_model=ProductionHistoryResponse)
async def get_production_history(
    order_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Get history of a production order."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Verify order exists
        cur.execute(
            "SELECT order_number FROM production_orders WHERE id = %s AND tenant_id = %s",
            (str(order_id), str(tenant_id))
        )
        order = cur.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Production order not found")
        
        cur.execute(
            """
            SELECT * FROM production_history 
            WHERE production_order_id = %s 
            ORDER BY performed_at DESC
            """,
            (str(order_id),)
        )
        
        history = [ProductionHistoryEntry(**dict(row)) for row in cur.fetchall()]
        
        return ProductionHistoryResponse(
            order_id=order_id,
            order_number=order["order_number"],
            history=history
        )

