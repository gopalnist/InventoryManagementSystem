"""
Reports API Routes
==================
Handle report uploads from multiple channels (Zepto, Flipkart, Amazon, etc.)
"""

from __future__ import annotations

import sys
import io
from pathlib import Path
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date
import json

from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Form, Query
from pydantic import BaseModel

# Add shared to path - try local shared first, then parent
shared_paths = [
    str(Path(__file__).parent.parent.parent / "shared"),
    str(Path(__file__).parent.parent.parent.parent.parent.parent / "shared"),
]
for path in shared_paths:
    if Path(path).exists():
        sys.path.insert(0, str(Path(path).parent))
        break

from shared.db.connection import get_db_cursor, get_connection as get_db_connection

router = APIRouter()

# Try to import pandas
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False


# ============================================================================
# Helper Functions
# ============================================================================

def get_tenant_id(x_tenant_id: str = Header(...)) -> UUID:
    """Extract tenant ID from header."""
    try:
        return UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tenant ID")


def parse_date(date_str: str) -> Optional[date]:
    """Parse date string in various formats."""
    if not date_str or pd.isna(date_str):
        return None
    
    date_str = str(date_str).strip()
    if not date_str:
        return None
    
    # Try common date formats
    formats = [
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%d-%b-%Y",
        "%d %b %Y",
        "%Y-%m-%d %H:%M:%S",
        "%d-%m-%Y %H:%M:%S",
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    
    return None


def safe_decimal(value, default=0.0):
    """Safely convert to decimal."""
    if value is None or pd.isna(value):
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def safe_int(value, default=0):
    """Safely convert to integer."""
    if value is None or pd.isna(value):
        return default
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default


def safe_str(value, default=""):
    """Safely convert to string."""
    if value is None or pd.isna(value):
        return default
    return str(value).strip()


# ============================================================================
# Default Column Mappings (Channel-specific)
# ============================================================================

DEFAULT_MAPPINGS = {
    "zepto": {
        "sales": {
            "date": "Date",
            "product_identifier": "SKU Number",
            "product_name": "SKU Name",
            "quantity": "Sales (Qty) - Units",
            "unit_price": "MRP",
            "total_amount": "Gross Merchandise Value",
            "city": "City",
        },
        "inventory": {
            "date": None,  # Inventory reports may not have dates
            "product_identifier": "SKU Code",
            "product_name": "SKU Name",
            "quantity": "Units",
            "city": "City",
        },
        "po": {
            "po_number": "PO No.",
            "po_date": "PO Date",
            "status": "Status",
            "vendor_code": "Vendor Code",
            "vendor_name": "Vendor Name",
            "product_identifier": "SKU",
            "product_name": "SKU Desc",
            "quantity": "Qty",
            "unit_cost": "Unit Base Cost",
            "landing_cost": "Landing Cost",
            "total_amount": "Total Amount",
            "location": "Del Location",
            "asn_quantity": "ASN Quantity",
            "grn_quantity": "GRN Quantity",
            "expiry_date": "PO Expiry Date",
        }
    },
    "flipkart": {
        "sales": {
            "date": "Order Date",
            "product_identifier": "SKU ID",
            "product_name": "SKU ID",
            "quantity": "Final Sale Units",
            "unit_price": "Selling Price",
            "total_amount": "Final Sale Amount",
        }
    },
    "swiggy": {
        "sales": {
            "date": "ORDERED_DATE",
            "product_identifier": "ITEM_CODE",
            "product_name": "PRODUCT_NAME",
            "quantity": "UNITS_SOLD",
            "unit_price": "BASE_MRP",
            "total_amount": "GMV",
            "city": "CITY",
        },
        "inventory": {
            "date": None,  # Inventory reports may not have dates
            "product_identifier": "SkuCode",
            "product_name": "SkuDescription",
            "quantity": "WarehouseQtyAvailable",
            "city": "City",
            "location": "FacilityName",
            "warehouse_code": "FacilityName",
        }
    },
    "google_ads": {
        "ads": {
            "date": None,  # Google Ads CSV doesn't have date, will use today
            "product_identifier": "PRODUCT_ITEM_ID",
            "campaign_name": None,  # Product-level, not campaign-level
            "clicks": "CLICKS",
            "impressions": "VIEWS",
            "spend": "COST",
            "sales": "SALES",
            "roas": "ROAS",
        }
    },
    "google_pla": {
        "ads": {
            "date": "Date",
            "campaign_name": "Campaign Name",
            "clicks": "Clicks",
            "impressions": "Views",
            "spend": "Ad Spend",
            "sales": "Total Revenue (Rs.)",
            "roas": "ROI",  # ROI mapped to ROAS
        }
    },
    "blinkit": {
        "sales": {
            "date": "Order Date",
            "product_identifier": "Item Id",
            "product_name": "Product Name",
            "quantity": "Quantity",
            "unit_price": "Selling Price (Rs)",
            "total_amount": "Total Gross Bill Amount",
            "city": "Customer City",
            "order_id": "Order Id",
            "order_status": "Order Status",
        },
        "inventory": {
            "date": None,  # Inventory reports don't have dates
            "product_identifier": "Item ID",
            "product_name": "Item Name",
            "quantity": "Total sellable",
            "warehouse_code": "Warehouse Facility ID",
            "location": "Warehouse Facility Name",
            "warehouse_qty": "Warehouse",
            "darkstore_qty": "Darkstore",
            "unsellable_qty": "Total unsellable",
        },
        "po": {
            "po_number": "PoNumber",
            "po_date": "PoCreatedAt",
            "status": "Status",
            "vendor_code": "SupplierCode",
            "vendor_name": "VendorName",
            "product_identifier": "SkuCode",
            "product_name": "SkuDescription",
            "quantity": "OrderedQty",
            "received_qty": "ReceivedQty",
            "balanced_qty": "BalancedQty",
            "unit_cost": "UnitBasedCost",
            "total_amount": "PoLineValueWithTax",
            "location": "FacilityName",
            "city": "City",
            "expiry_date": "PoExpiryDate",
        }
    }
}


# ============================================================================
# Pydantic Models
# ============================================================================

class UploadResponse(BaseModel):
    upload_id: str
    status: str
    total_rows: int
    processed_rows: int
    failed_rows: int
    message: str


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/upload", response_model=UploadResponse)
async def upload_report(
    file: UploadFile = File(...),
    channel: str = Form(...),
    report_type: str = Form(...),
    x_tenant_id: str = Header(...),
):
    """
    Upload a report file (Excel/CSV) for a specific channel and report type.
    
    Supported channels: zepto, flipkart, amazon, blinkit, bigbasket
    Supported report types: sales, inventory, po, profit_loss, ads
    """
    if not PANDAS_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="pandas library not installed. Install with: pip install pandas openpyxl"
        )
    
    tenant_id = get_tenant_id(x_tenant_id)
    
    # Validate file type
    if not file.filename or not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="File must be .xlsx, .xls, or .csv")
    
    # Validate channel and report type
    valid_channels = ['zepto', 'flipkart', 'amazon', 'blinkit', 'bigbasket', 'swiggy', 'google_ads', 'google_pla']
    valid_report_types = ['sales', 'inventory', 'po', 'profit_loss', 'ads']
    
    channel = channel.lower()
    report_type = report_type.lower()
    
    if channel not in valid_channels:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid channel. Must be one of: {', '.join(valid_channels)}"
        )
    
    if report_type not in valid_report_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid report type. Must be one of: {', '.join(valid_report_types)}"
        )
    
    # Read file
    try:
        content = await file.read()
        file_size = len(content)
        
        if file.filename.endswith(('.xlsx', '.xls')):
            # Blinkit inventory Excel files have 2 header rows
            if channel == 'blinkit' and report_type == 'inventory':
                df = pd.read_excel(io.BytesIO(content), skiprows=2)
            else:
                df = pd.read_excel(io.BytesIO(content))
        else:
            # For PLA CSV files, skip first 2 rows (Start Time, End Time)
            if channel == 'google_pla' and file.filename and 'PLA' in file.filename:
                df = pd.read_csv(io.BytesIO(content), skiprows=2, low_memory=False)
            else:
                df = pd.read_csv(io.BytesIO(content), low_memory=False)
        
        total_rows = len(df)
        
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read file: {str(e)}"
        )
    
    if total_rows == 0:
        raise HTTPException(status_code=400, detail="File is empty")
    
    # Get column mapping
    mapping = DEFAULT_MAPPINGS.get(channel, {}).get(report_type, {})
    
    # Create upload record
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Insert upload record
            cur.execute("""
                INSERT INTO report_uploads (
                    tenant_id, channel, report_type, file_name, file_size,
                    total_rows, status, uploaded_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                str(tenant_id), channel, report_type, file.filename, file_size,
                total_rows, 'processing', datetime.now()
            ))
            upload_id = cur.fetchone()[0]
            
            # Process rows based on report type
            processed_rows = 0
            failed_rows = 0
            errors = []
            
            if report_type == 'sales':
                processed_rows, failed_rows, errors = _process_sales_report(
                    cur, tenant_id, upload_id, channel, df, mapping
                )
            elif report_type == 'inventory':
                processed_rows, failed_rows, errors = _process_inventory_report(
                    cur, tenant_id, upload_id, channel, df, mapping
                )
            elif report_type == 'po':
                processed_rows, failed_rows, errors = _process_po_report(
                    cur, tenant_id, upload_id, channel, df, mapping
                )
            elif report_type == 'profit_loss':
                processed_rows, failed_rows, errors = _process_profit_loss_report(
                    cur, tenant_id, upload_id, channel, df, mapping
                )
            elif report_type == 'ads':
                processed_rows, failed_rows, errors = _process_ads_report(
                    cur, tenant_id, upload_id, channel, df, mapping
                )
            elif report_type == 'ads':
                processed_rows, failed_rows, errors = _process_ads_report(
                    cur, tenant_id, upload_id, channel, df, mapping
                )
            
            # Update upload status
            status = 'completed' if failed_rows == 0 else ('partial' if processed_rows > 0 else 'failed')
            error_message = None if not errors else json.dumps(errors[:10])  # Limit errors
            
            cur.execute("""
                UPDATE report_uploads
                SET processed_rows = %s, failed_rows = %s, status = %s,
                    processed_at = %s, error_message = %s
                WHERE id = %s
            """, (processed_rows, failed_rows, status, datetime.now(), error_message, upload_id))
            
            conn.commit()
            
            return UploadResponse(
                upload_id=str(upload_id),
                status=status,
                total_rows=total_rows,
                processed_rows=processed_rows,
                failed_rows=failed_rows,
                message=f"Processed {processed_rows} rows successfully" + 
                       (f", {failed_rows} failed" if failed_rows > 0 else "")
            )
            
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
    finally:
        conn.close()


def _process_sales_report(cur, tenant_id, upload_id, channel, df, mapping):
    """Process sales report rows."""
    processed = 0
    failed = 0
    errors = []
    
    # Debug: Log available columns and mapping
    if not mapping:
        errors.append(f"No mapping found for channel '{channel}' and report_type 'sales'. Available columns: {list(df.columns)}")
        return processed, failed, errors
    
    # Convert dataframe to dict records
    for idx, row in df.iterrows():
        try:
            # Extract standardized fields - try multiple column name variations
            date_col = mapping.get('date', 'Date')
            report_date = None
            if date_col:
                report_date = parse_date(row.get(date_col))
            if not report_date:
                # Try alternative column names
                for alt_col in ['Date', 'Order Date', 'date', 'order_date', 'DATE']:
                    if alt_col in df.columns:
                        report_date = parse_date(row.get(alt_col))
                        if report_date:
                            break
            if not report_date:
                report_date = date.today()  # Default to today
            
            # Try to get values with fallback to alternative column names
            # Product Identifier - comprehensive fallbacks for all channels
            product_identifier = safe_str(row.get(mapping.get('product_identifier', '')))
            if not product_identifier:
                for alt_col in ['SKU Number', 'SKU Code', 'SKU ID', 'Product ID', 'Product Id', 'SKU', 'sku', 
                                'ITEM_CODE', 'Item Code', 'product_id', 'product_identifier', 'EAN']:
                    if alt_col in df.columns:
                        product_identifier = safe_str(row.get(alt_col))
                        if product_identifier:
                            break
            
            # Product Name - comprehensive fallbacks for all channels
            product_name = safe_str(row.get(mapping.get('product_name', '')))
            if not product_name:
                for alt_col in ['SKU Name', 'Product Name', 'PRODUCT_NAME', 'Product Title', 'Title', 
                                'product_name', 'title', 'Item Name', 'Description']:
                    if alt_col in df.columns:
                        product_name = safe_str(row.get(alt_col))
                        if product_name:
                            break
            
            # Quantity - comprehensive fallbacks for all channels
            quantity = safe_decimal(row.get(mapping.get('quantity', '')))
            if quantity == 0:
                for alt_col in ['Sales (Qty) - Units', 'UNITS_SOLD', 'Units Sold', 'Final Sale Units', 
                                'Gross Units', 'Quantity Sold', 'Quantity', 'Units', 'Qty', 'quantity', 'qty']:
                    if alt_col in df.columns:
                        qty_val = safe_decimal(row.get(alt_col))
                        if qty_val > 0:
                            quantity = qty_val
                            break
            
            # Unit Price - comprehensive fallbacks for all channels
            unit_price = safe_decimal(row.get(mapping.get('unit_price', '')))
            if unit_price == 0:
                for alt_col in ['MRP', 'BASE_MRP', 'Selling Price', 'Unit Price', 'Price', 
                                'unit_price', 'price', 'Cost']:
                    if alt_col in df.columns:
                        price_val = safe_decimal(row.get(alt_col))
                        if price_val > 0:
                            unit_price = price_val
                            break
            
            # Total Amount - comprehensive fallbacks for all channels
            total_amount = safe_decimal(row.get(mapping.get('total_amount', '')))
            if total_amount == 0:
                for alt_col in ['Gross Merchandise Value', 'GMV', 'Final Sale Amount', 'Total Revenue', 
                                'Total Amount', 'Revenue', 'total_amount', 'revenue', 'Total', 'Amount']:
                    if alt_col in df.columns:
                        total_val = safe_decimal(row.get(alt_col))
                        if total_val > 0:
                            total_amount = total_val
                            break
            
            # City - comprehensive fallbacks for all channels
            city = safe_str(row.get(mapping.get('city', '')))
            if not city:
                for alt_col in ['City', 'CITY', 'city', 'Location City', 'Location']:
                    if alt_col in df.columns:
                        city = safe_str(row.get(alt_col))
                        if city:
                            break
            
            # Location - comprehensive fallbacks
            location = safe_str(row.get(mapping.get('location', '')))
            if not location:
                for alt_col in ['Location', 'LOCATION', 'location', 'Store', 'STORE_ID', 'Area', 'AREA_NAME']:
                    if alt_col in df.columns:
                        location = safe_str(row.get(alt_col))
                        if location:
                            break
            
            # Store all raw data as JSONB
            raw_data = row.to_dict()
            # Convert numpy types to native Python types
            raw_data = {k: (v.item() if hasattr(v, 'item') else v) for k, v in raw_data.items()}
            raw_data = {k: (None if pd.isna(v) else v) for k, v in raw_data.items()}
            
            cur.execute("""
                INSERT INTO sales_reports (
                    tenant_id, upload_id, channel, report_date, product_identifier,
                    product_name, quantity, unit_price, total_amount, city, location, raw_data
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                str(tenant_id), str(upload_id), channel, report_date, product_identifier,
                product_name, quantity, unit_price, total_amount, city, location,
                json.dumps(raw_data)
            ))
            processed += 1
            
        except Exception as e:
            failed += 1
            errors.append(f"Row {idx + 2}: {str(e)}")
    
    return processed, failed, errors


def _process_inventory_report(cur, tenant_id, upload_id, channel, df, mapping):
    """Process inventory report rows."""
    processed = 0
    failed = 0
    errors = []
    
    # Get available columns for fallback
    available_columns = list(df.columns)
    
    for idx, row in df.iterrows():
        try:
            # Date - try mapping first, then fallbacks
            date_col = mapping.get('date')
            report_date = None
            if date_col:
                report_date = parse_date(row.get(date_col))
            if not report_date:
                # Try alternative column names
                for alt_col in ['Date', 'date', 'report_date', 'Report Date', 'ORDERED_DATE', 'Order Date']:
                    if alt_col in available_columns:
                        report_date = parse_date(row.get(alt_col))
                        if report_date:
                            break
            if not report_date:
                report_date = date.today()
            
            # Product Identifier - try mapping first, then fallbacks
            product_identifier = safe_str(row.get(mapping.get('product_identifier', '')))
            if not product_identifier:
                for alt_col in ['SkuCode', 'SKU Code', 'SKU', 'sku', 'Item Code', 'ITEM_CODE', 'Product ID', 'product_identifier']:
                    if alt_col in available_columns:
                        product_identifier = safe_str(row.get(alt_col))
                        if product_identifier:
                            break
            
            # Product Name - try mapping first, then fallbacks
            product_name = safe_str(row.get(mapping.get('product_name', '')))
            if not product_name:
                for alt_col in ['SkuDescription', 'SKU Description', 'Product Name', 'PRODUCT_NAME', 'SKU Name', 'product_name']:
                    if alt_col in available_columns:
                        product_name = safe_str(row.get(alt_col))
                        if product_name:
                            break
            
            # Quantity - try mapping first, then fallbacks
            quantity = safe_decimal(row.get(mapping.get('quantity', '')))
            if quantity == 0:
                for alt_col in ['WarehouseQtyAvailable', 'Units', 'units', 'Quantity', 'QUANTITY', 'Qty', 'qty']:
                    if alt_col in available_columns:
                        qty_val = safe_decimal(row.get(alt_col))
                        if qty_val > 0:
                            quantity = qty_val
                            break
            
            # City - try mapping first, then fallbacks
            city = safe_str(row.get(mapping.get('city', '')))
            if not city:
                for alt_col in ['City', 'CITY', 'city', 'Location City']:
                    if alt_col in available_columns:
                        city = safe_str(row.get(alt_col))
                        if city:
                            break
            
            # Location - try mapping first, then fallbacks
            location = safe_str(row.get(mapping.get('location', '')))
            if not location:
                for alt_col in ['FacilityName', 'Location', 'LOCATION', 'location', 'Warehouse', 'Facility']:
                    if alt_col in available_columns:
                        location = safe_str(row.get(alt_col))
                        if location:
                            break
            
            # Warehouse Code - try mapping first, then fallbacks
            warehouse_code = safe_str(row.get(mapping.get('warehouse_code', '')))
            if not warehouse_code:
                for alt_col in ['FacilityName', 'Warehouse Code', 'warehouse_code', 'Warehouse', 'Facility']:
                    if alt_col in available_columns:
                        warehouse_code = safe_str(row.get(alt_col))
                        if warehouse_code:
                            break
            
            raw_data = row.to_dict()
            raw_data = {k: (v.item() if hasattr(v, 'item') else v) for k, v in raw_data.items()}
            raw_data = {k: (None if pd.isna(v) else v) for k, v in raw_data.items()}
            
            cur.execute("""
                INSERT INTO inventory_reports (
                    tenant_id, upload_id, channel, report_date, product_identifier,
                    product_name, quantity, city, location, warehouse_code, raw_data
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                str(tenant_id), str(upload_id), channel, report_date, product_identifier,
                product_name, quantity, city, location, warehouse_code,
                json.dumps(raw_data)
            ))
            processed += 1
            
        except Exception as e:
            failed += 1
            errors.append(f"Row {idx + 2}: {str(e)}")
    
    return processed, failed, errors


def _process_po_report(cur, tenant_id, upload_id, channel, df, mapping):
    """Process PO report rows."""
    processed = 0
    failed = 0
    errors = []
    
    for idx, row in df.iterrows():
        try:
            po_number = safe_str(row.get(mapping.get('po_number', 'PO No.')))
            po_date = parse_date(row.get(mapping.get('po_date', 'PO Date')))
            status = safe_str(row.get(mapping.get('status', 'Status')))
            vendor_code = safe_str(row.get(mapping.get('vendor_code', 'Vendor Code')))
            vendor_name = safe_str(row.get(mapping.get('vendor_name', 'Vendor Name')))
            product_identifier = safe_str(row.get(mapping.get('product_identifier', 'SKU')))
            product_name = safe_str(row.get(mapping.get('product_name', 'Product Name')))
            quantity = safe_decimal(row.get(mapping.get('quantity', 'Qty')))
            unit_cost = safe_decimal(row.get(mapping.get('unit_cost', 'Unit Cost')))
            landing_cost = safe_decimal(row.get(mapping.get('landing_cost', 'Landing Cost')))
            total_amount = safe_decimal(row.get(mapping.get('total_amount', 'Total Amount')))
            location = safe_str(row.get(mapping.get('location', 'Location')))
            asn_quantity = safe_decimal(row.get(mapping.get('asn_quantity', 'ASN Quantity')))
            grn_quantity = safe_decimal(row.get(mapping.get('grn_quantity', 'GRN Quantity')))
            expiry_date = parse_date(row.get(mapping.get('expiry_date', 'Expiry Date')))
            
            raw_data = row.to_dict()
            raw_data = {k: (v.item() if hasattr(v, 'item') else v) for k, v in raw_data.items()}
            raw_data = {k: (None if pd.isna(v) else v) for k, v in raw_data.items()}
            
            cur.execute("""
                INSERT INTO po_reports (
                    tenant_id, upload_id, channel, po_number, po_date, status,
                    vendor_code, vendor_name, product_identifier, product_name,
                    quantity, unit_cost, landing_cost, total_amount, location,
                    asn_quantity, grn_quantity, expiry_date, raw_data
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                str(tenant_id), str(upload_id), channel, po_number, po_date, status,
                vendor_code, vendor_name, product_identifier, product_name,
                quantity, unit_cost, landing_cost, total_amount, location,
                asn_quantity, grn_quantity, expiry_date, json.dumps(raw_data)
            ))
            processed += 1
            
        except Exception as e:
            failed += 1
            errors.append(f"Row {idx + 2}: {str(e)}")
    
    return processed, failed, errors


def _process_profit_loss_report(cur, tenant_id, upload_id, channel, df, mapping):
    """Process profit & loss report rows."""
    processed = 0
    failed = 0
    errors = []
    
    for idx, row in df.iterrows():
        try:
            report_date = parse_date(row.get(mapping.get('date', 'Date')))
            if not report_date:
                report_date = date.today()
            
            product_identifier = safe_str(row.get(mapping.get('product_identifier', 'Product ID')))
            product_name = safe_str(row.get(mapping.get('product_name', 'Product Name')))
            revenue = safe_decimal(row.get(mapping.get('revenue', 'Revenue')))
            cost_of_goods_sold = safe_decimal(row.get(mapping.get('cost_of_goods_sold', 'COGS')))
            gross_profit = safe_decimal(row.get(mapping.get('gross_profit', 'Gross Profit')))
            operating_expenses = safe_decimal(row.get(mapping.get('operating_expenses', 'Operating Expenses')))
            net_profit = safe_decimal(row.get(mapping.get('net_profit', 'Net Profit')))
            quantity_sold = safe_decimal(row.get(mapping.get('quantity_sold', 'Quantity')))
            
            raw_data = row.to_dict()
            raw_data = {k: (v.item() if hasattr(v, 'item') else v) for k, v in raw_data.items()}
            raw_data = {k: (None if pd.isna(v) else v) for k, v in raw_data.items()}
            
            cur.execute("""
                INSERT INTO profit_loss_reports (
                    tenant_id, upload_id, channel, report_date, product_identifier,
                    product_name, revenue, cost_of_goods_sold, gross_profit,
                    operating_expenses, net_profit, quantity_sold, raw_data
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                str(tenant_id), str(upload_id), channel, report_date, product_identifier,
                product_name, revenue, cost_of_goods_sold, gross_profit,
                operating_expenses, net_profit, quantity_sold, json.dumps(raw_data)
            ))
            processed += 1
            
        except Exception as e:
            failed += 1
            errors.append(f"Row {idx + 2}: {str(e)}")
    
    return processed, failed, errors


def _process_ads_report(cur, tenant_id, upload_id, channel, df, mapping):
    """Process ads report rows."""
    processed = 0
    failed = 0
    errors = []
    
    # Get available columns for fallback
    available_columns = list(df.columns)
    
    for idx, row in df.iterrows():
        try:
            # Date - try mapping first, then fallbacks
            date_col = mapping.get('date')
            report_date = None
            if date_col:
                report_date = parse_date(row.get(date_col))
            if not report_date:
                # Try alternative column names
                for alt_col in ['Date', 'date', 'report_date', 'Report Date', 'ORDERED_DATE', 'Order Date']:
                    if alt_col in available_columns:
                        report_date = parse_date(row.get(alt_col))
                        if report_date:
                            break
            if not report_date:
                report_date = date.today()
            
            # Campaign Name - try mapping first, then fallbacks
            campaign_name = safe_str(row.get(mapping.get('campaign_name', '')))
            if not campaign_name:
                for alt_col in ['Campaign Name', 'Campaign', 'campaign_name', 'CAMPAIGN_NAME']:
                    if alt_col in available_columns:
                        campaign_name = safe_str(row.get(alt_col))
                        if campaign_name:
                            break
            
            # Ad Group - try mapping first, then fallbacks
            ad_group = safe_str(row.get(mapping.get('ad_group', '')))
            if not ad_group:
                for alt_col in ['Ad Group', 'AdGroup', 'ad_group', 'AD_GROUP']:
                    if alt_col in available_columns:
                        ad_group = safe_str(row.get(alt_col))
                        if ad_group:
                            break
            
            # Product Identifier - try mapping first, then fallbacks
            product_identifier = safe_str(row.get(mapping.get('product_identifier', '')))
            if not product_identifier:
                for alt_col in ['PRODUCT_ITEM_ID', 'Product ID', 'Product Id', 'SKU', 'SKU ID', 
                                'product_id', 'product_identifier', 'ITEM_CODE']:
                    if alt_col in available_columns:
                        product_identifier = safe_str(row.get(alt_col))
                        if product_identifier:
                            break
            
            # Impressions - try mapping first, then fallbacks
            impressions = safe_int(row.get(mapping.get('impressions', '')))
            if impressions == 0:
                for alt_col in ['VIEWS', 'Views', 'Impressions', 'impressions', 'IMPRESSIONS']:
                    if alt_col in available_columns:
                        imp_val = safe_int(row.get(alt_col))
                        if imp_val > 0:
                            impressions = imp_val
                            break
            
            # Clicks - try mapping first, then fallbacks
            clicks = safe_int(row.get(mapping.get('clicks', '')))
            if clicks == 0:
                for alt_col in ['CLICKS', 'Clicks', 'clicks', 'CLICK']:
                    if alt_col in available_columns:
                        click_val = safe_int(row.get(alt_col))
                        if click_val > 0:
                            clicks = click_val
                            break
            
            # Spend - try mapping first, then fallbacks
            spend = safe_decimal(row.get(mapping.get('spend', '')))
            if spend == 0:
                for alt_col in ['COST', 'Ad Spend', 'Spend', 'spend', 'SPEND', 'Cost', 'cost']:
                    if alt_col in available_columns:
                        spend_val = safe_decimal(row.get(alt_col))
                        if spend_val > 0:
                            spend = spend_val
                            break
            
            # Sales - try mapping first, then fallbacks
            sales = safe_decimal(row.get(mapping.get('sales', '')))
            if sales == 0:
                for alt_col in ['SALES', 'Total Revenue (Rs.)', 'Revenue', 'sales', 'SALES', 
                                'Total Revenue', 'Revenue (Rs.)']:
                    if alt_col in available_columns:
                        sales_val = safe_decimal(row.get(alt_col))
                        if sales_val > 0:
                            sales = sales_val
                            break
            
            # ROAS - try mapping first, then fallbacks
            roas = safe_decimal(row.get(mapping.get('roas', '')))
            if roas == 0:
                for alt_col in ['ROAS', 'ROI', 'roas', 'roi', 'ROAS', 'Return on Ad Spend']:
                    if alt_col in available_columns:
                        roas_val = safe_decimal(row.get(alt_col))
                        if roas_val > 0:
                            roas = roas_val
                            break
            
            # ACOS - try mapping first, then fallbacks
            acos = safe_decimal(row.get(mapping.get('acos', '')))
            if acos == 0:
                for alt_col in ['ACOS', 'acos', 'ACOS', 'Advertising Cost of Sales']:
                    if alt_col in available_columns:
                        acos_val = safe_decimal(row.get(alt_col))
                        if acos_val > 0:
                            acos = acos_val
                            break
            
            raw_data = row.to_dict()
            raw_data = {k: (v.item() if hasattr(v, 'item') else v) for k, v in raw_data.items()}
            raw_data = {k: (None if pd.isna(v) else v) for k, v in raw_data.items()}
            
            cur.execute("""
                INSERT INTO ads_reports (
                    tenant_id, upload_id, channel, report_date, campaign_name,
                    ad_group, product_identifier, impressions, clicks, spend,
                    sales, roas, acos, raw_data
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                str(tenant_id), str(upload_id), channel, report_date, campaign_name,
                ad_group, product_identifier, impressions, clicks, spend,
                sales, roas, acos, json.dumps(raw_data)
            ))
            processed += 1
            
        except Exception as e:
            failed += 1
            errors.append(f"Row {idx + 2}: {str(e)}")
    
    return processed, failed, errors


@router.get("/uploads")
async def list_uploads(
    x_tenant_id: str = Header(...),
    channel: Optional[str] = Query(None),
    report_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
):
    """List recent report uploads."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        query = """
            SELECT id, channel, report_type, file_name, file_size, total_rows,
                   processed_rows, failed_rows, status, uploaded_at, processed_at
            FROM report_uploads
            WHERE tenant_id = %s
        """
        params = [str(tenant_id)]
        
        if channel:
            query += " AND channel = %s"
            params.append(channel)
        
        if report_type:
            query += " AND report_type = %s"
            params.append(report_type)
        
        query += " ORDER BY uploaded_at DESC LIMIT %s"
        params.append(limit)
        
        cur.execute(query, params)
        results = cur.fetchall()
        # Convert UUID and datetime to strings for JSON serialization
        return [
            {
                **row,
                'id': str(row['id']),
                'uploaded_at': row['uploaded_at'].isoformat() if row['uploaded_at'] else None,
                'processed_at': row['processed_at'].isoformat() if row['processed_at'] else None,
            }
            for row in results
        ]


@router.get("/sales")
async def get_sales_reports(
    x_tenant_id: str = Header(...),
    channel: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(1000, ge=1, le=10000),
    offset: int = Query(0, ge=0),
):
    """Get sales reports data."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        # Optimize: Extract only needed fields from JSONB in SQL instead of fetching entire raw_data
        query = """
            SELECT 
                report_date,
                product_identifier as item_id,
                product_name as item_name,
                channel,
                quantity as units,
                total_amount as revenue,
                raw_data->>'Brand Name' as brand,
                raw_data->>'DRR' as drr
            FROM sales_reports
            WHERE tenant_id = %s
        """
        params = [str(tenant_id)]
        
        if channel:
            query += " AND channel = %s"
            params.append(channel)
        
        if start_date:
            query += " AND report_date >= %s"
            params.append(start_date)
        
        if end_date:
            query += " AND report_date <= %s"
            params.append(end_date)
        
        query += " ORDER BY report_date DESC, channel, product_name LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        cur.execute(query, params)
        results = cur.fetchall()
        
        # Process results - much faster without JSONB parsing
        processed_results = []
        for row in results:
            processed_row = {
                'date': row['report_date'].isoformat() if row['report_date'] else None,
                'item_id': row['item_id'] or '',
                'item_name': row['item_name'] or '',
                'channel': row['channel'] or '',
                'units': float(row['units']) if row['units'] else 0,
                'revenue': float(row['revenue']) if row['revenue'] else 0,
                'brand': row.get('brand') or '',
                'drr': row.get('drr') or '',
            }
            processed_results.append(processed_row)
        
        return processed_results


@router.get("/sales/summary")
async def get_sales_summary(
    x_tenant_id: str = Header(...),
    channel: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Get sales summary statistics."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        query = """
            SELECT 
                COUNT(DISTINCT product_identifier) as total_products,
                SUM(quantity) as total_units,
                SUM(total_amount) as total_revenue,
                COUNT(*) as total_orders
            FROM sales_reports
            WHERE tenant_id = %s
        """
        params = [str(tenant_id)]
        
        if channel:
            query += " AND channel = %s"
            params.append(channel)
        
        if start_date:
            query += " AND report_date >= %s"
            params.append(start_date)
        
        if end_date:
            query += " AND report_date <= %s"
            params.append(end_date)
        
        cur.execute(query, params)
        result = cur.fetchone()
        
        if result:
            return {
                'total_revenue': float(result['total_revenue'] or 0),
                'total_units': float(result['total_units'] or 0),
                'total_orders': int(result['total_orders'] or 0),
                'total_products': int(result['total_products'] or 0),
            }
        return {
            'total_revenue': 0,
            'total_units': 0,
            'total_orders': 0,
            'total_products': 0,
        }


@router.get("/inventory")
async def get_inventory_reports(
    x_tenant_id: str = Header(...),
    channel: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(1000, ge=1, le=10000),
    offset: int = Query(0, ge=0),
):
    """Get inventory reports data."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        # Optimize: Use COALESCE to extract JSONB fields in SQL for better performance
        query = """
            SELECT 
                report_date,
                product_identifier as sku,
                product_name,
                channel,
                quantity as inventory,
                COALESCE(
                    (raw_data->>'Total sellable')::numeric,
                    (raw_data->>'Sellable')::numeric,
                    (raw_data->>'Sellable Units')::numeric,
                    quantity
                ) as sellable,
                COALESCE(
                    (raw_data->>'Total unsellable')::numeric,
                    (raw_data->>'Unsellable')::numeric,
                    (raw_data->>'Unsellable Units')::numeric,
                    0
                ) as unsellable,
                city,
                location,
                warehouse_code
            FROM inventory_reports
            WHERE tenant_id = %s
        """
        params = [str(tenant_id)]
        
        if channel:
            query += " AND channel = %s"
            params.append(channel)
        
        if start_date:
            query += " AND report_date >= %s"
            params.append(start_date)
        
        if end_date:
            query += " AND report_date <= %s"
            params.append(end_date)
        
        query += " ORDER BY report_date DESC, channel, product_name LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        cur.execute(query, params)
        results = cur.fetchall()
        
        # Process results - much faster without JSONB parsing in Python
        processed_results = []
        for row in results:
            processed_row = {
                'date': row['report_date'].isoformat() if row['report_date'] else None,
                'sku': row['sku'] or '',
                'product_name': row['product_name'] or '',
                'channel': row['channel'] or '',
                'inventory': float(row['inventory']) if row['inventory'] else 0,
                'sellable': float(row['sellable']) if row['sellable'] else 0,
                'unsellable': float(row['unsellable']) if row['unsellable'] else 0,
                'city': row['city'] or '',
                'location': row['location'] or '',
                'warehouse_code': row['warehouse_code'] or '',
            }
            processed_results.append(processed_row)
        
        return processed_results


@router.get("/inventory/summary")
async def get_inventory_summary(
    x_tenant_id: str = Header(...),
    channel: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Get inventory summary statistics."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        query = """
            SELECT 
                COUNT(DISTINCT product_identifier) as total_products,
                SUM(quantity) as total_inventory,
                COUNT(DISTINCT location) as total_locations
            FROM inventory_reports
            WHERE tenant_id = %s
        """
        params = [str(tenant_id)]
        
        if channel:
            query += " AND channel = %s"
            params.append(channel)
        
        if start_date:
            query += " AND report_date >= %s"
            params.append(start_date)
        
        if end_date:
            query += " AND report_date <= %s"
            params.append(end_date)
        
        cur.execute(query, params)
        result = cur.fetchone()
        
        if result:
            return {
                'total_inventory': float(result['total_inventory'] or 0),
                'total_products': int(result['total_products'] or 0),
                'total_locations': int(result['total_locations'] or 0),
            }
        return {
            'total_inventory': 0,
            'total_products': 0,
            'total_locations': 0,
        }


@router.get("/po")
async def get_po_reports(
    x_tenant_id: str = Header(...),
    channel: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(1000, ge=1, le=10000),
    offset: int = Query(0, ge=0),
):
    """Get PO reports data."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        query = """
            SELECT 
                po_date as date,
                po_number,
                channel,
                status,
                vendor_code,
                vendor_name,
                product_identifier as sku_id,
                product_name,
                quantity as units,
                total_amount as value,
                location,
                asn_quantity,
                grn_quantity,
                expiry_date,
                raw_data
            FROM po_reports
            WHERE tenant_id = %s
        """
        params = [str(tenant_id)]
        
        if channel:
            query += " AND channel = %s"
            params.append(channel)
        
        if start_date:
            query += " AND (po_date >= %s OR po_date IS NULL)"
            params.append(start_date)
        
        if end_date:
            query += " AND (po_date <= %s OR po_date IS NULL)"
            params.append(end_date)
        
        query += " ORDER BY po_date DESC NULLS FIRST, channel, po_number LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        cur.execute(query, params)
        results = cur.fetchall()
        
        # Process results
        processed_results = []
        for row in results:
            processed_row = {
                'date': row['date'].isoformat() if row['date'] else None,
                'po_number': row['po_number'] or '',
                'channel': row['channel'] or '',
                'status': row['status'] or '',
                'vendor_code': row['vendor_code'] or '',
                'vendor_name': row['vendor_name'] or '',
                'sku_id': row['sku_id'] or '',
                'product_name': row['product_name'] or '',
                'units': float(row['units']) if row['units'] else 0,
                'value': float(row['value']) if row['value'] else 0,
                'location': row['location'] or '',
                'asn_quantity': float(row['asn_quantity']) if row['asn_quantity'] else 0,
                'grn_quantity': float(row['grn_quantity']) if row['grn_quantity'] else 0,
                'expiry_date': row['expiry_date'].isoformat() if row['expiry_date'] else None,
            }
            processed_results.append(processed_row)
        
        return processed_results


@router.get("/po/summary")
async def get_po_summary(
    x_tenant_id: str = Header(...),
    channel: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Get PO summary statistics."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        query = """
            SELECT 
                COUNT(DISTINCT po_number) as total_pos,
                COUNT(DISTINCT CASE WHEN status NOT IN ('GRN_DONE', 'COMPLETED') THEN po_number END) as pending_pos,
                SUM(total_amount) as total_value,
                COUNT(DISTINCT location) as total_locations
            FROM po_reports
            WHERE tenant_id = %s
        """
        params = [str(tenant_id)]
        
        if channel:
            query += " AND channel = %s"
            params.append(channel)
        
        if start_date:
            query += " AND (po_date >= %s OR po_date IS NULL)"
            params.append(start_date)
        
        if end_date:
            query += " AND (po_date <= %s OR po_date IS NULL)"
            params.append(end_date)
        
        cur.execute(query, params)
        result = cur.fetchone()
        
        if result:
            return {
                'total_pos': int(result['total_pos'] or 0),
                'pending_pos': int(result['pending_pos'] or 0),
                'total_value': float(result['total_value'] or 0),
                'total_locations': int(result['total_locations'] or 0),
            }
        return {
            'total_pos': 0,
            'pending_pos': 0,
            'total_value': 0,
            'total_locations': 0,
        }


@router.get("/ads")
async def get_ads_reports(
    x_tenant_id: str = Header(...),
    channel: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(1000, ge=1, le=10000),
    offset: int = Query(0, ge=0),
):
    """Get ads reports data."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        # Optimized: Don't fetch raw_data for better performance
        query = """
            SELECT 
                report_date,
                campaign_name,
                ad_group,
                product_identifier,
                impressions,
                clicks,
                spend,
                sales,
                roas,
                acos,
                channel
            FROM ads_reports
            WHERE tenant_id = %s
        """
        params = [str(tenant_id)]
        
        if channel:
            query += " AND channel = %s"
            params.append(channel)
        
        if start_date:
            query += " AND report_date >= %s"
            params.append(start_date)
        
        if end_date:
            query += " AND report_date <= %s"
            params.append(end_date)
        
        query += " ORDER BY report_date DESC, channel, campaign_name, product_identifier LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        cur.execute(query, params)
        results = cur.fetchall()
        
        # Process results - fast without raw_data
        processed_results = []
        for row in results:
            processed_row = {
                'date': row['report_date'].isoformat() if row['report_date'] else None,
                'campaign_name': row['campaign_name'] or '',
                'ad_group': row['ad_group'] or '',
                'product_identifier': row['product_identifier'] or '',
                'impressions': int(row['impressions']) if row['impressions'] else 0,
                'clicks': int(row['clicks']) if row['clicks'] else 0,
                'spend': float(row['spend']) if row['spend'] else 0,
                'sales': float(row['sales']) if row['sales'] else 0,
                'roas': float(row['roas']) if row['roas'] else 0,
                'acos': float(row['acos']) if row['acos'] else 0,
                'channel': row['channel'] or '',
            }
            processed_results.append(processed_row)
        
        return processed_results


@router.get("/ads/summary")
async def get_ads_summary(
    x_tenant_id: str = Header(...),
    channel: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Get ads summary statistics."""
    tenant_id = get_tenant_id(x_tenant_id)
    
    with get_db_cursor(dict_cursor=True) as cur:
        query = """
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT campaign_name) as total_campaigns,
                COUNT(DISTINCT product_identifier) as total_products,
                SUM(impressions) as total_impressions,
                SUM(clicks) as total_clicks,
                SUM(spend) as total_spend,
                SUM(sales) as total_sales,
                CASE 
                    WHEN SUM(spend) > 0 THEN SUM(sales) / SUM(spend)
                    ELSE 0
                END as overall_roas,
                CASE 
                    WHEN SUM(impressions) > 0 THEN (SUM(clicks)::DECIMAL / SUM(impressions)) * 100
                    ELSE 0
                END as overall_ctr,
                CASE 
                    WHEN SUM(clicks) > 0 THEN (SUM(sales) / SUM(clicks))
                    ELSE 0
                END as avg_revenue_per_click
            FROM ads_reports
            WHERE tenant_id = %s
        """
        params = [str(tenant_id)]
        
        if channel:
            query += " AND channel = %s"
            params.append(channel)
        
        if start_date:
            query += " AND report_date >= %s"
            params.append(start_date)
        
        if end_date:
            query += " AND report_date <= %s"
            params.append(end_date)
        
        cur.execute(query, params)
        result = cur.fetchone()
        
        if result and result['total_records']:
            return {
                'total_records': int(result['total_records']),
                'total_campaigns': int(result['total_campaigns']),
                'total_products': int(result['total_products']),
                'total_impressions': int(result['total_impressions']) if result['total_impressions'] else 0,
                'total_clicks': int(result['total_clicks']) if result['total_clicks'] else 0,
                'total_spend': float(result['total_spend']) if result['total_spend'] else 0,
                'total_sales': float(result['total_sales']) if result['total_sales'] else 0,
                'overall_roas': float(result['overall_roas']) if result['overall_roas'] else 0,
                'overall_ctr': float(result['overall_ctr']) if result['overall_ctr'] else 0,
                'avg_revenue_per_click': float(result['avg_revenue_per_click']) if result['avg_revenue_per_click'] else 0,
            }
        
        return {
            'total_records': 0,
            'total_campaigns': 0,
            'total_products': 0,
            'total_impressions': 0,
            'total_clicks': 0,
            'total_spend': 0,
            'total_sales': 0,
            'overall_roas': 0,
            'overall_ctr': 0,
            'avg_revenue_per_click': 0,
        }

