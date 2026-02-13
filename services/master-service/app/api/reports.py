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

# Add shared to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent.parent))

from shared.db import get_db_cursor, get_db_connection

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
            "product_identifier": "Product ID",
            "product_name": "Product Title",
            "quantity": "Quantity Sold",
            "unit_price": "Selling Price",
            "total_amount": "Total Revenue",
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
    valid_channels = ['zepto', 'flipkart', 'amazon', 'blinkit', 'bigbasket']
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
            df = pd.read_excel(io.BytesIO(content))
        else:
            df = pd.read_csv(io.BytesIO(content))
        
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
                tenant_id, channel, report_type, file.filename, file_size,
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
    
    # Convert dataframe to dict records
    for idx, row in df.iterrows():
        try:
            # Extract standardized fields
            report_date = parse_date(row.get(mapping.get('date', 'Date')))
            if not report_date:
                report_date = date.today()  # Default to today
            
            product_identifier = safe_str(row.get(mapping.get('product_identifier', 'SKU')))
            product_name = safe_str(row.get(mapping.get('product_name', 'Product Name')))
            quantity = safe_decimal(row.get(mapping.get('quantity', 'Quantity')))
            unit_price = safe_decimal(row.get(mapping.get('unit_price', 'Price')))
            total_amount = safe_decimal(row.get(mapping.get('total_amount', 'Total')))
            city = safe_str(row.get(mapping.get('city', 'City')))
            location = safe_str(row.get(mapping.get('location', 'Location')))
            
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
                tenant_id, upload_id, channel, report_date, product_identifier,
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
    
    for idx, row in df.iterrows():
        try:
            report_date = parse_date(row.get(mapping.get('date', 'Date')))
            if not report_date:
                report_date = date.today()
            
            product_identifier = safe_str(row.get(mapping.get('product_identifier', 'SKU')))
            product_name = safe_str(row.get(mapping.get('product_name', 'Product Name')))
            quantity = safe_decimal(row.get(mapping.get('quantity', 'Units')))
            city = safe_str(row.get(mapping.get('city', 'City')))
            location = safe_str(row.get(mapping.get('location', 'Location')))
            warehouse_code = safe_str(row.get(mapping.get('warehouse_code', 'Warehouse')))
            
            raw_data = row.to_dict()
            raw_data = {k: (v.item() if hasattr(v, 'item') else v) for k, v in raw_data.items()}
            raw_data = {k: (None if pd.isna(v) else v) for k, v in raw_data.items()}
            
            cur.execute("""
                INSERT INTO inventory_reports (
                    tenant_id, upload_id, channel, report_date, product_identifier,
                    product_name, quantity, city, location, warehouse_code, raw_data
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                tenant_id, upload_id, channel, report_date, product_identifier,
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
                tenant_id, upload_id, channel, po_number, po_date, status,
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
                tenant_id, upload_id, channel, report_date, product_identifier,
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
    
    for idx, row in df.iterrows():
        try:
            report_date = parse_date(row.get(mapping.get('date', 'Date')))
            if not report_date:
                report_date = date.today()
            
            campaign_name = safe_str(row.get(mapping.get('campaign_name', 'Campaign')))
            ad_group = safe_str(row.get(mapping.get('ad_group', 'Ad Group')))
            product_identifier = safe_str(row.get(mapping.get('product_identifier', 'Product ID')))
            impressions = safe_int(row.get(mapping.get('impressions', 'Impressions')))
            clicks = safe_int(row.get(mapping.get('clicks', 'Clicks')))
            spend = safe_decimal(row.get(mapping.get('spend', 'Spend')))
            sales = safe_decimal(row.get(mapping.get('sales', 'Sales')))
            roas = safe_decimal(row.get(mapping.get('roas', 'ROAS')))
            acos = safe_decimal(row.get(mapping.get('acos', 'ACOS')))
            
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
                tenant_id, upload_id, channel, report_date, campaign_name,
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
        params = [tenant_id]
        
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

