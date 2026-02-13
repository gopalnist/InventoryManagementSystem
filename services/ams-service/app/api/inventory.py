"""AMS Inventory API"""
from fastapi import APIRouter, Depends, Header, UploadFile, File, HTTPException
from typing import Optional, List
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
import io
from ..config import get_settings

router = APIRouter(prefix="/inventory", tags=["Inventory"])
settings = get_settings()

DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"


def get_db_connection():
    return psycopg2.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        dbname=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD
    )


def get_tenant_id(x_tenant_id: Optional[str] = Header(None)) -> str:
    return x_tenant_id or DEFAULT_TENANT_ID


class InventoryItem(BaseModel):
    id: int
    warehouse_id: int
    warehouse_name: str
    sku_id: int
    sku_code: str
    sku_name: Optional[str]
    on_hand_qty: float
    reserved_qty: float
    available_qty: float


class InventoryUpdate(BaseModel):
    warehouse_id: int
    sku_id: int
    on_hand_qty: float


@router.get("/")
def list_inventory(
    tenant_id: str = Depends(get_tenant_id),
    warehouse_id: Optional[int] = None,
    sku_code: Optional[str] = None,
    low_stock: bool = False,
    limit: int = 100,
    offset: int = 0
):
    """List inventory with optional filters."""
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
            
            query = """
                SELECT 
                    i.id,
                    i.warehouse_id,
                    w.warehouse_name,
                    w.warehouse_code,
                    i.sku_id,
                    s.sku_code,
                    s.sku_name,
                    s.ean,
                    i.on_hand_qty,
                    i.reserved_qty,
                    i.available_qty,
                    i.updated_at
                FROM inventory i
                JOIN vendor_warehouses w ON w.id = i.warehouse_id
                JOIN vendor_skus s ON s.id = i.sku_id
                WHERE i.tenant_id = %s AND i.vendor_id = %s
            """
            params = [tenant_id, vendor['id']]
            
            if warehouse_id:
                query += " AND i.warehouse_id = %s"
                params.append(warehouse_id)
            
            if sku_code:
                query += " AND s.sku_code ILIKE %s"
                params.append(f"%{sku_code}%")
            
            if low_stock:
                query += " AND i.available_qty <= 10"
            
            query += " ORDER BY s.sku_code LIMIT %s OFFSET %s"
            params.extend([limit, offset])
            
            cur.execute(query, params)
            items = cur.fetchall()
            
            return [dict(i) for i in items]
            
    finally:
        conn.close()


@router.get("/summary")
def get_inventory_summary(tenant_id: str = Depends(get_tenant_id)):
    """Get inventory summary statistics."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id FROM vendors 
                WHERE tenant_id = %s AND is_active = TRUE LIMIT 1
            """, (tenant_id,))
            vendor = cur.fetchone()
            
            if not vendor:
                return {
                    "total_skus_in_stock": 0,
                    "total_on_hand": 0,
                    "total_reserved": 0,
                    "total_available": 0,
                    "low_stock_count": 0
                }
            
            cur.execute("""
                SELECT 
                    COUNT(DISTINCT sku_id) as total_skus_in_stock,
                    COALESCE(SUM(on_hand_qty), 0) as total_on_hand,
                    COALESCE(SUM(reserved_qty), 0) as total_reserved,
                    COALESCE(SUM(available_qty), 0) as total_available,
                    COUNT(*) FILTER (WHERE available_qty <= 10 AND on_hand_qty > 0) as low_stock_count
                FROM inventory
                WHERE tenant_id = %s AND vendor_id = %s
            """, (tenant_id, vendor['id']))
            
            result = cur.fetchone()
            return dict(result)
            
    finally:
        conn.close()


@router.post("/upload")
async def upload_inventory(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_tenant_id)
):
    """Upload inventory CSV/Excel file."""
    conn = get_db_connection()
    try:
        content = await file.read()
        filename = file.filename or "unknown.csv"
        
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get vendor
            cur.execute("""
                SELECT id FROM vendors 
                WHERE tenant_id = %s AND is_active = TRUE LIMIT 1
            """, (tenant_id,))
            vendor = cur.fetchone()
            
            if not vendor:
                raise HTTPException(status_code=400, detail="No vendor found")
            
            vendor_id = vendor['id']
            
            # Create upload record
            cur.execute("""
                INSERT INTO inventory_uploads 
                (tenant_id, vendor_id, filename, status, total_rows)
                VALUES (%s, %s, %s, 'PROCESSING', %s)
                RETURNING id
            """, (tenant_id, vendor_id, filename, len(df)))
            upload_id = cur.fetchone()['id']
            
            # Process rows
            processed = 0
            errors = 0
            error_messages = []
            
            for idx, row in df.iterrows():
                try:
                    # Find SKU by code or EAN
                    sku_code = str(row.get('SKU', row.get('sku_code', row.get('SKU Code', '')))).strip()
                    ean = str(row.get('EAN', row.get('Barcode', ''))).strip() if 'EAN' in df.columns or 'Barcode' in df.columns else None
                    
                    warehouse_code = str(row.get('Warehouse', row.get('warehouse_code', row.get('Warehouse Code', 'DEFAULT')))).strip()
                    
                    qty = 0
                    for col in ['Quantity', 'Qty', 'On Hand', 'Stock', 'on_hand_qty']:
                        if col in df.columns and pd.notna(row.get(col)):
                            try:
                                qty = float(row[col])
                            except:
                                pass
                            break
                    
                    # Find or create warehouse
                    cur.execute("""
                        SELECT id FROM vendor_warehouses 
                        WHERE tenant_id = %s AND vendor_id = %s AND warehouse_code = %s
                    """, (tenant_id, vendor_id, warehouse_code))
                    wh = cur.fetchone()
                    
                    if not wh:
                        cur.execute("""
                            INSERT INTO vendor_warehouses 
                            (tenant_id, vendor_id, warehouse_code, warehouse_name)
                            VALUES (%s, %s, %s, %s)
                            RETURNING id
                        """, (tenant_id, vendor_id, warehouse_code, warehouse_code))
                        wh = cur.fetchone()
                    
                    warehouse_id = wh['id']
                    
                    # Find SKU
                    sku = None
                    if sku_code:
                        cur.execute("""
                            SELECT id FROM vendor_skus 
                            WHERE tenant_id = %s AND vendor_id = %s AND sku_code = %s
                        """, (tenant_id, vendor_id, sku_code))
                        sku = cur.fetchone()
                    
                    if not sku and ean:
                        cur.execute("""
                            SELECT id FROM vendor_skus 
                            WHERE tenant_id = %s AND vendor_id = %s AND ean = %s
                        """, (tenant_id, vendor_id, ean))
                        sku = cur.fetchone()
                    
                    if not sku:
                        # Create SKU if it doesn't exist
                        sku_name = str(row.get('Name', row.get('Product', row.get('Item', sku_code)))).strip()
                        cur.execute("""
                            INSERT INTO vendor_skus 
                            (tenant_id, vendor_id, sku_code, sku_name, ean)
                            VALUES (%s, %s, %s, %s, %s)
                            ON CONFLICT (tenant_id, vendor_id, sku_code) DO UPDATE 
                            SET ean = EXCLUDED.ean
                            RETURNING id
                        """, (tenant_id, vendor_id, sku_code or f"SKU-{idx}", sku_name, ean))
                        sku = cur.fetchone()
                    
                    sku_id = sku['id']
                    
                    # Upsert inventory
                    cur.execute("""
                        INSERT INTO inventory 
                        (tenant_id, vendor_id, warehouse_id, sku_id, on_hand_qty)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (tenant_id, warehouse_id, sku_id) 
                        DO UPDATE SET on_hand_qty = EXCLUDED.on_hand_qty, updated_at = NOW()
                    """, (tenant_id, vendor_id, warehouse_id, sku_id, qty))
                    
                    # Log transaction
                    cur.execute("""
                        INSERT INTO inventory_transactions 
                        (tenant_id, vendor_id, warehouse_id, sku_id, tx_type, 
                         qty_change, qty_type, reference_type, reference_id)
                        VALUES (%s, %s, %s, %s, 'UPLOAD', %s, 'ON_HAND', 
                                'INVENTORY_UPLOAD', %s)
                    """, (tenant_id, vendor_id, warehouse_id, sku_id, qty, upload_id))
                    
                    processed += 1
                    
                except Exception as e:
                    errors += 1
                    error_messages.append(f"Row {idx + 1}: {str(e)}")
            
            # Update upload record
            status = 'SUCCESS' if errors == 0 else 'FAILED' if processed == 0 else 'SUCCESS'
            cur.execute("""
                UPDATE inventory_uploads 
                SET status = %s, processed_rows = %s, error_rows = %s, 
                    error_report = %s, completed_at = NOW()
                WHERE id = %s
            """, (status, processed, errors, '\n'.join(error_messages) if error_messages else None, upload_id))
            
            conn.commit()
            
            return {
                'success': True,
                'upload_id': upload_id,
                'filename': filename,
                'total_rows': len(df),
                'processed': processed,
                'errors': errors,
                'error_messages': error_messages[:10]  # First 10 errors
            }
            
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.put("/{inventory_id}")
def update_inventory_item(
    inventory_id: int,
    update: InventoryUpdate,
    tenant_id: str = Depends(get_tenant_id)
):
    """Update inventory quantity."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                UPDATE inventory 
                SET on_hand_qty = %s, updated_at = NOW()
                WHERE id = %s AND tenant_id = %s
                RETURNING *
            """, (update.on_hand_qty, inventory_id, tenant_id))
            
            result = cur.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="Inventory item not found")
            
            conn.commit()
            return dict(result)
            
    finally:
        conn.close()
