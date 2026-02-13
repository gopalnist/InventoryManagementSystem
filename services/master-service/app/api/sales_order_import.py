"""
Sales Order Import API
======================
Handles importing sales orders from various sources:
- Excel files (Amazon PO, Zepto, Blinkit, etc.)
- CSV files
- API integrations
"""

from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime, date
from decimal import Decimal
import io
import re

from fastapi import APIRouter, Depends, HTTPException, Query, status, Header, UploadFile, File, Form
from fastapi.responses import JSONResponse
from psycopg2.extras import RealDictCursor

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

from shared.db.connection import get_db_cursor
from app.models.sales_order import (
    SalesOrderStatus, Platform, Priority,
)

router = APIRouter()


def get_tenant_id(x_tenant_id: str) -> UUID:
    """Extract tenant ID from header."""
    try:
        return UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant ID")


# =============================================================================
# PLATFORM-SPECIFIC COLUMN MAPPINGS
# =============================================================================

AMAZON_COLUMN_MAPPING = {
    "platform_order_id": "PO",
    "fulfillment_center_code": "Ship to location",
    "asin": "ASIN",
    "external_id": "External Id",
    "external_id_type": "External Id Type",
    "model_number": "Model Number",
    "product_name": "Title",
    "quantity_ordered": "Quantity Requested",
    "quantity_accepted": "Accepted quantity",
    "quantity_received": "Quantity received",
    "quantity_outstanding": "Quantity Outstanding",
    "unit_price": "Unit Cost",
    "total_cost": "Total cost",
    "window_start": "Window start",
    "window_end": "Window end",
    "expected_date": "Expected date",
    "availability": "Availability",
}

ZEPTO_COLUMN_MAPPING = {
    "platform_order_id": "Order ID",
    "sku": "SKU",
    "product_name": "Product Name",
    "quantity_ordered": "Quantity",
    "unit_price": "Price",
    "delivery_date": "Delivery Date",
}

BLINKIT_COLUMN_MAPPING = {
    "platform_order_id": "PO Number",
    "sku": "Item Code",
    "product_name": "Item Name",
    "quantity_ordered": "Qty",
    "unit_price": "Rate",
}

PLATFORM_MAPPINGS = {
    "amazon": AMAZON_COLUMN_MAPPING,
    "zepto": ZEPTO_COLUMN_MAPPING,
    "blinkit": BLINKIT_COLUMN_MAPPING,
    "manual": {},  # User will provide mapping
}


# =============================================================================
# IMPORT PREVIEW - Shows what will be imported
# =============================================================================

@router.post("/preview")
async def preview_import(
    file: UploadFile = File(...),
    platform: str = Form("amazon"),
    x_tenant_id: str = Header(...),
):
    """
    Preview import data before creating sales orders.
    Returns parsed data with validation status.
    """
    if not PANDAS_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="pandas library not installed. Install with: pip install pandas openpyxl"
        )
    
    tenant_id = get_tenant_id(x_tenant_id)
    
    # Read file
    try:
        content = await file.read()
        
        if file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
            df = pd.read_excel(io.BytesIO(content))
        elif file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file format. Use .xlsx, .xls, or .csv"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file: {str(e)}"
        )
    
    # Get column mapping for platform
    column_mapping = PLATFORM_MAPPINGS.get(platform, {})
    
    # Detect unique orders (group by PO number)
    po_column = column_mapping.get("platform_order_id", "PO")
    
    if po_column not in df.columns:
        # Try to auto-detect PO column
        po_candidates = [c for c in df.columns if 'po' in c.lower() or 'order' in c.lower()]
        if po_candidates:
            po_column = po_candidates[0]
        else:
            po_column = df.columns[0]  # Default to first column
    
    # Group data by PO
    unique_orders = df[po_column].unique().tolist()
    
    # Parse orders with line items
    orders_preview = []
    
    for po_number in unique_orders:
        po_df = df[df[po_column] == po_number]
        
        # Extract order-level info (from first row)
        first_row = po_df.iloc[0]
        
        # Get fulfillment center
        fc_column = column_mapping.get("fulfillment_center_code", "Ship to location")
        fc_code = first_row.get(fc_column, "") if fc_column in po_df.columns else ""
        
        # Parse fulfillment center code (e.g., "BLR4 - BENGALURU, KARNATAKA" -> "BLR4")
        fc_match = re.match(r'^([A-Z0-9]+)', str(fc_code))
        fc_code_clean = fc_match.group(1) if fc_match else str(fc_code)[:10]
        
        # Get dates
        window_start_col = column_mapping.get("window_start", "Window start")
        window_end_col = column_mapping.get("window_end", "Window end")
        expected_date_col = column_mapping.get("expected_date", "Expected date")
        
        window_start = str(first_row.get(window_start_col, "")) if window_start_col in po_df.columns else None
        window_end = str(first_row.get(window_end_col, "")) if window_end_col in po_df.columns else None
        expected_date = str(first_row.get(expected_date_col, "")) if expected_date_col in po_df.columns else None
        
        # Parse line items
        line_items = []
        total_amount = Decimal("0")
        total_quantity = 0
        
        for _, row in po_df.iterrows():
            # Get product identifiers
            asin = str(row.get(column_mapping.get("asin", "ASIN"), "")) if "ASIN" in po_df.columns else ""
            external_id = str(row.get(column_mapping.get("external_id", "External Id"), "")) if "External Id" in po_df.columns else ""
            model_number = str(row.get(column_mapping.get("model_number", "Model Number"), "")) if "Model Number" in po_df.columns else ""
            
            # SKU priority: Model Number > External Id > ASIN
            sku = model_number or external_id or asin or f"UNKNOWN-{uuid4().hex[:8]}"
            
            # Get product name
            name_col = column_mapping.get("product_name", "Title")
            product_name = str(row.get(name_col, "Unknown Product"))[:255]
            
            # Get quantity
            qty_col = column_mapping.get("quantity_ordered", "Quantity Requested")
            quantity = int(row.get(qty_col, 0)) if qty_col in po_df.columns else 0
            
            # Get price
            price_col = column_mapping.get("unit_price", "Unit Cost")
            unit_price = Decimal(str(row.get(price_col, 0)).replace(",", "")) if price_col in po_df.columns else Decimal("0")
            
            # Get total
            total_col = column_mapping.get("total_cost", "Total cost")
            line_total = Decimal(str(row.get(total_col, 0)).replace(",", "")) if total_col in po_df.columns else (unit_price * quantity)
            
            line_items.append({
                "sku": sku,
                "asin": asin,
                "external_id": external_id,
                "name": product_name,
                "quantity_ordered": quantity,
                "unit_price": float(unit_price),
                "line_total": float(line_total),
                "product_matched": False,  # Will be set after matching with catalog
                "product_id": None,
            })
            
            total_amount += line_total
            total_quantity += quantity
        
        orders_preview.append({
            "platform_order_id": str(po_number),
            "fulfillment_center_code": fc_code_clean,
            "fulfillment_center_full": str(fc_code),
            "window_start": window_start,
            "window_end": window_end,
            "expected_date": expected_date,
            "line_items_count": len(line_items),
            "total_quantity": total_quantity,
            "total_amount": float(total_amount),
            "line_items": line_items,
            "validation_status": "valid",
            "validation_messages": [],
        })
    
    # Match products with catalog
    with get_db_cursor(cursor_factory=RealDictCursor) as cur:
        for order in orders_preview:
            for item in order["line_items"]:
                # Try to find product by SKU, ASIN, or EAN
                cur.execute("""
                    SELECT p.id, p.name, p.sku
                    FROM products p
                    LEFT JOIN product_identifiers pi ON p.id = pi.product_id
                    WHERE p.tenant_id = %s
                    AND (
                        p.sku = %s
                        OR pi.upc = %s
                        OR pi.ean = %s
                        OR pi.asin = %s
                    )
                    LIMIT 1
                """, (str(tenant_id), item["sku"], item["external_id"], item["external_id"], item["asin"]))
                
                product = cur.fetchone()
                if product:
                    item["product_matched"] = True
                    item["product_id"] = str(product["id"])
                    item["catalog_name"] = product["name"]
                    item["catalog_sku"] = product["sku"]
                else:
                    order["validation_messages"].append(
                        f"Product not found in catalog: {item['sku']} - {item['name'][:50]}..."
                    )
    
    return {
        "filename": file.filename,
        "platform": platform,
        "total_rows": len(df),
        "unique_orders": len(unique_orders),
        "columns_detected": df.columns.tolist(),
        "column_mapping_used": column_mapping,
        "orders": orders_preview,
    }


# =============================================================================
# IMPORT EXECUTION - Creates sales orders from preview data
# =============================================================================

@router.post("/execute")
async def execute_import(
    import_data: Dict[str, Any],
    x_tenant_id: str = Header(...),
):
    """
    Execute import and create sales orders from validated preview data.
    """
    tenant_id = get_tenant_id(x_tenant_id)
    
    orders_to_create = import_data.get("orders", [])
    platform = import_data.get("platform", "amazon")
    
    if not orders_to_create:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No orders to import"
        )
    
    created_orders = []
    errors = []
    
    with get_db_cursor(cursor_factory=RealDictCursor) as cur:
        for order_data in orders_to_create:
            try:
                # Check if order already exists
                cur.execute("""
                    SELECT id, order_number FROM sales_orders
                    WHERE tenant_id = %s AND platform_order_id = %s
                """, (str(tenant_id), order_data["platform_order_id"]))
                
                existing = cur.fetchone()
                if existing:
                    errors.append({
                        "platform_order_id": order_data["platform_order_id"],
                        "error": f"Order already exists: {existing['order_number']}"
                    })
                    continue
                
                # Find or create fulfillment center
                fc_code = order_data.get("fulfillment_center_code", "")
                fc_id = None
                
                if fc_code:
                    cur.execute("""
                        SELECT id FROM fulfillment_centers
                        WHERE tenant_id = %s AND code = %s
                    """, (str(tenant_id), fc_code))
                    fc = cur.fetchone()
                    
                    if not fc:
                        # Create fulfillment center
                        cur.execute("""
                            INSERT INTO fulfillment_centers (tenant_id, name, code, address)
                            VALUES (%s, %s, %s, %s)
                            RETURNING id
                        """, (
                            str(tenant_id),
                            order_data.get("fulfillment_center_full", fc_code),
                            fc_code,
                            order_data.get("fulfillment_center_full", "")
                        ))
                        fc = cur.fetchone()
                    
                    fc_id = fc["id"]
                
                # Parse expected shipment date
                expected_shipment = None
                if order_data.get("window_start"):
                    try:
                        expected_shipment = datetime.strptime(
                            order_data["window_start"], "%d/%m/%Y"
                        ).date()
                    except:
                        try:
                            expected_shipment = datetime.strptime(
                                order_data["window_start"], "%m/%d/%Y"
                            ).date()
                        except:
                            pass
                
                # Create sales order
                cur.execute("""
                    INSERT INTO sales_orders (
                        tenant_id, platform, platform_order_id,
                        fulfillment_center_id, expected_shipment_date,
                        status, priority
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, order_number
                """, (
                    str(tenant_id),
                    platform,
                    order_data["platform_order_id"],
                    str(fc_id) if fc_id else None,
                    expected_shipment,
                    "pending",  # Imported orders start as pending
                    "medium"
                ))
                
                new_order = cur.fetchone()
                order_id = new_order["id"]
                order_number = new_order["order_number"]
                
                # Create line items
                items_created = 0
                for item in order_data.get("line_items", []):
                    # Calculate line total
                    quantity = Decimal(str(item.get("quantity_ordered", 0)))
                    unit_price = Decimal(str(item.get("unit_price", 0)))
                    line_total = quantity * unit_price
                    
                    cur.execute("""
                        INSERT INTO sales_order_items (
                            tenant_id, sales_order_id, product_id,
                            item_type, sku, name, description,
                            quantity_ordered, unit_price, line_total,
                            platform_item_id, status
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        str(tenant_id),
                        str(order_id),
                        item.get("product_id"),
                        "product",
                        item.get("sku", ""),
                        item.get("name", "Unknown"),
                        None,
                        quantity,
                        unit_price,
                        line_total,
                        item.get("asin") or item.get("external_id"),
                        "pending"
                    ))
                    items_created += 1
                
                # Update order totals
                cur.execute("""
                    UPDATE sales_orders
                    SET
                        total_amount = (SELECT COALESCE(SUM(quantity_ordered * unit_price), 0) FROM sales_order_items WHERE sales_order_id = %s),
                        grand_total = (SELECT COALESCE(SUM(line_total), 0) FROM sales_order_items WHERE sales_order_id = %s),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (str(order_id), str(order_id), str(order_id)))
                
                created_orders.append({
                    "platform_order_id": order_data["platform_order_id"],
                    "order_number": order_number,
                    "order_id": str(order_id),
                    "items_created": items_created,
                })
                
            except Exception as e:
                errors.append({
                    "platform_order_id": order_data.get("platform_order_id", "Unknown"),
                    "error": str(e)
                })
    
    return {
        "success": True,
        "orders_created": len(created_orders),
        "orders_failed": len(errors),
        "created_orders": created_orders,
        "errors": errors,
    }


# =============================================================================
# AVAILABLE IMPORT TEMPLATES
# =============================================================================

@router.get("/templates")
async def get_import_templates():
    """
    Returns available import templates for different platforms.
    """
    return {
        "templates": [
            {
                "platform": "amazon",
                "name": "Amazon Vendor Central PO",
                "description": "Import Purchase Orders from Amazon Vendor Central export",
                "required_columns": ["PO", "ASIN", "Title", "Quantity Requested", "Unit Cost"],
                "optional_columns": ["Ship to location", "External Id", "Window start", "Window end"],
                "sample_file": "/api/v1/sales-orders/import/templates/amazon.xlsx",
            },
            {
                "platform": "zepto",
                "name": "Zepto Order Export",
                "description": "Import orders from Zepto merchant dashboard",
                "required_columns": ["Order ID", "SKU", "Product Name", "Quantity", "Price"],
                "optional_columns": ["Delivery Date", "Customer Name"],
                "sample_file": "/api/v1/sales-orders/import/templates/zepto.xlsx",
            },
            {
                "platform": "blinkit",
                "name": "Blinkit PO Export",
                "description": "Import Purchase Orders from Blinkit",
                "required_columns": ["PO Number", "Item Code", "Item Name", "Qty", "Rate"],
                "optional_columns": ["Warehouse", "Delivery Date"],
                "sample_file": "/api/v1/sales-orders/import/templates/blinkit.xlsx",
            },
            {
                "platform": "manual",
                "name": "Generic CSV/Excel",
                "description": "Import from any CSV or Excel file with custom column mapping",
                "required_columns": ["Order ID/PO", "SKU", "Product Name", "Quantity", "Price"],
                "optional_columns": ["Any additional columns"],
                "sample_file": "/api/v1/sales-orders/import/templates/generic.xlsx",
            },
        ]
    }

