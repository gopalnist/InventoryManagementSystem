"""
Inventory Reports API
=====================
Reports, analytics, and dashboards for inventory
"""

from __future__ import annotations

from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from datetime import datetime, date, timedelta

from shared.db.connection import get_db_cursor

router = APIRouter()


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class InventoryValueReport(BaseModel):
    total_value: float
    total_products: int
    total_units: float
    by_category: List[dict]
    by_warehouse: List[dict]


class LowStockReport(BaseModel):
    items: List[dict]
    total: int
    critical_count: int  # Below 50% of reorder level
    warning_count: int   # Between 50-100% of reorder level


class ExpiryReport(BaseModel):
    expired: List[dict]
    expiring_soon: List[dict]
    total_expired_value: float
    total_expiring_value: float


class StockAgingReport(BaseModel):
    items: List[dict]
    total_dead_stock_value: float
    total_slow_moving_value: float


class MovementSummaryReport(BaseModel):
    period_start: date
    period_end: date
    total_received: float
    total_issued: float
    total_adjustments: float
    total_transfers: float
    net_change: float
    by_product: List[dict]


class DashboardStats(BaseModel):
    total_products: int
    total_stock_value: float
    total_warehouses: int
    low_stock_count: int
    out_of_stock_count: int
    expiring_soon_count: int
    pending_receipts: int
    top_products: List[dict]
    recent_movements: List[dict]
    stock_by_warehouse: List[dict]
    stock_by_category: List[dict]


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_tenant_id(x_tenant_id: str = Header(...)) -> UUID:
    try:
        return UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant ID format")


# =============================================================================
# DASHBOARD
# =============================================================================

@router.get("/dashboard", response_model=DashboardStats)
async def get_inventory_dashboard(x_tenant_id: str = Header(...)):
    """Get comprehensive inventory dashboard data."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        # Basic stats
        cur.execute("""
            SELECT 
                COUNT(DISTINCT i.product_id) as total_products,
                COALESCE(SUM(i.on_hand_qty * i.unit_cost), 0) as total_stock_value,
                COUNT(DISTINCT i.warehouse_id) as total_warehouses,
                COUNT(*) FILTER (WHERE i.available_qty > 0 AND i.available_qty <= i.reorder_level) as low_stock_count,
                COUNT(*) FILTER (WHERE i.available_qty <= 0) as out_of_stock_count
            FROM inventory i
            WHERE i.tenant_id = %s
        """, [str(tenant_id)])
        
        basic_stats = cur.fetchone()
        
        # Count products with expiry tracking that are expiring soon (30 days)
        cur.execute("""
            SELECT COUNT(*) as count
            FROM products p
            WHERE p.tenant_id = %s AND p.track_expiry = true
        """, [str(tenant_id)])
        
        expiry_stats = cur.fetchone()
        
        # Top products by value
        cur.execute("""
            SELECT 
                p.id, p.name, p.sku, p.image_url,
                SUM(i.on_hand_qty) as total_qty,
                SUM(i.on_hand_qty * i.unit_cost) as total_value
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            WHERE i.tenant_id = %s AND i.on_hand_qty > 0
            GROUP BY p.id, p.name, p.sku, p.image_url
            ORDER BY total_value DESC
            LIMIT 10
        """, [str(tenant_id)])
        
        top_products = [{
            "id": str(r['id']),
            "name": r['name'],
            "sku": r['sku'],
            "image_url": r['image_url'],
            "total_qty": float(r['total_qty']),
            "total_value": float(r['total_value'])
        } for r in cur.fetchall()]
        
        # Recent movements
        cur.execute("""
            SELECT 
                t.id, t.transaction_type, t.quantity, t.created_at,
                p.name as product_name, p.sku as product_sku,
                w.name as warehouse_name
            FROM inventory_transactions t
            JOIN products p ON p.id = t.product_id
            JOIN warehouses w ON w.id = t.warehouse_id
            WHERE t.tenant_id = %s
            ORDER BY t.created_at DESC
            LIMIT 10
        """, [str(tenant_id)])
        
        recent_movements = [{
            "id": str(r['id']),
            "type": r['transaction_type'],
            "quantity": float(r['quantity']),
            "product_name": r['product_name'],
            "product_sku": r['product_sku'],
            "warehouse_name": r['warehouse_name'],
            "created_at": r['created_at'].isoformat()
        } for r in cur.fetchall()]
        
        # Stock by warehouse
        cur.execute("""
            SELECT 
                w.id, w.name, w.code,
                COALESCE(SUM(i.on_hand_qty * i.unit_cost), 0) as total_value,
                COUNT(DISTINCT i.product_id) as product_count
            FROM warehouses w
            LEFT JOIN inventory i ON i.warehouse_id = w.id
            WHERE w.tenant_id = %s AND w.is_active = true
            GROUP BY w.id, w.name, w.code
            ORDER BY total_value DESC
        """, [str(tenant_id)])
        
        stock_by_warehouse = [{
            "id": str(r['id']),
            "name": r['name'],
            "code": r['code'],
            "total_value": float(r['total_value']),
            "product_count": r['product_count']
        } for r in cur.fetchall()]
        
        # Stock by category
        cur.execute("""
            SELECT 
                c.id, c.name,
                COALESCE(SUM(i.on_hand_qty * i.unit_cost), 0) as total_value,
                COUNT(DISTINCT i.product_id) as product_count
            FROM categories c
            LEFT JOIN products p ON p.category_id = c.id
            LEFT JOIN inventory i ON i.product_id = p.id
            WHERE c.tenant_id = %s
            GROUP BY c.id, c.name
            HAVING SUM(i.on_hand_qty * i.unit_cost) > 0
            ORDER BY total_value DESC
            LIMIT 10
        """, [str(tenant_id)])
        
        stock_by_category = [{
            "id": str(r['id']),
            "name": r['name'],
            "total_value": float(r['total_value']),
            "product_count": r['product_count']
        } for r in cur.fetchall()]
        
        return DashboardStats(
            total_products=basic_stats['total_products'] or 0,
            total_stock_value=float(basic_stats['total_stock_value'] or 0),
            total_warehouses=basic_stats['total_warehouses'] or 0,
            low_stock_count=basic_stats['low_stock_count'] or 0,
            out_of_stock_count=basic_stats['out_of_stock_count'] or 0,
            expiring_soon_count=0,  # Would need batch tracking implemented
            pending_receipts=0,  # Would need PO tracking
            top_products=top_products,
            recent_movements=recent_movements,
            stock_by_warehouse=stock_by_warehouse,
            stock_by_category=stock_by_category
        )


# =============================================================================
# INVENTORY VALUE REPORT
# =============================================================================

@router.get("/value", response_model=InventoryValueReport)
async def get_inventory_value_report(
    x_tenant_id: str = Header(...),
    warehouse_id: Optional[str] = None
):
    """Get inventory valuation report."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        conditions = ["i.tenant_id = %s"]
        params = [str(tenant_id)]
        
        if warehouse_id:
            conditions.append("i.warehouse_id = %s")
            params.append(warehouse_id)
        
        where_clause = " AND ".join(conditions)
        
        # Total value
        cur.execute(f"""
            SELECT 
                COALESCE(SUM(i.on_hand_qty * i.unit_cost), 0) as total_value,
                COUNT(DISTINCT i.product_id) as total_products,
                COALESCE(SUM(i.on_hand_qty), 0) as total_units
            FROM inventory i
            WHERE {where_clause}
        """, params)
        
        totals = cur.fetchone()
        
        # By category
        cur.execute(f"""
            SELECT 
                c.id, c.name,
                COALESCE(SUM(i.on_hand_qty * i.unit_cost), 0) as value,
                COALESCE(SUM(i.on_hand_qty), 0) as units,
                COUNT(DISTINCT i.product_id) as products
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE {where_clause}
            GROUP BY c.id, c.name
            ORDER BY value DESC
        """, params)
        
        by_category = [{
            "id": str(r['id']) if r['id'] else None,
            "name": r['name'] or "Uncategorized",
            "value": float(r['value']),
            "units": float(r['units']),
            "products": r['products']
        } for r in cur.fetchall()]
        
        # By warehouse
        cur.execute(f"""
            SELECT 
                w.id, w.name, w.code,
                COALESCE(SUM(i.on_hand_qty * i.unit_cost), 0) as value,
                COALESCE(SUM(i.on_hand_qty), 0) as units,
                COUNT(DISTINCT i.product_id) as products
            FROM inventory i
            JOIN warehouses w ON w.id = i.warehouse_id
            WHERE {where_clause}
            GROUP BY w.id, w.name, w.code
            ORDER BY value DESC
        """, params)
        
        by_warehouse = [{
            "id": str(r['id']),
            "name": r['name'],
            "code": r['code'],
            "value": float(r['value']),
            "units": float(r['units']),
            "products": r['products']
        } for r in cur.fetchall()]
        
        return InventoryValueReport(
            total_value=float(totals['total_value']),
            total_products=totals['total_products'],
            total_units=float(totals['total_units']),
            by_category=by_category,
            by_warehouse=by_warehouse
        )


# =============================================================================
# LOW STOCK REPORT
# =============================================================================

@router.get("/low-stock", response_model=LowStockReport)
async def get_low_stock_report(
    x_tenant_id: str = Header(...),
    warehouse_id: Optional[str] = None,
    category_id: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500)
):
    """Get detailed low stock report."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        conditions = ["i.tenant_id = %s", "i.reorder_level > 0", "i.available_qty <= i.reorder_level"]
        params = [str(tenant_id)]
        
        if warehouse_id:
            conditions.append("i.warehouse_id = %s")
            params.append(warehouse_id)
        
        if category_id:
            conditions.append("p.category_id = %s")
            params.append(category_id)
        
        where_clause = " AND ".join(conditions)
        
        cur.execute(f"""
            SELECT 
                i.*,
                p.name as product_name, p.sku as product_sku, p.image_url,
                c.name as category_name,
                w.name as warehouse_name, w.code as warehouse_code,
                CASE 
                    WHEN i.available_qty <= i.reorder_level * 0.5 THEN 'critical'
                    ELSE 'warning'
                END as severity
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            JOIN warehouses w ON w.id = i.warehouse_id
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE {where_clause}
            ORDER BY (i.available_qty / NULLIF(i.reorder_level, 0)) ASC
            LIMIT %s
        """, params + [limit])
        
        rows = cur.fetchall()
        
        items = [{
            "id": str(r['id']),
            "product_id": str(r['product_id']),
            "product_name": r['product_name'],
            "product_sku": r['product_sku'],
            "image_url": r['image_url'],
            "category_name": r['category_name'],
            "warehouse_id": str(r['warehouse_id']),
            "warehouse_name": r['warehouse_name'],
            "on_hand_qty": float(r['on_hand_qty']),
            "available_qty": float(r['available_qty']),
            "reorder_level": float(r['reorder_level']),
            "reorder_qty": float(r['reorder_qty'] or 0),
            "shortage": float(r['reorder_level']) - float(r['available_qty']),
            "severity": r['severity']
        } for r in rows]
        
        critical_count = len([i for i in items if i['severity'] == 'critical'])
        warning_count = len([i for i in items if i['severity'] == 'warning'])
        
        return LowStockReport(
            items=items,
            total=len(items),
            critical_count=critical_count,
            warning_count=warning_count
        )


# =============================================================================
# STOCK AGING / DEAD STOCK REPORT
# =============================================================================

@router.get("/aging", response_model=StockAgingReport)
async def get_stock_aging_report(
    x_tenant_id: str = Header(...),
    days_threshold: int = Query(90, description="Days without movement to consider slow/dead"),
    warehouse_id: Optional[str] = None
):
    """Get stock aging report (slow moving and dead stock)."""
    tenant_id = get_tenant_id(x_tenant_id)
    cutoff_date = datetime.now() - timedelta(days=days_threshold)
    
    with get_db_cursor(dict_cursor=True) as cur:
        conditions = ["i.tenant_id = %s", "i.on_hand_qty > 0"]
        params = [str(tenant_id)]
        
        if warehouse_id:
            conditions.append("i.warehouse_id = %s")
            params.append(warehouse_id)
        
        where_clause = " AND ".join(conditions)
        
        # Get items with no recent movement
        cur.execute(f"""
            SELECT 
                i.*,
                p.name as product_name, p.sku as product_sku,
                w.name as warehouse_name,
                COALESCE(i.last_sold_date, i.created_at::date) as last_activity,
                CURRENT_DATE - COALESCE(i.last_sold_date, i.created_at::date) as days_stagnant,
                CASE 
                    WHEN COALESCE(i.last_sold_date, i.created_at::date) < %s THEN 'dead'
                    ELSE 'slow_moving'
                END as status
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            JOIN warehouses w ON w.id = i.warehouse_id
            WHERE {where_clause}
            AND (i.last_sold_date IS NULL OR i.last_sold_date < CURRENT_DATE - INTERVAL '%s days')
            ORDER BY days_stagnant DESC
        """, params + [cutoff_date.date(), days_threshold // 2])
        
        rows = cur.fetchall()
        
        items = [{
            "id": str(r['id']),
            "product_id": str(r['product_id']),
            "product_name": r['product_name'],
            "product_sku": r['product_sku'],
            "warehouse_name": r['warehouse_name'],
            "on_hand_qty": float(r['on_hand_qty']),
            "unit_cost": float(r['unit_cost'] or 0),
            "total_value": float(r['total_value'] or 0),
            "last_activity": r['last_activity'].isoformat() if r['last_activity'] else None,
            "days_stagnant": r['days_stagnant'],
            "status": r['status']
        } for r in rows]
        
        dead_stock_value = sum(i['total_value'] for i in items if i['status'] == 'dead')
        slow_moving_value = sum(i['total_value'] for i in items if i['status'] == 'slow_moving')
        
        return StockAgingReport(
            items=items,
            total_dead_stock_value=dead_stock_value,
            total_slow_moving_value=slow_moving_value
        )


# =============================================================================
# MOVEMENT SUMMARY REPORT
# =============================================================================

@router.get("/movement-summary", response_model=MovementSummaryReport)
async def get_movement_summary_report(
    x_tenant_id: str = Header(...),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    warehouse_id: Optional[str] = None
):
    """Get stock movement summary for a period."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    # Default to last 30 days
    if not to_date:
        to_date = date.today()
    if not from_date:
        from_date = to_date - timedelta(days=30)
    
    with get_db_cursor(dict_cursor=True) as cur:
        conditions = ["t.tenant_id = %s", "t.created_at >= %s", "t.created_at <= %s"]
        params = [str(tenant_id), from_date, to_date + timedelta(days=1)]
        
        if warehouse_id:
            conditions.append("i.warehouse_id = %s")
            params.append(warehouse_id)
        
        where_clause = " AND ".join(conditions)
        
        # Summary by type
        cur.execute(f"""
            SELECT 
                t.transaction_type,
                SUM(t.quantity) as total_qty
            FROM inventory_transactions t
            WHERE t.tenant_id = %s AND t.created_at >= %s AND t.created_at <= %s
            {"AND t.warehouse_id = %s" if warehouse_id else ""}
            GROUP BY t.transaction_type
        """, params)
        
        type_summary = {r['transaction_type']: float(r['total_qty']) for r in cur.fetchall()}
        
        total_received = type_summary.get('in', 0) + type_summary.get('transfer_in', 0)
        total_issued = type_summary.get('out', 0) + type_summary.get('transfer_out', 0)
        total_adjustments = type_summary.get('adjust_in', 0) - type_summary.get('adjust_out', 0)
        total_transfers = type_summary.get('transfer_in', 0)
        
        # By product
        cur.execute(f"""
            SELECT 
                p.id, p.name, p.sku,
                SUM(CASE WHEN t.transaction_type IN ('in', 'transfer_in', 'adjust_in') THEN t.quantity ELSE 0 END) as qty_in,
                SUM(CASE WHEN t.transaction_type IN ('out', 'transfer_out', 'adjust_out') THEN t.quantity ELSE 0 END) as qty_out
            FROM inventory_transactions t
            JOIN products p ON p.id = t.product_id
            WHERE t.tenant_id = %s AND t.created_at >= %s AND t.created_at <= %s
            {"AND t.warehouse_id = %s" if warehouse_id else ""}
            GROUP BY p.id, p.name, p.sku
            ORDER BY (
                SUM(CASE WHEN t.transaction_type IN ('in', 'transfer_in', 'adjust_in') THEN t.quantity ELSE 0 END) +
                SUM(CASE WHEN t.transaction_type IN ('out', 'transfer_out', 'adjust_out') THEN t.quantity ELSE 0 END)
            ) DESC
            LIMIT 50
        """, params)
        
        by_product = [{
            "id": str(r['id']),
            "name": r['name'],
            "sku": r['sku'],
            "qty_in": float(r['qty_in']),
            "qty_out": float(r['qty_out']),
            "net_change": float(r['qty_in']) - float(r['qty_out'])
        } for r in cur.fetchall()]
        
        return MovementSummaryReport(
            period_start=from_date,
            period_end=to_date,
            total_received=total_received,
            total_issued=total_issued,
            total_adjustments=total_adjustments,
            total_transfers=total_transfers,
            net_change=total_received - total_issued + total_adjustments,
            by_product=by_product
        )


# =============================================================================
# REORDER SUGGESTIONS
# =============================================================================

@router.get("/reorder-suggestions")
async def get_reorder_suggestions(
    x_tenant_id: str = Header(...),
    warehouse_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200)
):
    """Get products that need to be reordered."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        conditions = [
            "i.tenant_id = %s",
            "i.reorder_level > 0",
            "i.available_qty <= i.reorder_level"
        ]
        params = [str(tenant_id)]
        
        if warehouse_id:
            conditions.append("i.warehouse_id = %s")
            params.append(warehouse_id)
        
        where_clause = " AND ".join(conditions)
        
        cur.execute(f"""
            SELECT 
                i.*,
                p.name as product_name, p.sku as product_sku,
                p.preferred_vendor_id,
                v.party_name as vendor_name,
                w.name as warehouse_name,
                GREATEST(i.reorder_qty, i.reorder_level - i.available_qty) as suggested_qty
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            JOIN warehouses w ON w.id = i.warehouse_id
            LEFT JOIN parties v ON v.id = p.preferred_vendor_id
            WHERE {where_clause}
            ORDER BY (i.available_qty / NULLIF(i.reorder_level, 0)) ASC
            LIMIT %s
        """, params + [limit])
        
        rows = cur.fetchall()
        
        suggestions = [{
            "product_id": str(r['product_id']),
            "product_name": r['product_name'],
            "product_sku": r['product_sku'],
            "warehouse_id": str(r['warehouse_id']),
            "warehouse_name": r['warehouse_name'],
            "vendor_id": str(r['preferred_vendor_id']) if r['preferred_vendor_id'] else None,
            "vendor_name": r['vendor_name'],
            "current_stock": float(r['available_qty']),
            "reorder_level": float(r['reorder_level']),
            "reorder_qty": float(r['reorder_qty'] or 0),
            "suggested_qty": float(r['suggested_qty']),
            "unit_cost": float(r['unit_cost'] or 0),
            "estimated_cost": float(r['suggested_qty']) * float(r['unit_cost'] or 0)
        } for r in rows]
        
        total_estimated_cost = sum(s['estimated_cost'] for s in suggestions)
        
        return {
            "suggestions": suggestions,
            "total": len(suggestions),
            "total_estimated_cost": total_estimated_cost
        }

