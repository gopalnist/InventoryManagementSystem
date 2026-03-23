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
    
    # Try common date formats (including Amazon Viewing Range: 13/03/26)
    formats = [
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%d/%m/%y",
        "%m/%d/%Y",
        "%m/%d/%y",
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


def _parse_amazon_viewing_range(df_row0) -> tuple[Optional[date], Optional[str]]:
    """
    Parse 'Viewing Range=[dd/mm/yy - dd/mm/yy]' from Amazon Sales/Inventory Excel row 0.
    Returns (single_date, error_message). If range spans multiple days, single_date is None and error_message is set.
    If single day, returns (date, None). If not found/invalid, returns (None, None).
    """
    import re
    if df_row0 is None or len(df_row0) == 0:
        return None, None
    for cell in df_row0:
        if pd.isna(cell):
            continue
        s = str(cell).strip()
        if "Viewing Range=" in s or "viewing range=" in s.lower():
            match = re.search(r"\[([^\]]+)\]", s)
            if not match:
                return None, None
            range_str = match.group(1).strip()
            parts = [p.strip() for p in re.split(r"\s*-\s*", range_str, 1)]
            if len(parts) != 2:
                return None, "Viewing date range format invalid (expected 'dd/mm/yy - dd/mm/yy')."
            start_date = parse_date(parts[0])
            end_date = parse_date(parts[1])
            if not start_date or not end_date:
                return None, "Viewing date range could not be parsed. Use format dd/mm/yy - dd/mm/yy."
            if start_date != end_date:
                return None, "Report date is invalid. Viewing date range must be a single day (daily data)."
            return start_date, None
    return None, None


def _strip_currency(s):
    """Strip ₹, $, commas and whitespace for numeric parsing."""
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return None
    s = str(s).strip().replace(",", "").replace(" ", "")
    for c in ("₹", "$", "€", "USD", "INR"):
        s = s.replace(c, "")
    return s.strip() or None


def safe_decimal(value, default=0.0):
    """Safely convert to decimal. Strips currency symbols and commas from strings."""
    if value is None or pd.isna(value):
        return default
    try:
        if isinstance(value, str):
            value = _strip_currency(value)
            if not value:
                return default
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
            "sku_category": "SKU Category",
            "sku_sub_category": "SKU Sub Category",
            "brand_name": "Brand Name",
        },
        "inventory": {
            "date": None,
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
        },
        "ads": {
            "campaign_name": "Campaign_name",  # or CampaignName
            "campaign_type": "CampaignType",
            "city": "CityName",
            "product_identifier": "ProductID",
            "product_name": "ProductName",
            "category": "Category",
            "orders": "Orders",
            "clicks": "Clicks",
            "impressions": "Impressions",
            "spend": "Spend",
            "sales": "Revenue",
            "roas": "Roas",
        },
    },
    "amazon": {
        "sales": {
            "date": None,
            "product_identifier": "ASIN",
            "product_name": "Product Title",
            "quantity": "Ordered Units",
            "total_amount": "Ordered Revenue",
            "brand_name": "Brand",
            "sku_category": "Product Group",
            "sku_sub_category": "Item Class",
        },
        "inventory": {
            "date": None,
            "product_identifier": "ASIN",
            "product_name": "Product Title",
            "quantity": "Sellable On Hand Units",
            "brand_name": "Brand",
        },
        "po": {
            "po_number": "PO",
            "po_date": "Expected date",
            "vendor_code": "Vendor",
            "vendor_name": "Vendor",
            "product_identifier": "ASIN",
            "product_name": "Title",
            "quantity": "Quantity Requested",
            "unit_cost": "Unit Cost",
            "total_amount": "Total cost",
            "location": "Ship to location",
            "expiry_date": "Expected date",
        },
        "ads": {
            "campaign_name": "Campaign name",
            "campaign_type": "Type",
            "clicks": "Clicks",
            "impressions": None,
            "spend": "Total cost",
            "sales": "Sales",
            "roas": "ROAS",
            "acos": "ACOS",
            "orders": "Purchases",
        },
        "traffic": {
            "product_identifier": "ASIN",
            "product_name": "Product Title",
            "brand": "Brand",
            "page_views": "Featured Offer Page Views",
        },
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
    },
    # Weekly Report (Main Dashboard) - each tab uploaded separately
    "weekly_report": {
        "sales": {
            "date": "Date",
            "product_identifier": "SKU Number",
            "product_name": "SKU Name",
            "quantity": "Sales (Qty) - Units",
            "unit_price": "MRP",
            "total_amount": "Gross Merchandise Value",
            "city": "City",
            "sku_category": "SKU Category",
            "sku_sub_category": "SKU Sub Category",
            "brand_name": "Brand Name",
        },
        "ads": None,  # Use WEEKLY_REPORT_ADS_MAPPINGS[data_type] instead
    }
}

# Weekly Report ads: one mapping per tab (ad_city, ad_category, ad_sp_product, ad_sb_product)
WEEKLY_REPORT_ADS_MAPPINGS = {
    "ad_city": {
        "city": "CityName",
        "orders": "Orders",
        "clicks": "Clicks",
        "impressions": "Impressions",
        "spend": "Spend",
        "sales": "Revenue",
        "roas": "Roas",
        "campaign_type_fixed": "SP",
    },
    "ad_category": {
        "campaign_name": "Campaign_name",
        "category": "Category",
        "orders": "Orders",
        "clicks": "Clicks",
        "impressions": "Impressions",
        "spend": "Spend",
        "sales": "Revenue",
        "roas": "Roas",
        "campaign_type_fixed": "SB",
    },
    "ad_sp_product": {
        "product_identifier": "ProductID",
        "product_name": "ProductName",
        "campaign_name": "Campaign_name",
        "category": "Category",
        "orders": "Orders",
        "clicks": "Clicks",
        "impressions": "Impressions",
        "spend": "Spend",
        "sales": "Revenue",
        "roas": "Roas",
        "campaign_type_fixed": "SP",
    },
    "ad_sb_product": {
        "product_identifier": "ProductID",
        "product_name": "ProductName",
        "campaign_name": "Campaign_name",
        "category": "Category",
        "orders": "Orders",
        "clicks": "Clicks",
        "impressions": "Impressions",
        "spend": "Spend",
        "sales": "Revenue",
        "roas": "Roas",
        "campaign_type_fixed": "SB",
    },
}


def _detect_file_source(df, report_type: str) -> Optional[str]:
    """
    Detect if file content looks like Zepto or Amazon based on column names.
    Returns 'zepto', 'amazon', or None if unclear.
    """
    cols = [str(c).strip().lower() for c in df.columns]
    col_set = set(cols)
    
    if report_type == 'sales':
        if 'asin' in col_set and ('ordered revenue' in col_set or 'ordered units' in col_set):
            return 'amazon'
        if 'sku number' in col_set and ('sales (qty) - units' in col_set or 'gross merchandise value' in col_set):
            return 'zepto'
    elif report_type == 'inventory':
        if 'asin' in col_set and ('sellable on hand units' in col_set or 'product title' in col_set):
            return 'amazon'
        if 'sku code' in col_set and 'units' in col_set:
            return 'zepto'
    elif report_type == 'po':
        if 'po' in col_set and 'quantity requested' in col_set:
            return 'amazon'
        if 'po no.' in col_set and 'sku desc' in col_set:
            return 'zepto'
    elif report_type == 'ads':
        # Amazon ads: Campaign name, Type, Total cost, ROAS, Sales, Purchases (typical CSV from Seller Central)
        amazon_ads_score = sum(1 for c in ['campaign name', 'type', 'total cost', 'roas', 'sales', 'purchases', 'acos'] if c in col_set)
        if amazon_ads_score >= 2 and ('campaign name' in col_set or 'total cost' in col_set):
            return 'amazon'
        # Zepto ads: CampaignName, Campaign_name, Revenue, Roas, Spend/Spends, Impressions/Impressions_per_thousand, Orders, CityName (all 9 file types)
        zepto_ads_score = sum(1 for c in ['campaignname', 'campaign_name', 'revenue', 'roas', 'spend', 'spends', 'impressions', 'impressions_per_thousand', 'orders', 'cityname', 'pagename', 'productid', 'category'] if c in col_set)
        if zepto_ads_score >= 2:
            return 'zepto'
        # Fallback: single strong signals (e.g. Overview.xlsx has Date+Spends, Traffic.xlsx has Impressions_per_thousand)
        if 'campaignname' in col_set or 'campaign_name' in col_set:
            if 'revenue' in col_set or 'roas' in col_set or 'spend' in col_set or 'spends' in col_set:
                return 'zepto'
        if 'cityname' in col_set and ('spend' in col_set or 'spends' in col_set or 'revenue' in col_set):
            return 'zepto'
        if 'spends' in col_set and ('date' in col_set or 'brandid' in col_set):
            return 'zepto'
        if 'impressions_per_thousand' in col_set:
            return 'zepto'
    elif report_type == 'traffic':
        # Amazon Traffic: ASIN, Product Title, Brand, Featured Offer Page Views
        if 'asin' in col_set and ('featured offer page views' in col_set or 'product title' in col_set):
            return 'amazon'
    return None


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
    errors: Optional[List[str]] = None  # Row-level errors: e.g. ["Row 2: ...", "Row 5: ..."]


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/upload", response_model=UploadResponse)
async def upload_report(
    file: UploadFile = File(...),
    channel: str = Form(...),
    report_type: str = Form(...),
    data_type: Optional[str] = Form(None),
    batch_tag: Optional[str] = Form(None),
    report_date: Optional[str] = Form(None),
    x_tenant_id: str = Header(...),
):
    """
    Upload a report file (Excel/CSV) for a specific channel and report type.
    
    Supported channels: zepto, flipkart, amazon, blinkit, bigbasket, swiggy, google_ads, google_pla, weekly_report
    Supported report types: sales, inventory, po, profit_loss, ads
    For channel=weekly_report and report_type=ads, data_type must be: ad_city, ad_category, ad_sp_product, ad_sb_product
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
    valid_channels = ['zepto', 'flipkart', 'amazon', 'amazon_ads', 'blinkit', 'bigbasket', 'swiggy', 'google_ads', 'google_pla', 'weekly_report']
    valid_report_types = ['sales', 'inventory', 'po', 'profit_loss', 'ads', 'traffic']
    valid_weekly_ads_data_types = ['ad_city', 'ad_category', 'ad_sp_product', 'ad_sb_product']
    
    channel = channel.lower()
    report_type = report_type.lower()
    if data_type:
        data_type = data_type.lower()
    
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
    
    if channel == 'weekly_report' and report_type == 'ads':
        if not data_type or data_type not in valid_weekly_ads_data_types:
            raise HTTPException(
                status_code=400,
                detail=f"For Weekly Report ads upload, data_type must be one of: {', '.join(valid_weekly_ads_data_types)}"
            )
    
    # Read file
    try:
        content = await file.read()
        file_size = len(content)
        
        if file.filename.endswith(('.xlsx', '.xls')):
            if channel == 'blinkit' and report_type == 'inventory':
                df = pd.read_excel(io.BytesIO(content), skiprows=2)
            elif channel == 'amazon' and report_type in ('sales', 'inventory', 'traffic'):
                # Amazon Sales/Inventory/Traffic: row 0 = metadata (Viewing Range), row 1 = column headers
                df = pd.read_excel(io.BytesIO(content), header=1)
            elif channel == 'weekly_report' and report_type == 'ads' and data_type == 'ad_sp_product':
                df = pd.read_excel(io.BytesIO(content), header=3)
            elif channel == 'weekly_report' and report_type == 'ads' and data_type == 'ad_sb_product':
                df = pd.read_excel(io.BytesIO(content), header=4)
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
    
    # Validate channel vs file content: reject if file belongs to a different channel (Zepto vs Amazon)
    # Applies for all channels (except weekly_report) so wrong selection is caught before processing
    if channel != 'weekly_report':
        detected = _detect_file_source(df, report_type)
        # Fallback: Excel files (e.g. Amazon Sales) often have row 0 = metadata, row 1 = headers
        if detected is None and file.filename and file.filename.endswith(('.xlsx', '.xls')) and report_type in ('sales', 'inventory', 'traffic'):
            try:
                df_alt = pd.read_excel(io.BytesIO(content), header=1)
                if len(df_alt.columns) > 2:
                    detected = _detect_file_source(df_alt, report_type)
            except Exception:
                pass
        if detected == 'amazon':
            if channel != 'amazon' and channel != 'amazon_ads':
                raise HTTPException(
                    status_code=400,
                    detail="This file belongs to Amazon. Please select channel Amazon (or Amazon Advertising for ads) and upload again."
                )
        elif detected == 'zepto':
            if channel != 'zepto':
                raise HTTPException(
                    status_code=400,
                    detail="This file belongs to Zepto. Please select channel Zepto and upload again."
                )
    
    # Get column mapping
    if channel == 'weekly_report' and report_type == 'ads' and data_type:
        mapping = WEEKLY_REPORT_ADS_MAPPINGS.get(data_type, {})
    elif channel == 'amazon_ads' and report_type == 'ads':
        mapping = DEFAULT_MAPPINGS.get('amazon', {}).get('ads', {})
    else:
        mapping = DEFAULT_MAPPINGS.get(channel, {}).get(report_type, {})
    
    if not mapping:
        raise HTTPException(
            status_code=400,
            detail=f"No mapping for channel={channel}, report_type={report_type}" + (f", data_type={data_type}" if data_type else "")
        )
    
    # Parse optional report_date (for which date this report is); uploaded_at is when we upload
    report_for_date_val = None
    if report_date and str(report_date).strip():
        report_for_date_val = parse_date(report_date)
    
    # Amazon Sales/Inventory/Traffic: report_date = Viewing Range from row 0; must be a single day (daily data)
    if channel == 'amazon' and report_type in ('sales', 'inventory', 'traffic') and file.filename and file.filename.endswith(('.xlsx', '.xls')):
        try:
            df_meta = pd.read_excel(io.BytesIO(content), header=None)
            if len(df_meta) > 0:
                single_date, viewing_err = _parse_amazon_viewing_range(df_meta.iloc[0])
                if viewing_err:
                    raise HTTPException(status_code=400, detail=viewing_err)
                if single_date:
                    report_for_date_val = single_date
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read Viewing date range from file: {e}")
    
    # Create upload record
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Insert upload record (batch_tag, report_for_date optional)
            cur.execute("""
                INSERT INTO report_uploads (
                    tenant_id, channel, report_type, file_name, file_size,
                    total_rows, status, uploaded_at, batch_tag, report_for_date
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                str(tenant_id), channel, report_type, file.filename, file_size,
                total_rows, 'processing', datetime.now(), (batch_tag or None), report_for_date_val
            ))
            upload_id = cur.fetchone()[0]
            
            # Process rows based on report type
            processed_rows = 0
            failed_rows = 0
            errors = []
            
            if report_type == 'sales':
                processed_rows, failed_rows, errors = _process_sales_report(
                    cur, tenant_id, upload_id, channel, df, mapping,
                    default_report_date=report_for_date_val
                )
            elif report_type == 'inventory':
                processed_rows, failed_rows, errors = _process_inventory_report(
                    cur, tenant_id, upload_id, channel, df, mapping,
                    default_report_date=report_for_date_val
                )
            elif report_type == 'po':
                processed_rows, failed_rows, errors = _process_po_report(
                    cur, tenant_id, upload_id, channel, df, mapping
                )
            elif report_type == 'profit_loss':
                processed_rows, failed_rows, errors = _process_profit_loss_report(
                    cur, tenant_id, upload_id, channel, df, mapping,
                    default_report_date=report_for_date_val
                )
            elif report_type == 'ads':
                processed_rows, failed_rows, errors = _process_ads_report(
                    cur, tenant_id, upload_id, channel, df, mapping,
                    data_type=data_type if channel == 'weekly_report' else None,
                    default_report_date=report_for_date_val
                )
            elif report_type == 'traffic':
                processed_rows, failed_rows, errors = _process_traffic_report(
                    cur, tenant_id, upload_id, channel, df, mapping,
                    default_report_date=report_for_date_val
                )
            
            # Update upload status (store up to 100 row errors for display)
            status = 'completed' if failed_rows == 0 else ('partial' if processed_rows > 0 else 'failed')
            errors_for_db = errors[:100] if errors else []
            error_message = None if not errors_for_db else json.dumps(errors_for_db)
            
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
                       (f", {failed_rows} failed" if failed_rows > 0 else ""),
                errors=errors[:100] if errors else None,
            )
            
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
    finally:
        conn.close()


def _process_sales_report(cur, tenant_id, upload_id, channel, df, mapping, default_report_date=None):
    """Process sales report rows. default_report_date: use when row has no date (user-specified at upload)."""
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
                report_date = default_report_date or date.today()
            
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
            
            # Optional: sku_category, sku_sub_category, brand_name (Weekly Report / MAIN-1 / Zepto / Amazon)
            # Try mapping first, then multiple column name variants so category/subcategory populate from any source
            map_cat = mapping.get('sku_category', '')
            sku_category = safe_str(row.get(map_cat)) if map_cat else None
            if not sku_category:
                for col in ['SKU Category', 'Sku Category', 'sku category', 'Category', 'Product Category', 'Product Group', 'Item Class', 'category']:
                    if col in df.columns:
                        sku_category = safe_str(row.get(col))
                        if sku_category:
                            break
            map_sub = mapping.get('sku_sub_category', '')
            sku_sub_category = safe_str(row.get(map_sub)) if map_sub else None
            if not sku_sub_category:
                for col in ['SKU Sub Category', 'Sku Sub Category', 'sku sub category', 'Subcategory', 'Sub Category', 'Product Subcategory', 'Item Subclass', 'subcategory']:
                    if col in df.columns:
                        sku_sub_category = safe_str(row.get(col))
                        if sku_sub_category:
                            break
            brand_name = safe_str(row.get(mapping.get('brand_name', ''))) or None
            if not brand_name and 'Brand Name' in df.columns:
                brand_name = safe_str(row.get('Brand Name')) or None
            
            # Build row detail for error messages (ASIN + product name for easy tracing)
            _pid = (product_identifier or '').strip() or '—'
            _pname = (product_name or '').strip() or '—'
            if len(_pname) > 60:
                _pname = _pname[:60] + '…'
            row_detail = f"ASIN: {_pid}, Product: {_pname}"
            
            # Validate row has meaningful data - skip empty/invalid rows (record reason for UI)
            if not product_identifier and not product_name:
                failed += 1
                errors.append(f"Row {idx + 2} ({row_detail}): Skipped - no product identifier or product name")
                continue
            
            # Allow quantity and total_amount to be zero or missing (treated as 0) — row is still valid
            # Store all raw data as JSONB (ensure JSON-serializable)
            raw_data = row.to_dict()
            raw_data = {k: (v.item() if hasattr(v, 'item') else v) for k, v in raw_data.items()}
            raw_data = {k: (None if pd.isna(v) else v) for k, v in raw_data.items()}
            try:
                raw_json = json.dumps(raw_data, default=lambda x: float(x) if hasattr(x, '__float__') else str(x))
            except (TypeError, ValueError):
                raw_json = json.dumps({k: str(v) for k, v in raw_data.items()})

            cur.execute("SAVEPOINT sp_sales_row")
            try:
                cur.execute("""
                    INSERT INTO sales_reports (
                        tenant_id, upload_id, channel, report_date, product_identifier,
                        product_name, quantity, unit_price, total_amount, city, location,
                        sku_category, sku_sub_category, brand_name, raw_data
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    str(tenant_id), str(upload_id), channel, report_date, product_identifier,
                    product_name, quantity, unit_price, total_amount, city, location,
                    sku_category, sku_sub_category, brand_name, raw_json
                ))
                cur.execute("RELEASE SAVEPOINT sp_sales_row")
                processed += 1
            except Exception as row_err:
                cur.execute("ROLLBACK TO SAVEPOINT sp_sales_row")
                failed += 1
                errors.append(f"Row {idx + 2} ({row_detail}): {str(row_err)}")
            
        except Exception as e:
            failed += 1
            _pid = (product_identifier or '').strip() or '—'
            _pname = ((product_name or '').strip() or '—')[:60]
            if (product_name or '').strip() and len((product_name or '').strip()) > 60:
                _pname += '…'
            errors.append(f"Row {idx + 2} (ASIN: {_pid}, Product: {_pname}): {str(e)}")
    
    return processed, failed, errors


def _process_inventory_report(cur, tenant_id, upload_id, channel, df, mapping, default_report_date=None):
    """Process inventory report rows. default_report_date: use when row has no date (user-specified at upload)."""
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
                report_date = default_report_date or date.today()
            
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
            
            # Row detail for error messages (SKU/ASIN + product name for tracing)
            _pid = (product_identifier or '').strip() or '—'
            _pname = ((product_name or '').strip() or '—')[:60]
            if (product_name or '').strip() and len((product_name or '').strip()) > 60:
                _pname += '…'
            row_detail = f"SKU/ASIN: {_pid}, Product: {_pname}"
            
            # Validate row has meaningful data - skip empty/invalid rows
            if not product_identifier and not product_name:
                failed += 1
                errors.append(f"Row {idx + 2} ({row_detail}): Skipped - no product identifier or product name")
                continue
            
            # Allow quantity to be zero or missing (treated as 0) — row is still valid
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
            errors.append(f"Row {idx + 2} ({row_detail}): {str(e)}")
    
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
            
            # Row detail for error messages (PO + SKU/ASIN + product name for tracing)
            _po = (po_number or '').strip() or '—'
            _pid = (product_identifier or '').strip() or '—'
            _pname = ((product_name or '').strip() or '—')[:60]
            if (product_name or '').strip() and len((product_name or '').strip()) > 60:
                _pname += '…'
            row_detail = f"PO: {_po}, SKU/ASIN: {_pid}, Product: {_pname}"
            
            # Allow missing/zero: only skip if PO number is completely missing (required identifier)
            if not (po_number or '').strip():
                failed += 1
                errors.append(f"Row {idx + 2} ({row_detail}): Skipped - no PO number")
                continue
            
            # Allow quantity, total_amount, product id/name to be zero or missing — row is still valid
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
            errors.append(f"Row {idx + 2} ({row_detail}): {str(e)}")
    
    return processed, failed, errors


def _process_profit_loss_report(cur, tenant_id, upload_id, channel, df, mapping, default_report_date=None):
    """Process profit & loss report rows. default_report_date: use when row has no date (user-specified at upload)."""
    processed = 0
    failed = 0
    errors = []
    
    for idx, row in df.iterrows():
        try:
            report_date = parse_date(row.get(mapping.get('date', 'Date')))
            if not report_date:
                report_date = default_report_date or date.today()
            
            product_identifier = safe_str(row.get(mapping.get('product_identifier', 'Product ID')))
            product_name = safe_str(row.get(mapping.get('product_name', 'Product Name')))
            revenue = safe_decimal(row.get(mapping.get('revenue', 'Revenue')))
            cost_of_goods_sold = safe_decimal(row.get(mapping.get('cost_of_goods_sold', 'COGS')))
            gross_profit = safe_decimal(row.get(mapping.get('gross_profit', 'Gross Profit')))
            operating_expenses = safe_decimal(row.get(mapping.get('operating_expenses', 'Operating Expenses')))
            net_profit = safe_decimal(row.get(mapping.get('net_profit', 'Net Profit')))
            quantity_sold = safe_decimal(row.get(mapping.get('quantity_sold', 'Quantity')))
            
            # Row detail for error messages (ASIN + product name for tracing)
            _pid = (product_identifier or '').strip() or '—'
            _pname = ((product_name or '').strip() or '—')[:60]
            if (product_name or '').strip() and len((product_name or '').strip()) > 60:
                _pname += '…'
            row_detail = f"ASIN: {_pid}, Product: {_pname}"
            
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
            errors.append(f"Row {idx + 2} ({row_detail}): {str(e)}")
    
    return processed, failed, errors


def _process_ads_report(cur, tenant_id, upload_id, channel, df, mapping, data_type: Optional[str] = None, default_report_date=None):
    """Process ads report rows. default_report_date: use when row has no date (user-specified at upload)."""
    processed = 0
    failed = 0
    errors = []
    
    # Get available columns for fallback
    available_columns = list(df.columns)
    
    # Weekly Report: fixed campaign_type and optional city, orders, category from mapping
    campaign_type_fixed = mapping.get('campaign_type_fixed')
    city_col = mapping.get('city')
    orders_col = mapping.get('orders')
    category_col = mapping.get('category')
    
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
                report_date = default_report_date or date.today()
            
            # Campaign Name - try mapping first, then fallbacks
            campaign_name = safe_str(row.get(mapping.get('campaign_name', '')))
            if not campaign_name:
                for alt_col in ['Campaign Name', 'Campaign', 'CampaignName', 'Campaign_name', 'Campaign_id', 'PageName', 'campaign_name', 'CAMPAIGN_NAME']:
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
                for alt_col in ['ProductID', 'PRODUCT_ITEM_ID', 'Product ID', 'Product Id', 'SKU', 'SKU ID', 
                                'product_id', 'product_identifier', 'ITEM_CODE']:
                    if alt_col in available_columns:
                        product_identifier = safe_str(row.get(alt_col))
                        if product_identifier:
                            break
            
            # Product Name - try mapping first, then fallbacks
            product_name = safe_str(row.get(mapping.get('product_name', '')))
            if not product_name:
                for alt_col in ['ProductName', 'Product Name', 'product_name', 'PRODUCT_NAME',
                                'Product', 'Item Name', 'ItemName', 'item_name', 'ITEM_NAME',
                                'SKU Name', 'sku_name', 'SKU_NAME']:
                    if alt_col in available_columns:
                        product_name = safe_str(row.get(alt_col))
                        if product_name:
                            break
            
            # Impressions - try mapping first, then fallbacks
            impressions = safe_int(row.get(mapping.get('impressions', '')))
            if impressions == 0:
                for alt_col in ['VIEWS', 'Views', 'Impressions', 'impressions', 'IMPRESSIONS', 'Impressions_per_thousand']:
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
                for alt_col in ['Total cost (converted)', 'Total cost', 'COST', 'Ad Spend', 'Spend', 'Spends', 'spend', 'SPEND', 'Cost', 'cost']:
                    if alt_col in available_columns:
                        spend_val = safe_decimal(row.get(alt_col))
                        if spend_val > 0:
                            spend = spend_val
                            break
            
            # Sales - try mapping first, then fallbacks
            sales = safe_decimal(row.get(mapping.get('sales', '')))
            if sales == 0:
                for alt_col in ['Sales (converted)', 'Revenue', 'SALES', 'Total Revenue (Rs.)', 'sales', 'SALES',
                                'Total Revenue', 'Revenue (Rs.)']:
                    if alt_col in available_columns:
                        sales_val = safe_decimal(row.get(alt_col))
                        if sales_val > 0:
                            sales = sales_val
                            break
            
            # ROAS - try mapping first, then fallbacks
            roas = safe_decimal(row.get(mapping.get('roas', '')))
            if roas == 0:
                for alt_col in ['Roas', 'ROAS', 'ROI', 'roas', 'roi', 'Return on Ad Spend']:
                    if alt_col in available_columns:
                        roas_val = safe_decimal(row.get(alt_col))
                        if roas_val > 0:
                            roas = roas_val
                            break
            
            # ACOS - try mapping first, then fallbacks
            acos = safe_decimal(row.get(mapping.get('acos', '')))
            if acos == 0:
                for alt_col in ['ACOS', 'acos', 'Advertising Cost of Sales']:
                    if alt_col in available_columns:
                        acos_val = safe_decimal(row.get(alt_col))
                        if acos_val > 0:
                            acos = acos_val
                            break
            
            # City, orders, campaign_type (fixed or from column), category
            city_val = safe_str(row.get(city_col)) if city_col and city_col in available_columns else None
            orders_val = safe_int(row.get(orders_col)) if orders_col and orders_col in available_columns else None
            if campaign_type_fixed:
                campaign_type_val = campaign_type_fixed
            else:
                campaign_type_col = mapping.get('campaign_type')
                campaign_type_val = safe_str(row.get(campaign_type_col)) if campaign_type_col and campaign_type_col in available_columns else None
            category_val = safe_str(row.get(category_col)) if category_col and category_col in available_columns else None
            
            # Row detail for error messages (Campaign + ASIN/Product ID for tracing)
            _camp = (campaign_name or '').strip() or '—'
            _pid = (product_identifier or '').strip() or '—'
            row_detail = f"Campaign: {_camp}, ASIN/Product ID: {_pid}"
            
            # Allow impressions, clicks, spend, sales to be zero or missing — row is still valid
            raw_data = row.to_dict()
            raw_data = {k: (v.item() if hasattr(v, 'item') else v) for k, v in raw_data.items()}
            raw_data = {k: (None if pd.isna(v) else v) for k, v in raw_data.items()}
            
            cur.execute("""
                INSERT INTO ads_reports (
                    tenant_id, upload_id, channel, report_date, campaign_name,
                    ad_group, product_identifier, product_name, impressions, clicks, spend,
                    sales, roas, acos, city, campaign_type, orders, category, raw_data
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                str(tenant_id), str(upload_id), channel, report_date, campaign_name,
                ad_group, product_identifier, product_name or None, impressions, clicks, spend,
                sales, roas, acos, city_val or None, campaign_type_val or None,
                orders_val if orders_val is not None else None, category_val or None,
                json.dumps(raw_data)
            ))
            processed += 1
            
        except Exception as e:
            failed += 1
            _camp = (campaign_name or '').strip() or '—'
            _pid = (product_identifier or '').strip() or '—'
            errors.append(f"Row {idx + 2} (Campaign: {_camp}, ASIN/Product ID: {_pid}): {str(e)}")
    
    return processed, failed, errors


def _process_traffic_report(cur, tenant_id, upload_id, channel, df, mapping, default_report_date=None):
    """Process traffic report rows (e.g. Amazon Featured Offer Page Views). report_date from Viewing Range (single day)."""
    processed = 0
    failed = 0
    errors = []
    available_columns = [str(c).strip() for c in df.columns]
    report_date = default_report_date or date.today()

    for idx, row in df.iterrows():
        try:
            product_identifier = safe_str(row.get(mapping.get('product_identifier', 'ASIN'))) or safe_str(row.get('ASIN'))
            product_name = safe_str(row.get(mapping.get('product_name', 'Product Title'))) or safe_str(row.get('Product Title'))
            brand = safe_str(row.get(mapping.get('brand', 'Brand'))) or safe_str(row.get('Brand'))
            page_views_val = row.get(mapping.get('page_views', 'Featured Offer Page Views')) or row.get('Featured Offer Page Views')
            if page_views_val is None or (isinstance(page_views_val, float) and pd.isna(page_views_val)):
                page_views_val = 0
            try:
                page_views = int(float(page_views_val))
            except (TypeError, ValueError):
                page_views = 0
            if page_views < 0:
                page_views = 0

            if not product_identifier and not product_name:
                failed += 1
                errors.append(f"Row {idx + 2}: Skipped - no product identifier or name")
                continue

            raw_data = row.to_dict()
            raw_data = {k: (v.item() if hasattr(v, 'item') else v) for k, v in raw_data.items()}
            raw_data = {k: (None if pd.isna(v) else v) for k, v in raw_data.items()}

            cur.execute("SAVEPOINT sp_traffic_row")
            try:
                cur.execute("""
                    INSERT INTO traffic_reports (
                        tenant_id, upload_id, channel, report_date, product_identifier,
                        product_name, brand, page_views, raw_data
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    str(tenant_id), str(upload_id), channel, report_date, product_identifier or None,
                    product_name or None, brand or None, page_views, json.dumps(raw_data)
                ))
                cur.execute("RELEASE SAVEPOINT sp_traffic_row")
                processed += 1
            except Exception as row_err:
                cur.execute("ROLLBACK TO SAVEPOINT sp_traffic_row")
                failed += 1
                _pid = (product_identifier or product_name or '').strip() or '—'
                errors.append(f"Row {idx + 2} (ASIN/Product: {_pid}): {str(row_err)}")
        except Exception as e:
            failed += 1
            _pid = (safe_str(row.get('ASIN')) or safe_str(row.get('Product Title')) or '').strip() or '—'
            errors.append(f"Row {idx + 2} (ASIN/Product: {_pid}): {str(e)}")

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
                'total_records': int(result['total_orders'] or 0),  # Same as total_orders for pagination
            }
        return {
            'total_revenue': 0,
            'total_units': 0,
            'total_orders': 0,
            'total_products': 0,
            'total_records': 0,
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
                COUNT(DISTINCT location) as total_locations,
                COUNT(*) as total_records
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
                'total_records': int(result['total_records'] or 0),
            }
        return {
            'total_inventory': 0,
            'total_products': 0,
            'total_locations': 0,
            'total_records': 0,
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
                COUNT(DISTINCT location) as total_locations,
                COUNT(*) as total_records
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
                'total_records': int(result['total_records'] or 0),
            }
        return {
            'total_pos': 0,
            'pending_pos': 0,
            'total_value': 0,
            'total_locations': 0,
            'total_records': 0,
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
                product_name,
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
                'product_name': row.get('product_name') or '',
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


# ============================================================================
# MAIN DASHBOARD (Weekly Report aggregated view)
# ============================================================================

def _run_main_dashboard_queries(cur, params, channel_filter, date_filter, use_extended_schema: bool,
                                batch_filter: str = "", batch_params: list = None):
    """Run main dashboard queries. batch_filter restricts to uploads with a given batch_tag."""
    batch_params = batch_params or []
    qparams = params + batch_params
    # ADS block: spend + sales always; orders only if extended schema
    if use_extended_schema:
        cur.execute(f"""
            SELECT COALESCE(SUM(spend), 0) as ad_spend, COALESCE(SUM(orders), 0) as ad_order,
                   COALESCE(SUM(sales), 0) as ads_order_value
            FROM ads_reports WHERE tenant_id = %s {channel_filter} {date_filter} {batch_filter}
        """, qparams)
    else:
        cur.execute(f"""
            SELECT COALESCE(SUM(spend), 0) as ad_spend, 0 as ad_order,
                   COALESCE(SUM(sales), 0) as ads_order_value
            FROM ads_reports WHERE tenant_id = %s {channel_filter} {date_filter} {batch_filter}
        """, qparams)
    ads_row = cur.fetchone()
    ad_spend = float(ads_row['ad_spend']) if ads_row else 0
    ad_order = int(ads_row['ad_order']) if ads_row and ads_row.get('ad_order') is not None else 0
    ads_order_value = float(ads_row['ads_order_value']) if ads_row else 0
    roas_ads = (ads_order_value / ad_spend) if ad_spend else 0
    aov_ads = (ads_order_value / ad_order) if ad_order else 0
    cps_ads = (ad_spend / ad_order) if ad_order else 0

    cur.execute(f"""
        SELECT COALESCE(SUM(total_amount), 0) as total_sale_value, COALESCE(SUM(quantity), 0) as total_units
        FROM sales_reports WHERE tenant_id = %s {channel_filter} {date_filter} {batch_filter}
    """, qparams)
    sales_row = cur.fetchone()
    total_sale_value = float(sales_row['total_sale_value']) if sales_row else 0
    total_units = float(sales_row['total_units']) if sales_row else 0
    # Match Excel MAIN-1: Total Order = total units from sales (TOTAL-CITY-WISE SALE)
    total_order_display = int(round(total_units)) if total_units else 0
    organic_order = max(0, total_order_display - ad_order)
    organic_sale_value = max(0, total_sale_value - ads_order_value)
    aov_total = (total_sale_value / total_units) if total_units else 0
    cps_total = (ad_spend / total_units) if total_units else 0
    roi_total = (total_sale_value / ad_spend) if ad_spend else 0

    campaign_type_breakdown = []
    if use_extended_schema:
        cur.execute(f"""
            SELECT COALESCE(campaign_type, 'Other') as campaign_type, COALESCE(SUM(spend), 0) as spend,
                   COALESCE(SUM(orders), 0) as orders, COALESCE(SUM(sales), 0) as sales
            FROM ads_reports WHERE tenant_id = %s {channel_filter} {date_filter} {batch_filter}
            GROUP BY campaign_type
        """, qparams)
        for r in cur.fetchall():
            ct = r.get('campaign_type') or 'Other'
            sp = float(r['spend']) if r.get('spend') else 0
            ords = int(r['orders']) if r.get('orders') else 0
            sal = float(r['sales']) if r.get('sales') else 0
            campaign_type_breakdown.append({
                'campaign_type': ct, 'ad_spend': sp, 'ad_order': ords, 'ads_order_value': sal,
                'roas': (sal / sp) if sp else 0, 'avg_order_value': (sal / ords) if ords else 0,
                'cps': (sp / ords) if ords else 0,
            })

    if use_extended_schema:
        cur.execute(f"""
            SELECT product_identifier, product_name, COALESCE(MAX(sku_category), '') as sku_category,
                   COALESCE(MAX(sku_sub_category), '') as sku_sub_category,
                   SUM(quantity) as quantity_sold, SUM(total_amount) as gmv
            FROM sales_reports WHERE tenant_id = %s {channel_filter} {date_filter} {batch_filter}
              AND (product_identifier IS NOT NULL OR product_name IS NOT NULL)
            GROUP BY product_identifier, product_name ORDER BY gmv DESC NULLS LAST LIMIT 200
        """, qparams)
    else:
        cur.execute(f"""
            SELECT product_identifier, product_name, SUM(quantity) as quantity_sold, SUM(total_amount) as gmv
            FROM sales_reports WHERE tenant_id = %s {channel_filter} {date_filter} {batch_filter}
              AND (product_identifier IS NOT NULL OR product_name IS NOT NULL)
            GROUP BY product_identifier, product_name ORDER BY gmv DESC NULLS LAST LIMIT 200
        """, qparams)
    product_rows = cur.fetchall()

    # View to Order: from ads_reports (impressions/orders per product)
    view_to_order_by_product = {}
    try:
        cur.execute(f"""
            SELECT product_identifier, COALESCE(SUM(impressions), 0) as impressions, COALESCE(SUM(orders), 0) as orders
            FROM ads_reports WHERE tenant_id = %s {channel_filter} {date_filter} {batch_filter}
              AND product_identifier IS NOT NULL AND product_identifier != ''
            GROUP BY product_identifier
        """, qparams)
        for row in cur.fetchall():
            imp = float(row['impressions'] or 0)
            ords = float(row['orders'] or 0)
            key = row['product_identifier']
            view_to_order_by_product[key] = (imp / ords) if ords and ords > 0 else None
    except Exception:
        pass

    product_performance = []
    for r in product_rows:
        gmv = float(r['gmv']) if r.get('gmv') else 0
        contribution = (gmv / total_sale_value * 100) if total_sale_value else 0
        pid = r.get('product_identifier')
        product_performance.append({
            'product_identifier': pid,
            'product_name': (r.get('product_name') or '')[:200],
            'category': r.get('sku_category', '') if use_extended_schema else '',
            'subcategory': r.get('sku_sub_category', '') if use_extended_schema else '',
            'sales_contribution_pct': round(contribution, 2),
            'available_stores': None,
            'gmv': gmv,
            'stock_on_hand': None,
            'quantity_sold': float(r['quantity_sold']) if r.get('quantity_sold') else 0,
            'week_on_week_pct': None,
            'month_on_month_pct': None,
            'view_to_order': view_to_order_by_product.get(pid) if pid else None,
        })

    cur.execute(f"""
        SELECT product_identifier, product_name, city, SUM(quantity) as qty
        FROM sales_reports WHERE tenant_id = %s {channel_filter} {date_filter} {batch_filter}
          AND city IS NOT NULL AND city != ''
        GROUP BY product_identifier, product_name, city
    """, qparams)
    city_rows = cur.fetchall()
    cities = sorted(set(r['city'] for r in city_rows))
    products_city = {}
    for r in city_rows:
        key = (r.get('product_identifier') or '', r.get('product_name') or '')
        if key not in products_city:
            products_city[key] = {'product_identifier': r.get('product_identifier'), 'product_name': (r.get('product_name') or '')[:100]}
        products_city[key][r['city']] = float(r['qty']) if r.get('qty') else 0
    city_wise_sale = {'cities': cities, 'rows': list(products_city.values())}

    return {
        'ads': {'ad_spend': ad_spend, 'ad_order': ad_order, 'ads_order_value': ads_order_value,
                'roas': roas_ads, 'avg_order_value': aov_ads, 'cps': cps_ads},
        'organic': {'organic_order': organic_order, 'organic_sale_value': organic_sale_value},
        'overall': {'total_order': total_order_display, 'total_sale_value': total_sale_value, 'total_units': total_units,
                    'avg_order_value': aov_total, 'roi': roi_total, 'cps': cps_total},
        'campaign_type_breakdown': campaign_type_breakdown,
        'product_performance': product_performance,
        'city_wise_sale': city_wise_sale,
    }


@router.get("/main-dashboard/batch-tags")
async def list_main_dashboard_batch_tags(
    x_tenant_id: str = Header(...),
):
    """List distinct batch_tag values for filtering Main Dashboard by upload batch."""
    tenant_id = get_tenant_id(x_tenant_id)
    try:
        with get_db_cursor(dict_cursor=True) as cur:
            cur.execute("""
                SELECT DISTINCT batch_tag FROM report_uploads
                WHERE tenant_id = %s AND batch_tag IS NOT NULL AND TRIM(batch_tag) != ''
                ORDER BY batch_tag
            """, (str(tenant_id),))
            rows = cur.fetchall()
            out = [str(r['batch_tag']).strip() for r in (rows or []) if r and r.get('batch_tag')]
            return out
    except Exception:
        return []


@router.get("/main-dashboard")
async def get_main_dashboard(
    x_tenant_id: str = Header(...),
    channel: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    batch_tag: Optional[str] = Query(None),
):
    """
    Get aggregated data for the Main Dashboard (MAIN-1).
    Use batch_tag to show only data from uploads with that label (e.g. "Weekly Report Feb 2026").
    """
    tenant_id = get_tenant_id(x_tenant_id)
    params = [str(tenant_id)]
    # Amazon: ads are stored as channel='amazon_ads', others as 'amazon'. Filter by both when user selects Amazon.
    if channel == 'amazon':
        channel_filter = " AND (channel = %s OR channel = 'amazon_ads')"
        params.append(channel)
    elif channel:
        channel_filter = " AND channel = %s"
        params.append(channel)
    else:
        channel_filter = ""
    # When a batch is selected, skip date filter: weekly report ads tabs have no Date column,
    # so report_date is upload date; filtering by period would exclude that data.
    date_filter = ""
    if not batch_tag:
        if start_date:
            date_filter += " AND report_date >= %s"
            params.append(start_date)
        if end_date:
            date_filter += " AND report_date <= %s"
            params.append(end_date)
    batch_filter = ""
    batch_params = []
    if batch_tag:
        batch_filter = " AND upload_id IN (SELECT id FROM report_uploads WHERE tenant_id = %s AND batch_tag = %s)"
        batch_params = [str(tenant_id), batch_tag]

    try:
        with get_db_cursor(dict_cursor=True) as cur:
            try:
                data = _run_main_dashboard_queries(
                    cur, params, channel_filter, date_filter, use_extended_schema=True,
                    batch_filter=batch_filter, batch_params=batch_params
                )
            except Exception as e:
                err_msg = str(e).lower() if e else ""
                if "column" in err_msg and "does not exist" in err_msg:
                    cur.connection.rollback()
                    data = _run_main_dashboard_queries(
                        cur, params, channel_filter, date_filter, use_extended_schema=False,
                        batch_filter=batch_filter, batch_params=batch_params
                    )
                else:
                    raise
    except HTTPException:
        raise
    except Exception as e:
        detail = str(e)
        low = detail.lower()
        if "connection" in low or "could not connect" in low or "connect" in low and "refused" in low:
            detail = "Database connection failed. Check DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD and that PostgreSQL is running."
        elif "does not exist" in low and ("relation" in low or "table" in low):
            detail = "Report tables not found. Run migration: 001_reports_init.sql (and 002_weekly_report_columns.sql for full features)."
        elif "transaction is aborted" in low:
            detail = "Database schema may be outdated. Run migration 002_weekly_report_columns.sql to add required columns (city, campaign_type, orders, category on ads_reports; sku_category, sku_sub_category, brand_name on sales_reports), then retry."
        raise HTTPException(status_code=503, detail=detail)

    return {
        'header': {'channel': channel or 'all', 'start_date': start_date, 'end_date': end_date, 'batch_tag': batch_tag},
        **data,
    }

