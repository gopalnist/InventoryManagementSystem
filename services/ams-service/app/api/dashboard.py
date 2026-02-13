"""AMS Dashboard API"""
from fastapi import APIRouter, Depends, Header
from typing import Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from ..config import get_settings

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
settings = get_settings()

# Default tenant ID for demo
DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"


def get_db_connection():
    """Get database connection."""
    return psycopg2.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        dbname=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD
    )


def get_tenant_id(x_tenant_id: Optional[str] = Header(None)) -> str:
    """Get tenant ID from header or use default."""
    return x_tenant_id or DEFAULT_TENANT_ID


@router.get("/stats")
def get_dashboard_stats(tenant_id: str = Depends(get_tenant_id)):
    """Get dashboard statistics."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            stats = {}
            
            # Get vendor info
            cur.execute("""
                SELECT id, vendor_code, vendor_name 
                FROM vendors 
                WHERE tenant_id = %s AND is_active = TRUE
                LIMIT 1
            """, (tenant_id,))
            vendor = cur.fetchone()
            stats['vendor'] = vendor
            
            if not vendor:
                return {
                    "vendor": None,
                    "total_skus": 0,
                    "total_warehouses": 0,
                    "total_orders": 0,
                    "pending_orders": 0,
                    "fulfilled_orders": 0,
                    "partial_orders": 0,
                    "total_inventory_value": 0
                }
            
            vendor_id = vendor['id']
            
            # Total SKUs
            cur.execute("""
                SELECT COUNT(*) as count FROM vendor_skus 
                WHERE tenant_id = %s AND vendor_id = %s AND is_active = TRUE
            """, (tenant_id, vendor_id))
            stats['total_skus'] = cur.fetchone()['count']
            
            # Total Warehouses
            cur.execute("""
                SELECT COUNT(*) as count FROM vendor_warehouses 
                WHERE tenant_id = %s AND vendor_id = %s AND is_active = TRUE
            """, (tenant_id, vendor_id))
            stats['total_warehouses'] = cur.fetchone()['count']
            
            # Total Orders
            cur.execute("""
                SELECT COUNT(*) as count FROM purchase_orders 
                WHERE tenant_id = %s AND vendor_id = %s AND is_cancelled = FALSE
            """, (tenant_id, vendor_id))
            stats['total_orders'] = cur.fetchone()['count']
            
            # Pending Orders (RECEIVED status)
            cur.execute("""
                SELECT COUNT(*) as count FROM purchase_orders 
                WHERE tenant_id = %s AND vendor_id = %s 
                AND status = 'RECEIVED' AND is_cancelled = FALSE
            """, (tenant_id, vendor_id))
            stats['pending_orders'] = cur.fetchone()['count']
            
            # Fulfilled Orders
            cur.execute("""
                SELECT COUNT(*) as count FROM purchase_orders 
                WHERE tenant_id = %s AND vendor_id = %s 
                AND fulfillment_status = 'FULFILLED' AND is_cancelled = FALSE
            """, (tenant_id, vendor_id))
            stats['fulfilled_orders'] = cur.fetchone()['count']
            
            # Partial Orders
            cur.execute("""
                SELECT COUNT(*) as count FROM purchase_orders 
                WHERE tenant_id = %s AND vendor_id = %s 
                AND fulfillment_status = 'PARTIAL' AND is_cancelled = FALSE
            """, (tenant_id, vendor_id))
            stats['partial_orders'] = cur.fetchone()['count']
            
            # Total Inventory (sum of on_hand)
            cur.execute("""
                SELECT COALESCE(SUM(on_hand_qty), 0) as total 
                FROM inventory 
                WHERE tenant_id = %s AND vendor_id = %s
            """, (tenant_id, vendor_id))
            stats['total_inventory_qty'] = float(cur.fetchone()['total'])
            
            return stats
            
    finally:
        conn.close()


@router.get("/recent-orders")
def get_recent_orders(tenant_id: str = Depends(get_tenant_id), limit: int = 5):
    """Get recent purchase orders."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get vendor
            cur.execute("""
                SELECT id FROM vendors 
                WHERE tenant_id = %s AND is_active = TRUE LIMIT 1
            """, (tenant_id,))
            vendor = cur.fetchone()
            
            if not vendor:
                return []
            
            cur.execute("""
                SELECT 
                    po.id,
                    po.channel,
                    po.po_number,
                    po.fc_code,
                    po.status,
                    po.fulfillment_status,
                    po.created_at,
                    (SELECT COUNT(*) FROM purchase_order_lines WHERE po_id = po.id) as line_count
                FROM purchase_orders po
                WHERE po.tenant_id = %s AND po.vendor_id = %s AND po.is_cancelled = FALSE
                ORDER BY po.created_at DESC
                LIMIT %s
            """, (tenant_id, vendor['id'], limit))
            
            orders = cur.fetchall()
            return [dict(o) for o in orders]
            
    finally:
        conn.close()
