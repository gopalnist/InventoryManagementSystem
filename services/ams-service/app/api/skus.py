"""AMS SKUs API"""
from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File
from typing import Optional, List
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
import io
from ..config import get_settings

router = APIRouter(prefix="/skus", tags=["SKUs"])
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


class SKUCreate(BaseModel):
    sku_code: str
    sku_name: Optional[str] = None
    ean: Optional[str] = None
    uom: str = "EACH"
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    cost_price: Optional[float] = None
    hsn_code: Optional[str] = None
    gst_rate: Optional[float] = None


class SKUUpdate(BaseModel):
    sku_name: Optional[str] = None
    ean: Optional[str] = None
    uom: Optional[str] = None
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    cost_price: Optional[float] = None
    hsn_code: Optional[str] = None
    gst_rate: Optional[float] = None
    is_active: Optional[bool] = None


class ChannelMappingCreate(BaseModel):
    channel: str  # amazon, zepto, flipkart
    identifier_type: str  # ASIN, EAN, FSN, MERCHANT_SKU
    identifier_value: str


@router.get("/")
def list_skus(
    tenant_id: str = Depends(get_tenant_id),
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """List all SKUs."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id FROM vendors 
                WHERE tenant_id = %s AND is_active = TRUE LIMIT 1
            """, (tenant_id,))
            vendor = cur.fetchone()
            
            if not vendor:
                return []
            
            query = """
                SELECT 
                    s.*,
                    (SELECT COALESCE(SUM(on_hand_qty), 0) FROM inventory i WHERE i.sku_id = s.id) as total_stock,
                    (SELECT COUNT(*) FROM channel_sku_mappings csm WHERE csm.vendor_sku_id = s.id) as channel_mapping_count
                FROM vendor_skus s
                WHERE s.tenant_id = %s AND s.vendor_id = %s
            """
            params = [tenant_id, vendor['id']]
            
            if search:
                query += " AND (s.sku_code ILIKE %s OR s.sku_name ILIKE %s OR s.ean ILIKE %s)"
                search_term = f"%{search}%"
                params.extend([search_term, search_term, search_term])
            
            query += " ORDER BY s.sku_code LIMIT %s OFFSET %s"
            params.extend([limit, offset])
            
            cur.execute(query, params)
            skus = cur.fetchall()
            
            return [dict(s) for s in skus]
            
    finally:
        conn.close()


@router.post("/")
def create_sku(sku: SKUCreate, tenant_id: str = Depends(get_tenant_id)):
    """Create a new SKU."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id FROM vendors 
                WHERE tenant_id = %s AND is_active = TRUE LIMIT 1
            """, (tenant_id,))
            vendor = cur.fetchone()
            
            if not vendor:
                raise HTTPException(status_code=400, detail="No vendor found")
            
            cur.execute("""
                INSERT INTO vendor_skus 
                (tenant_id, vendor_id, sku_code, sku_name, ean, uom,
                 mrp, selling_price, cost_price, hsn_code, gst_rate)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (
                tenant_id, vendor['id'], sku.sku_code, sku.sku_name,
                sku.ean, sku.uom, sku.mrp, sku.selling_price,
                sku.cost_price, sku.hsn_code, sku.gst_rate
            ))
            
            result = cur.fetchone()
            conn.commit()
            return dict(result)
            
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=400, detail="SKU code already exists")
    finally:
        conn.close()


@router.get("/{sku_id}")
def get_sku(sku_id: int, tenant_id: str = Depends(get_tenant_id)):
    """Get a specific SKU with channel mappings."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM vendor_skus 
                WHERE id = %s AND tenant_id = %s
            """, (sku_id, tenant_id))
            
            sku = cur.fetchone()
            if not sku:
                raise HTTPException(status_code=404, detail="SKU not found")
            
            # Get channel mappings
            cur.execute("""
                SELECT id, channel, identifier_type, identifier_value, created_at
                FROM channel_sku_mappings 
                WHERE vendor_sku_id = %s AND tenant_id = %s
            """, (sku_id, tenant_id))
            
            mappings = cur.fetchall()
            
            result = dict(sku)
            result['channel_mappings'] = [dict(m) for m in mappings]
            
            return result
            
    finally:
        conn.close()


@router.put("/{sku_id}")
def update_sku(
    sku_id: int,
    update: SKUUpdate,
    tenant_id: str = Depends(get_tenant_id)
):
    """Update a SKU."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            updates = []
            params = []
            
            for field in ['sku_name', 'ean', 'uom', 'mrp', 'selling_price', 
                          'cost_price', 'hsn_code', 'gst_rate', 'is_active']:
                value = getattr(update, field, None)
                if value is not None:
                    updates.append(f"{field} = %s")
                    params.append(value)
            
            if not updates:
                raise HTTPException(status_code=400, detail="No updates provided")
            
            updates.append("updated_at = NOW()")
            params.extend([sku_id, tenant_id])
            
            cur.execute(f"""
                UPDATE vendor_skus 
                SET {', '.join(updates)}
                WHERE id = %s AND tenant_id = %s
                RETURNING *
            """, params)
            
            result = cur.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="SKU not found")
            
            conn.commit()
            return dict(result)
            
    finally:
        conn.close()


@router.post("/{sku_id}/mappings")
def add_channel_mapping(
    sku_id: int,
    mapping: ChannelMappingCreate,
    tenant_id: str = Depends(get_tenant_id)
):
    """Add a channel mapping to a SKU."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verify SKU exists
            cur.execute("""
                SELECT id, vendor_id FROM vendor_skus 
                WHERE id = %s AND tenant_id = %s
            """, (sku_id, tenant_id))
            sku = cur.fetchone()
            
            if not sku:
                raise HTTPException(status_code=404, detail="SKU not found")
            
            cur.execute("""
                INSERT INTO channel_sku_mappings 
                (tenant_id, vendor_id, vendor_sku_id, channel, identifier_type, identifier_value)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (
                tenant_id, sku['vendor_id'], sku_id,
                mapping.channel, mapping.identifier_type, mapping.identifier_value
            ))
            
            result = cur.fetchone()
            conn.commit()
            return dict(result)
            
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Mapping already exists")
    finally:
        conn.close()


@router.delete("/{sku_id}/mappings/{mapping_id}")
def delete_channel_mapping(
    sku_id: int,
    mapping_id: int,
    tenant_id: str = Depends(get_tenant_id)
):
    """Delete a channel mapping."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                DELETE FROM channel_sku_mappings 
                WHERE id = %s AND vendor_sku_id = %s AND tenant_id = %s
                RETURNING id
            """, (mapping_id, sku_id, tenant_id))
            
            result = cur.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="Mapping not found")
            
            conn.commit()
            return {"success": True, "deleted_id": mapping_id}
            
    finally:
        conn.close()


@router.post("/upload")
async def upload_skus(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_tenant_id)
):
    """Bulk upload SKUs from CSV/Excel."""
    conn = get_db_connection()
    try:
        content = await file.read()
        filename = file.filename or "skus.csv"
        
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id FROM vendors 
                WHERE tenant_id = %s AND is_active = TRUE LIMIT 1
            """, (tenant_id,))
            vendor = cur.fetchone()
            
            if not vendor:
                raise HTTPException(status_code=400, detail="No vendor found")
            
            vendor_id = vendor['id']
            
            created = 0
            updated = 0
            errors = []
            
            for idx, row in df.iterrows():
                try:
                    sku_code = str(row.get('SKU', row.get('sku_code', row.get('SKU Code', '')))).strip()
                    if not sku_code:
                        continue
                    
                    sku_name = row.get('Name', row.get('sku_name', row.get('Product Name', '')))
                    ean = row.get('EAN', row.get('Barcode', None))
                    mrp = row.get('MRP', row.get('mrp', None))
                    selling_price = row.get('Price', row.get('selling_price', None))
                    
                    cur.execute("""
                        INSERT INTO vendor_skus 
                        (tenant_id, vendor_id, sku_code, sku_name, ean, mrp, selling_price)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (tenant_id, vendor_id, sku_code) 
                        DO UPDATE SET 
                            sku_name = COALESCE(EXCLUDED.sku_name, vendor_skus.sku_name),
                            ean = COALESCE(EXCLUDED.ean, vendor_skus.ean),
                            mrp = COALESCE(EXCLUDED.mrp, vendor_skus.mrp),
                            selling_price = COALESCE(EXCLUDED.selling_price, vendor_skus.selling_price),
                            updated_at = NOW()
                        RETURNING (xmax = 0) as inserted
                    """, (tenant_id, vendor_id, sku_code, sku_name, ean, mrp, selling_price))
                    
                    result = cur.fetchone()
                    if result['inserted']:
                        created += 1
                    else:
                        updated += 1
                        
                except Exception as e:
                    errors.append(f"Row {idx + 1}: {str(e)}")
            
            conn.commit()
            
            return {
                'success': True,
                'filename': filename,
                'total_rows': len(df),
                'created': created,
                'updated': updated,
                'errors': errors[:10]
            }
            
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


