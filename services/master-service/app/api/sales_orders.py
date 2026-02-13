"""
Sales Orders API Routes
=======================
CRUD operations and status management for sales orders.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from psycopg2.extras import RealDictCursor

from shared.db.connection import get_db_cursor
from app.models.sales_order import (
    SalesOrderStatus, LineItemStatus, Platform, Priority,
    FulfillmentCenterCreate, FulfillmentCenterUpdate, FulfillmentCenter, FulfillmentCenterListResponse,
    SalesOrderItemCreate, SalesOrderItemUpdate, SalesOrderItem,
    SalesOrderCreate, SalesOrderUpdate, SalesOrder, SalesOrderListResponse, SalesOrderSummary,
    SalesOrderStatusHistory, SalesOrderStats,
)

router = APIRouter()


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_tenant_id(x_tenant_id: str) -> UUID:
    """Extract tenant ID from header."""
    try:
        return UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid tenant ID format"
        )


def decimal_serializer(obj):
    """JSON serializer for Decimal types."""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def parse_address(address_data):
    """Parse address from JSONB to dict."""
    if address_data is None:
        return None
    if isinstance(address_data, str):
        return json.loads(address_data)
    return dict(address_data)


# ============================================================================
# FULFILLMENT CENTERS API
# ============================================================================

@router.get("/fulfillment-centers/", response_model=FulfillmentCenterListResponse)
async def list_fulfillment_centers(
    x_tenant_id: str = Header(...),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    platform: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
):
    """List all fulfillment centers."""
    tenant_id = get_tenant_id(x_tenant_id)
    offset = (page - 1) * limit
    
    with get_db_cursor() as cur:
        # Build WHERE clause
        conditions = ["tenant_id = %s"]
        params = [str(tenant_id)]
        
        if platform:
            conditions.append("platform = %s")
            params.append(platform)
        
        if is_active is not None:
            conditions.append("is_active = %s")
            params.append(is_active)
        
        if search:
            conditions.append("(code ILIKE %s OR name ILIKE %s OR full_name ILIKE %s)")
            search_term = f"%{search}%"
            params.extend([search_term, search_term, search_term])
        
        where_clause = " AND ".join(conditions)
        
        # Get total count
        cur.execute(f"SELECT COUNT(*) as count FROM fulfillment_centers WHERE {where_clause}", params)
        total = cur.fetchone()['count']
        
        # Get records
        cur.execute(f"""
            SELECT * FROM fulfillment_centers 
            WHERE {where_clause}
            ORDER BY platform, code
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        
        rows = cur.fetchall()
        fulfillment_centers = [FulfillmentCenter(**dict(row)) for row in rows]
        
        return FulfillmentCenterListResponse(
            fulfillment_centers=fulfillment_centers,
            total=total,
            page=page,
            limit=limit
        )


@router.post("/fulfillment-centers/", response_model=FulfillmentCenter, status_code=status.HTTP_201_CREATED)
async def create_fulfillment_center(
    data: FulfillmentCenterCreate,
    x_tenant_id: str = Header(...),
):
    """Create a new fulfillment center."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO fulfillment_centers (
                tenant_id, code, name, full_name, platform,
                address_line1, address_line2, city, state, country, pincode,
                contact_name, contact_phone, contact_email, is_active, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            str(tenant_id), data.code, data.name, data.full_name or f"{data.code} - {data.name}",
            data.platform.value if data.platform else "amazon",
            data.address_line1, data.address_line2, data.city, data.state,
            data.country, data.pincode, data.contact_name, data.contact_phone,
            data.contact_email, data.is_active, data.notes
        ))
        
        row = cur.fetchone()
        return FulfillmentCenter(**dict(row))


# ============================================================================
# SALES ORDERS - CRUD
# ============================================================================

@router.get("/", response_model=SalesOrderListResponse)
async def list_sales_orders(
    x_tenant_id: str = Header(...),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None),
    platform: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
):
    """List all sales orders with filters."""
    tenant_id = get_tenant_id(x_tenant_id)
    offset = (page - 1) * limit
    
    with get_db_cursor() as cur:
        # Build WHERE clause
        conditions = ["so.tenant_id = %s"]
        params = [str(tenant_id)]
        
        if status:
            conditions.append("so.status = %s")
            params.append(status)
        
        if platform:
            conditions.append("so.platform = %s")
            params.append(platform)
        
        if customer_id:
            conditions.append("so.customer_id = %s")
            params.append(customer_id)
        
        if start_date:
            conditions.append("so.order_date >= %s")
            params.append(start_date)
        
        if end_date:
            conditions.append("so.order_date <= %s")
            params.append(end_date)
        
        if search:
            conditions.append("""
                (so.order_number ILIKE %s OR so.reference_number ILIKE %s 
                 OR p.party_name ILIKE %s OR so.fulfillment_center_name ILIKE %s)
            """)
            search_term = f"%{search}%"
            params.extend([search_term, search_term, search_term, search_term])
        
        where_clause = " AND ".join(conditions)
        
        # Validate sort column
        valid_sort_columns = ["order_number", "order_date", "status", "total_amount", "created_at", "updated_at"]
        if sort_by not in valid_sort_columns:
            sort_by = "created_at"
        sort_direction = "DESC" if sort_order.lower() == "desc" else "ASC"
        
        # Get total count
        cur.execute(f"""
            SELECT COUNT(*) as count
            FROM sales_orders so
            LEFT JOIN parties p ON so.customer_id = p.id
            WHERE {where_clause}
        """, params)
        total = cur.fetchone()['count']
        
        # Get records with customer name
        cur.execute(f"""
            SELECT so.*, p.party_name as customer_name
            FROM sales_orders so
            LEFT JOIN parties p ON so.customer_id = p.id
            WHERE {where_clause}
            ORDER BY so.{sort_by} {sort_direction}
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        
        rows = cur.fetchall()
        sales_orders = []
        for row in rows:
            row_dict = dict(row)
            row_dict['billing_address'] = parse_address(row_dict.get('billing_address'))
            row_dict['shipping_address'] = parse_address(row_dict.get('shipping_address'))
            row_dict['platform_metadata'] = row_dict.get('platform_metadata') or {}
            sales_orders.append(SalesOrder(**row_dict))
        
        return SalesOrderListResponse(
            sales_orders=sales_orders,
            total=total,
            page=page,
            limit=limit
        )


@router.get("/stats", response_model=SalesOrderStats)
async def get_sales_order_stats(
    x_tenant_id: str = Header(...),
):
    """Get sales order statistics."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                COUNT(*) as total_orders,
                COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
                COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
                COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
                COUNT(*) FILTER (WHERE status = 'shipped') as shipped_count,
                COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
                COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled', 'draft')), 0) as total_revenue,
                COUNT(*) FILTER (WHERE order_date = CURRENT_DATE) as orders_today,
                COUNT(*) FILTER (WHERE order_date >= CURRENT_DATE - INTERVAL '7 days') as orders_this_week,
                COUNT(*) FILTER (WHERE order_date >= date_trunc('month', CURRENT_DATE)) as orders_this_month
            FROM sales_orders
            WHERE tenant_id = %s
        """, (str(tenant_id),))
        
        row = cur.fetchone()
        return SalesOrderStats(**dict(row))


@router.get("/{order_id}", response_model=SalesOrder)
async def get_sales_order(
    order_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Get a sales order by ID with line items."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Get order
        cur.execute("""
            SELECT so.*, p.party_name as customer_name
            FROM sales_orders so
            LEFT JOIN parties p ON so.customer_id = p.id
            WHERE so.id = %s AND so.tenant_id = %s
        """, (str(order_id), str(tenant_id)))
        
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Sales order not found")
        
        row_dict = dict(row)
        row_dict['billing_address'] = parse_address(row_dict.get('billing_address'))
        row_dict['shipping_address'] = parse_address(row_dict.get('shipping_address'))
        row_dict['platform_metadata'] = row_dict.get('platform_metadata') or {}
        
        # Get line items
        cur.execute("""
            SELECT * FROM sales_order_items
            WHERE sales_order_id = %s
            ORDER BY line_number
        """, (str(order_id),))
        
        items_rows = cur.fetchall()
        items = [SalesOrderItem(**dict(item_row)) for item_row in items_rows]
        row_dict['items'] = items
        
        return SalesOrder(**row_dict)


@router.post("/", response_model=SalesOrder, status_code=status.HTTP_201_CREATED)
async def create_sales_order(
    data: SalesOrderCreate,
    x_tenant_id: str = Header(...),
):
    """Create a new sales order."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Prepare address JSONs
        billing_address_json = json.dumps(data.billing_address.model_dump() if data.billing_address else None)
        shipping_address_json = json.dumps(data.shipping_address.model_dump() if data.shipping_address else None)
        platform_metadata_json = json.dumps(data.platform_metadata or {}, default=decimal_serializer)
        
        # Insert sales order
        cur.execute("""
            INSERT INTO sales_orders (
                tenant_id, reference_number, platform_order_id,
                customer_id, platform, platform_vendor_code,
                fulfillment_center_id, fulfillment_center_code, fulfillment_center_name,
                order_date, expected_shipment_date, delivery_window_start, delivery_window_end,
                billing_address, shipping_address, status, availability_status,
                currency_code, discount_amount, discount_type, discount_percentage,
                shipping_charges, adjustment, adjustment_description,
                payment_terms, payment_method, freight_terms,
                salesperson_id, salesperson_name,
                notes, terms_conditions, internal_notes, platform_metadata,
                priority, is_back_order, is_dropship
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            RETURNING *
        """, (
            str(tenant_id), data.reference_number, data.platform_order_id,
            str(data.customer_id) if data.customer_id else None,
            data.platform.value if data.platform else "manual",
            data.platform_vendor_code,
            str(data.fulfillment_center_id) if data.fulfillment_center_id else None,
            data.fulfillment_center_code, data.fulfillment_center_name,
            data.order_date, data.expected_shipment_date,
            data.delivery_window_start, data.delivery_window_end,
            billing_address_json, shipping_address_json,
            data.status.value if data.status else "draft",
            data.availability_status, data.currency_code,
            float(data.discount_amount) if data.discount_amount else 0,
            data.discount_type.value if data.discount_type else None,
            float(data.discount_percentage) if data.discount_percentage else None,
            float(data.shipping_charges) if data.shipping_charges else 0,
            float(data.adjustment) if data.adjustment else 0,
            data.adjustment_description,
            data.payment_terms, data.payment_method, data.freight_terms,
            str(data.salesperson_id) if data.salesperson_id else None,
            data.salesperson_name,
            data.notes, data.terms_conditions, data.internal_notes,
            platform_metadata_json,
            data.priority.value if data.priority else "normal",
            data.is_back_order, data.is_dropship
        ))
        
        order_row = cur.fetchone()
        order_id = order_row['id']
        
        # Insert line items if provided
        items = []
        if data.items:
            for item in data.items:
                cur.execute("""
                    INSERT INTO sales_order_items (
                        sales_order_id, product_id, sku, product_name, description,
                        asin, external_id, external_id_type,
                        quantity_ordered, quantity_confirmed,
                        unit_id, unit_symbol, item_package_quantity,
                        list_price, unit_price, discount_amount, discount_percentage,
                        tax_percentage, tax_amount, line_total,
                        status, line_number, notes
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    RETURNING *
                """, (
                    str(order_id),
                    str(item.product_id) if item.product_id else None,
                    item.sku, item.product_name, item.description,
                    item.asin, item.external_id, item.external_id_type,
                    float(item.quantity_ordered),
                    float(item.quantity_confirmed) if item.quantity_confirmed else float(item.quantity_ordered),
                    str(item.unit_id) if item.unit_id else None,
                    item.unit_symbol, item.item_package_quantity,
                    float(item.list_price) if item.list_price else None,
                    float(item.unit_price),
                    float(item.discount_amount) if item.discount_amount else 0,
                    float(item.discount_percentage) if item.discount_percentage else None,
                    float(item.tax_percentage) if item.tax_percentage else None,
                    float(item.tax_amount) if item.tax_amount else 0,
                    float(item.line_total),
                    item.status.value if item.status else "pending",
                    item.line_number, item.notes
                ))
                items.append(SalesOrderItem(**dict(cur.fetchone())))
        
        # Fetch the updated order (with recalculated totals)
        cur.execute("""
            SELECT so.*, p.party_name as customer_name
            FROM sales_orders so
            LEFT JOIN parties p ON so.customer_id = p.id
            WHERE so.id = %s
        """, (str(order_id),))
        
        order_dict = dict(cur.fetchone())
        order_dict['billing_address'] = parse_address(order_dict.get('billing_address'))
        order_dict['shipping_address'] = parse_address(order_dict.get('shipping_address'))
        order_dict['platform_metadata'] = order_dict.get('platform_metadata') or {}
        order_dict['items'] = items
        
        return SalesOrder(**order_dict)


@router.put("/{order_id}", response_model=SalesOrder)
async def update_sales_order(
    order_id: UUID,
    data: SalesOrderUpdate,
    x_tenant_id: str = Header(...),
):
    """Update a sales order."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Check if order exists
        cur.execute("""
            SELECT id, status FROM sales_orders 
            WHERE id = %s AND tenant_id = %s
        """, (str(order_id), str(tenant_id)))
        
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Sales order not found")
        
        # Build update query dynamically
        update_fields = []
        params = []
        
        update_data = data.model_dump(exclude_unset=True)
        
        for field, value in update_data.items():
            if value is not None:
                if field in ['billing_address', 'shipping_address']:
                    update_fields.append(f"{field} = %s")
                    params.append(json.dumps(value.model_dump() if hasattr(value, 'model_dump') else value))
                elif field == 'platform_metadata':
                    update_fields.append(f"{field} = %s")
                    params.append(json.dumps(value, default=decimal_serializer))
                elif field in ['status', 'platform', 'priority', 'discount_type']:
                    update_fields.append(f"{field} = %s")
                    params.append(value.value if hasattr(value, 'value') else value)
                elif field in ['customer_id', 'fulfillment_center_id', 'salesperson_id']:
                    update_fields.append(f"{field} = %s")
                    params.append(str(value) if value else None)
                elif isinstance(value, Decimal):
                    update_fields.append(f"{field} = %s")
                    params.append(float(value))
                else:
                    update_fields.append(f"{field} = %s")
                    params.append(value)
        
        if not update_fields:
            # No updates, just return existing
            return await get_sales_order(order_id, x_tenant_id)
        
        update_fields.append("updated_at = CURRENT_TIMESTAMP")
        
        query = f"""
            UPDATE sales_orders 
            SET {', '.join(update_fields)}
            WHERE id = %s AND tenant_id = %s
            RETURNING *
        """
        params.extend([str(order_id), str(tenant_id)])
        
        cur.execute(query, params)
        
        return await get_sales_order(order_id, x_tenant_id)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sales_order(
    order_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Delete a sales order (only if in draft status)."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT status FROM sales_orders 
            WHERE id = %s AND tenant_id = %s
        """, (str(order_id), str(tenant_id)))
        
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Sales order not found")
        
        if row['status'] not in ['draft', 'cancelled']:
            raise HTTPException(
                status_code=400, 
                detail="Can only delete orders in draft or cancelled status"
            )
        
        cur.execute("""
            DELETE FROM sales_orders 
            WHERE id = %s AND tenant_id = %s
        """, (str(order_id), str(tenant_id)))


# ============================================================================
# SALES ORDER ITEMS
# ============================================================================

@router.get("/{order_id}/items", response_model=list[SalesOrderItem])
async def list_order_items(
    order_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Get all line items for a sales order."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Verify order exists
        cur.execute("""
            SELECT id FROM sales_orders 
            WHERE id = %s AND tenant_id = %s
        """, (str(order_id), str(tenant_id)))
        
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Sales order not found")
        
        cur.execute("""
            SELECT * FROM sales_order_items
            WHERE sales_order_id = %s
            ORDER BY line_number
        """, (str(order_id),))
        
        rows = cur.fetchall()
        return [SalesOrderItem(**dict(row)) for row in rows]


@router.post("/{order_id}/items", response_model=SalesOrderItem, status_code=status.HTTP_201_CREATED)
async def add_order_item(
    order_id: UUID,
    data: SalesOrderItemCreate,
    x_tenant_id: str = Header(...),
):
    """Add a line item to a sales order."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Verify order exists and is editable
        cur.execute("""
            SELECT status FROM sales_orders 
            WHERE id = %s AND tenant_id = %s
        """, (str(order_id), str(tenant_id)))
        
        order = cur.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Sales order not found")
        
        if order['status'] not in ['draft', 'pending_confirmation']:
            raise HTTPException(status_code=400, detail="Cannot modify items on this order")
        
        cur.execute("""
            INSERT INTO sales_order_items (
                sales_order_id, product_id, sku, product_name, description,
                asin, external_id, external_id_type,
                quantity_ordered, quantity_confirmed,
                unit_id, unit_symbol, item_package_quantity,
                list_price, unit_price, discount_amount, discount_percentage,
                tax_percentage, tax_amount, line_total,
                status, line_number, notes
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            RETURNING *
        """, (
            str(order_id),
            str(data.product_id) if data.product_id else None,
            data.sku, data.product_name, data.description,
            data.asin, data.external_id, data.external_id_type,
            float(data.quantity_ordered),
            float(data.quantity_confirmed) if data.quantity_confirmed else float(data.quantity_ordered),
            str(data.unit_id) if data.unit_id else None,
            data.unit_symbol, data.item_package_quantity,
            float(data.list_price) if data.list_price else None,
            float(data.unit_price),
            float(data.discount_amount) if data.discount_amount else 0,
            float(data.discount_percentage) if data.discount_percentage else None,
            float(data.tax_percentage) if data.tax_percentage else None,
            float(data.tax_amount) if data.tax_amount else 0,
            float(data.line_total),
            data.status.value if data.status else "pending",
            data.line_number, data.notes
        ))
        
        return SalesOrderItem(**dict(cur.fetchone()))


@router.delete("/{order_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order_item(
    order_id: UUID,
    item_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Delete a line item from a sales order."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Verify order exists and is editable
        cur.execute("""
            SELECT status FROM sales_orders 
            WHERE id = %s AND tenant_id = %s
        """, (str(order_id), str(tenant_id)))
        
        order = cur.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Sales order not found")
        
        if order['status'] not in ['draft', 'pending_confirmation']:
            raise HTTPException(status_code=400, detail="Cannot modify items on this order")
        
        cur.execute("""
            DELETE FROM sales_order_items 
            WHERE id = %s AND sales_order_id = %s
        """, (str(item_id), str(order_id)))


# ============================================================================
# STATUS TRANSITIONS
# ============================================================================

@router.post("/{order_id}/confirm", response_model=SalesOrder)
async def confirm_order(
    order_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Confirm a sales order."""
    return await _update_order_status(order_id, x_tenant_id, SalesOrderStatus.CONFIRMED, ["draft", "pending_confirmation"])


@router.post("/{order_id}/process", response_model=SalesOrder)
async def start_processing(
    order_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Start processing a sales order."""
    return await _update_order_status(order_id, x_tenant_id, SalesOrderStatus.PROCESSING, ["confirmed"])


@router.post("/{order_id}/pack", response_model=SalesOrder)
async def pack_order(
    order_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Mark order as packed."""
    return await _update_order_status(order_id, x_tenant_id, SalesOrderStatus.PACKED, ["processing"])


@router.post("/{order_id}/ship", response_model=SalesOrder)
async def ship_order(
    order_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Mark order as shipped."""
    return await _update_order_status(order_id, x_tenant_id, SalesOrderStatus.SHIPPED, ["packed"])


@router.post("/{order_id}/deliver", response_model=SalesOrder)
async def deliver_order(
    order_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Mark order as delivered."""
    return await _update_order_status(order_id, x_tenant_id, SalesOrderStatus.DELIVERED, ["shipped"])


@router.post("/{order_id}/invoice", response_model=SalesOrder)
async def invoice_order(
    order_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Mark order as invoiced."""
    return await _update_order_status(order_id, x_tenant_id, SalesOrderStatus.INVOICED, ["delivered"])


@router.post("/{order_id}/cancel", response_model=SalesOrder)
async def cancel_order(
    order_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Cancel a sales order."""
    return await _update_order_status(
        order_id, x_tenant_id, SalesOrderStatus.CANCELLED, 
        ["draft", "pending_confirmation", "confirmed", "processing", "on_hold"]
    )


@router.post("/{order_id}/hold", response_model=SalesOrder)
async def hold_order(
    order_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Put order on hold."""
    return await _update_order_status(
        order_id, x_tenant_id, SalesOrderStatus.ON_HOLD,
        ["confirmed", "processing"]
    )


@router.post("/{order_id}/resume", response_model=SalesOrder)
async def resume_order(
    order_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Resume order from hold."""
    return await _update_order_status(order_id, x_tenant_id, SalesOrderStatus.CONFIRMED, ["on_hold"])


async def _update_order_status(
    order_id: UUID,
    x_tenant_id: str,
    new_status: SalesOrderStatus,
    allowed_from_statuses: list[str],
) -> SalesOrder:
    """Helper function to update order status."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT status FROM sales_orders 
            WHERE id = %s AND tenant_id = %s
        """, (str(order_id), str(tenant_id)))
        
        order = cur.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Sales order not found")
        
        current_status = order['status']
        if current_status not in allowed_from_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot change status from '{current_status}' to '{new_status.value}'"
            )
        
        # Update additional fields based on status
        extra_updates = ""
        if new_status == SalesOrderStatus.SHIPPED:
            extra_updates = ", actual_shipment_date = CURRENT_DATE"
        elif new_status == SalesOrderStatus.DELIVERED:
            extra_updates = ", actual_delivery_date = CURRENT_DATE"
        
        cur.execute(f"""
            UPDATE sales_orders 
            SET status = %s, updated_at = CURRENT_TIMESTAMP{extra_updates}
            WHERE id = %s AND tenant_id = %s
        """, (new_status.value, str(order_id), str(tenant_id)))
        
        return await get_sales_order(order_id, x_tenant_id)


# ============================================================================
# STATUS HISTORY
# ============================================================================

@router.get("/{order_id}/history", response_model=list[SalesOrderStatusHistory])
async def get_order_history(
    order_id: UUID,
    x_tenant_id: str = Header(...),
):
    """Get status history for a sales order."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor() as cur:
        # Verify order exists
        cur.execute("""
            SELECT id FROM sales_orders 
            WHERE id = %s AND tenant_id = %s
        """, (str(order_id), str(tenant_id)))
        
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Sales order not found")
        
        cur.execute("""
            SELECT * FROM sales_order_status_history
            WHERE sales_order_id = %s
            ORDER BY changed_at DESC
        """, (str(order_id),))
        
        rows = cur.fetchall()
        return [SalesOrderStatusHistory(**dict(row)) for row in rows]


# ============================================================================
# AMS INTEGRATION ENDPOINT
# ============================================================================

from pydantic import BaseModel
from typing import List

class AMSOrderItem(BaseModel):
    """Order item from AMS."""
    sku: str
    quantity: float
    unit_price: Optional[float] = 0

class AMSOrderPayload(BaseModel):
    """Payload from AMS to create a sales order."""
    order_number: str
    reference_number: Optional[str] = None
    platform: str
    status: Optional[str] = "confirmed"
    customer_id: Optional[int] = None
    notes: Optional[str] = None
    items: List[AMSOrderItem]

class AMSOrderResponse(BaseModel):
    """Response after creating order from AMS."""
    success: bool
    id: Optional[str] = None
    order_number: Optional[str] = None
    message: Optional[str] = None


@router.post("/from-ams", response_model=AMSOrderResponse)
async def create_order_from_ams(
    payload: AMSOrderPayload,
    x_tenant_id: str = Header(default="00000000-0000-0000-0000-000000000001"),
):
    """
    Create a sales order from AMS (Allocation Management System).
    
    This endpoint is called by AMS after it has validated a PO and allocated inventory.
    The order is created in "confirmed" status with reserved inventory.
    """
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        try:
            # Map platform to our Platform enum
            platform_map = {
                "amazon": Platform.AMAZON,
                "flipkart": Platform.FLIPKART,
                "zepto": Platform.ZEPTO,
                "blinkit": Platform.BLINKIT,
                "bigbasket": Platform.BIG_BASKET,
                "swiggy": Platform.SWIGGY_INSTAMART,
            }
            platform = platform_map.get(payload.platform.lower(), Platform.OTHER)
            
            # Map status
            status_map = {
                "confirmed": SalesOrderStatus.CONFIRMED,
                "draft": SalesOrderStatus.DRAFT,
                "pending_confirmation": SalesOrderStatus.PENDING_CONFIRMATION,
            }
            order_status = status_map.get(payload.status.lower(), SalesOrderStatus.CONFIRMED)
            
            # Insert sales order
            cur.execute("""
                INSERT INTO sales_orders (
                    tenant_id, order_number, reference_number, platform,
                    status, priority, notes, created_at, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id, order_number
            """, (
                str(tenant_id),
                payload.order_number,
                payload.reference_number or payload.order_number,
                platform.value,
                order_status.value,
                Priority.NORMAL.value,
                payload.notes
            ))
            
            result = cur.fetchone()
            order_id = result['id']
            order_number = result['order_number']
            
            # Insert line items
            for idx, item in enumerate(payload.items, 1):
                # Look up product by SKU
                cur.execute("""
                    SELECT id, sku, unit_price 
                    FROM products 
                    WHERE tenant_id = %s AND (sku = %s OR sku ILIKE %s)
                    LIMIT 1
                """, (str(tenant_id), item.sku, f"%{item.sku}%"))
                
                product = cur.fetchone()
                product_id = product['id'] if product else None
                unit_price = item.unit_price or (float(product['unit_price']) if product and product.get('unit_price') else 0)
                
                cur.execute("""
                    INSERT INTO sales_order_items (
                        tenant_id, sales_order_id, product_id, sku_code,
                        quantity, unit_price, line_total, line_status,
                        created_at, updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (
                    str(tenant_id),
                    str(order_id),
                    str(product_id) if product_id else None,
                    item.sku,
                    item.quantity,
                    unit_price,
                    item.quantity * unit_price,
                    LineItemStatus.ALLOCATED.value  # Already allocated by AMS
                ))
            
            # Update order totals
            cur.execute("""
                UPDATE sales_orders SET
                    total_amount = (
                        SELECT COALESCE(SUM(line_total), 0)
                        FROM sales_order_items
                        WHERE sales_order_id = %s
                    ),
                    grand_total = (
                        SELECT COALESCE(SUM(line_total), 0)
                        FROM sales_order_items
                        WHERE sales_order_id = %s
                    )
                WHERE id = %s
            """, (str(order_id), str(order_id), str(order_id)))
            
            # Log status history
            cur.execute("""
                INSERT INTO sales_order_status_history (
                    sales_order_id, status, notes, changed_by
                )
                VALUES (%s, %s, %s, %s)
            """, (
                str(order_id),
                order_status.value,
                f"Created from AMS. Platform: {payload.platform}",
                "AMS_SYSTEM"
            ))
            
            return AMSOrderResponse(
                success=True,
                id=str(order_id),
                order_number=order_number,
                message="Sales order created successfully from AMS"
            )
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create sales order: {str(e)}"
            )
