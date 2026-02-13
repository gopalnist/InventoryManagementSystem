"""AMS Purchase Orders API"""
from fastapi import APIRouter, Depends, Header, UploadFile, File, HTTPException
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
import io
import os
from ..config import get_settings

router = APIRouter(prefix="/purchase-orders", tags=["Purchase Orders"])
settings = get_settings()

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
    return x_tenant_id or DEFAULT_TENANT_ID


class POLineResponse(BaseModel):
    id: int
    line_number: int
    channel_identifier_type: Optional[str]
    channel_identifier_value: Optional[str]
    item_name: Optional[str]
    ordered_qty: float
    unit_price: Optional[float]
    sku_id: Optional[int]
    sku_code: Optional[str]
    available_qty: Optional[float]
    allocated_qty: Optional[float]
    unallocated_qty: Optional[float]
    line_status: Optional[str]
    status_reason: Optional[str]


class POResponse(BaseModel):
    id: int
    channel: str
    po_number: str
    fc_code: Optional[str]
    po_date: Optional[datetime]
    status: str
    fulfillment_status: Optional[str]
    is_cancelled: bool
    source_filename: Optional[str]
    created_at: datetime
    line_count: int = 0


@router.get("/", response_model=List[POResponse])
def list_purchase_orders(
    tenant_id: str = Depends(get_tenant_id),
    status: Optional[str] = None,
    channel: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """List all purchase orders."""
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
            
            # Build query
            query = """
                SELECT 
                    po.id,
                    po.channel,
                    po.po_number,
                    po.fc_code,
                    po.po_date,
                    po.status,
                    po.fulfillment_status,
                    po.is_cancelled,
                    po.source_filename,
                    po.created_at,
                    (SELECT COUNT(*) FROM purchase_order_lines WHERE po_id = po.id) as line_count
                FROM purchase_orders po
                WHERE po.tenant_id = %s AND po.vendor_id = %s AND po.is_cancelled = FALSE
            """
            params = [tenant_id, vendor['id']]
            
            if status:
                query += " AND po.status = %s"
                params.append(status)
            
            if channel:
                query += " AND po.channel = %s"
                params.append(channel)
            
            query += " ORDER BY po.created_at DESC LIMIT %s OFFSET %s"
            params.extend([limit, offset])
            
            cur.execute(query, params)
            orders = cur.fetchall()
            
            return [dict(o) for o in orders]
            
    finally:
        conn.close()


@router.get("/{po_id}")
def get_purchase_order(po_id: int, tenant_id: str = Depends(get_tenant_id)):
    """Get a single purchase order with lines."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get PO header
            cur.execute("""
                SELECT 
                    po.*,
                    v.vendor_name,
                    v.vendor_code
                FROM purchase_orders po
                JOIN vendors v ON v.id = po.vendor_id
                WHERE po.id = %s AND po.tenant_id = %s
            """, (po_id, tenant_id))
            po = cur.fetchone()
            
            if not po:
                raise HTTPException(status_code=404, detail="Purchase order not found")
            
            # Get PO lines
            cur.execute("""
                SELECT 
                    pol.*,
                    vs.sku_name
                FROM purchase_order_lines pol
                LEFT JOIN vendor_skus vs ON vs.id = pol.sku_id
                WHERE pol.po_id = %s
                ORDER BY pol.line_number
            """, (po_id,))
            lines = cur.fetchall()
            
            result = dict(po)
            result['lines'] = [dict(l) for l in lines]
            
            return result
            
    finally:
        conn.close()


@router.post("/upload")
async def upload_purchase_order(
    file: UploadFile = File(...),
    channel: str = "amazon",
    tenant_id: str = Depends(get_tenant_id)
):
    """Upload a PO file (Excel/CSV) and parse it."""
    conn = get_db_connection()
    try:
        # Read file content
        content = await file.read()
        filename = file.filename or "unknown.xlsx"
        
        # Parse based on file type
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
        
        # Get vendor
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id FROM vendors 
                WHERE tenant_id = %s AND is_active = TRUE LIMIT 1
            """, (tenant_id,))
            vendor = cur.fetchone()
            
            if not vendor:
                raise HTTPException(status_code=400, detail="No vendor found for tenant")
            
            vendor_id = vendor['id']
            
            # Parse PO based on channel
            if channel.lower() == 'amazon':
                pos = parse_amazon_po(df)
            elif channel.lower() == 'zepto':
                pos = parse_zepto_po(df)
            else:
                pos = parse_generic_po(df)
            
            # Store POs
            created_pos = []
            for po_data in pos:
                # Check if PO already exists
                cur.execute("""
                    SELECT id FROM purchase_orders 
                    WHERE tenant_id = %s AND vendor_id = %s 
                    AND channel = %s AND po_number = %s
                """, (tenant_id, vendor_id, channel, po_data['po_number']))
                
                existing = cur.fetchone()
                if existing:
                    created_pos.append({
                        'id': existing['id'],
                        'po_number': po_data['po_number'],
                        'status': 'ALREADY_EXISTS'
                    })
                    continue
                
                # Create PO
                cur.execute("""
                    INSERT INTO purchase_orders 
                    (tenant_id, vendor_id, channel, po_number, fc_code, 
                     po_date, status, source_filename)
                    VALUES (%s, %s, %s, %s, %s, %s, 'RECEIVED', %s)
                    RETURNING id
                """, (
                    tenant_id, vendor_id, channel, 
                    po_data['po_number'], po_data.get('fc_code'),
                    po_data.get('po_date'), filename
                ))
                po_id = cur.fetchone()['id']
                
                # Create PO lines
                for idx, line in enumerate(po_data.get('lines', []), 1):
                    # Try to resolve SKU
                    sku_id = None
                    sku_code = None
                    
                    if line.get('asin'):
                        cur.execute("""
                            SELECT vs.id, vs.sku_code 
                            FROM channel_sku_mappings csm
                            JOIN vendor_skus vs ON vs.id = csm.vendor_sku_id
                            WHERE csm.tenant_id = %s AND csm.vendor_id = %s
                            AND csm.channel = %s AND csm.identifier_type = 'ASIN'
                            AND csm.identifier_value = %s
                        """, (tenant_id, vendor_id, channel, line['asin']))
                        sku = cur.fetchone()
                        if sku:
                            sku_id = sku['id']
                            sku_code = sku['sku_code']
                    
                    if not sku_id and line.get('ean'):
                        cur.execute("""
                            SELECT id, sku_code FROM vendor_skus 
                            WHERE tenant_id = %s AND vendor_id = %s AND ean = %s
                        """, (tenant_id, vendor_id, line['ean']))
                        sku = cur.fetchone()
                        if sku:
                            sku_id = sku['id']
                            sku_code = sku['sku_code']
                    
                    cur.execute("""
                        INSERT INTO purchase_order_lines 
                        (tenant_id, po_id, line_number, channel_identifier_type,
                         channel_identifier_value, item_name, ordered_qty, 
                         unit_price, sku_id, sku_code)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        tenant_id, po_id, idx,
                        line.get('identifier_type', 'ASIN'),
                        line.get('asin') or line.get('ean'),
                        line.get('item_name'),
                        line.get('qty', 0),
                        line.get('unit_price'),
                        sku_id, sku_code
                    ))
                
                created_pos.append({
                    'id': po_id,
                    'po_number': po_data['po_number'],
                    'status': 'CREATED',
                    'line_count': len(po_data.get('lines', []))
                })
            
            conn.commit()
            
            return {
                'success': True,
                'filename': filename,
                'channel': channel,
                'purchase_orders': created_pos,
                'total_created': len([p for p in created_pos if p['status'] == 'CREATED'])
            }
            
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


def parse_amazon_po(df: pd.DataFrame) -> list:
    """Parse Amazon Vendor Central PO format."""
    pos = {}
    
    # Common Amazon PO columns
    po_col = None
    for col in ['PO Number', 'Purchase Order', 'PO#', 'Order ID']:
        if col in df.columns:
            po_col = col
            break
    
    if not po_col:
        # Single PO from file - create one PO with all lines
        return [{
            'po_number': f"AMAZON-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            'lines': parse_amazon_lines(df)
        }]
    
    # Group by PO number
    for _, row in df.iterrows():
        po_num = str(row.get(po_col, '')).strip()
        if not po_num:
            continue
            
        if po_num not in pos:
            pos[po_num] = {
                'po_number': po_num,
                'fc_code': row.get('Ship To FC', row.get('Fulfillment Center', '')),
                'lines': []
            }
        
        # Parse line
        line = {
            'asin': row.get('ASIN', row.get('Product ID', '')),
            'ean': row.get('EAN', row.get('External ID', '')),
            'item_name': row.get('Product Title', row.get('Item Name', row.get('Title', ''))),
            'qty': float(row.get('Quantity Requested', row.get('Quantity', row.get('Qty', 0)))),
            'unit_price': row.get('Unit Cost', row.get('Cost', None)),
            'identifier_type': 'ASIN'
        }
        
        if line['qty'] > 0:
            pos[po_num]['lines'].append(line)
    
    return list(pos.values())


def parse_amazon_lines(df: pd.DataFrame) -> list:
    """Parse Amazon PO lines when no PO number column exists."""
    lines = []
    
    for _, row in df.iterrows():
        asin = None
        ean = None
        
        for col in ['ASIN', 'Product ID', 'Amazon ASIN']:
            if col in df.columns and pd.notna(row.get(col)):
                asin = str(row[col]).strip()
                break
        
        for col in ['EAN', 'External ID', 'EAN/UPC']:
            if col in df.columns and pd.notna(row.get(col)):
                ean = str(row[col]).strip()
                break
        
        qty = 0
        for col in ['Quantity Requested', 'Quantity', 'Qty', 'Ordered Qty', 'Order Qty']:
            if col in df.columns and pd.notna(row.get(col)):
                try:
                    qty = float(row[col])
                except:
                    pass
                break
        
        item_name = None
        for col in ['Product Title', 'Item Name', 'Title', 'Product Name']:
            if col in df.columns and pd.notna(row.get(col)):
                item_name = str(row[col]).strip()
                break
        
        if qty > 0:
            lines.append({
                'asin': asin,
                'ean': ean,
                'item_name': item_name,
                'qty': qty,
                'identifier_type': 'ASIN' if asin else 'EAN'
            })
    
    return lines


def parse_zepto_po(df: pd.DataFrame) -> list:
    """Parse Zepto PO format."""
    pos = {}
    
    for _, row in df.iterrows():
        po_num = str(row.get('PO Number', row.get('Order Number', ''))).strip()
        if not po_num:
            continue
        
        if po_num not in pos:
            pos[po_num] = {
                'po_number': po_num,
                'fc_code': row.get('Darkstore', row.get('Store Code', '')),
                'lines': []
            }
        
        line = {
            'ean': str(row.get('EAN', row.get('Barcode', ''))).strip(),
            'item_name': row.get('Product Name', row.get('Item', '')),
            'qty': float(row.get('Quantity', row.get('Qty', 0))),
            'identifier_type': 'EAN'
        }
        
        if line['qty'] > 0:
            pos[po_num]['lines'].append(line)
    
    return list(pos.values())


def parse_generic_po(df: pd.DataFrame) -> list:
    """Generic PO parser - tries to auto-detect columns."""
    lines = []
    
    for _, row in df.iterrows():
        line = {}
        
        # Try to find identifier
        for col in df.columns:
            col_lower = col.lower()
            if 'asin' in col_lower:
                line['asin'] = str(row[col]).strip() if pd.notna(row[col]) else None
                line['identifier_type'] = 'ASIN'
            elif 'ean' in col_lower or 'barcode' in col_lower:
                line['ean'] = str(row[col]).strip() if pd.notna(row[col]) else None
                line['identifier_type'] = 'EAN'
            elif 'qty' in col_lower or 'quantity' in col_lower:
                try:
                    line['qty'] = float(row[col])
                except:
                    pass
            elif 'name' in col_lower or 'title' in col_lower or 'product' in col_lower:
                line['item_name'] = str(row[col]).strip() if pd.notna(row[col]) else None
        
        if line.get('qty', 0) > 0:
            lines.append(line)
    
    return [{
        'po_number': f"PO-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        'lines': lines
    }]


@router.post("/{po_id}/validate")
def validate_purchase_order(po_id: int, tenant_id: str = Depends(get_tenant_id)):
    """Validate a PO against inventory and reserve stock."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get PO
            cur.execute("""
                SELECT * FROM purchase_orders 
                WHERE id = %s AND tenant_id = %s
            """, (po_id, tenant_id))
            po = cur.fetchone()
            
            if not po:
                raise HTTPException(status_code=404, detail="PO not found")
            
            if po['status'] == 'VALIDATED':
                raise HTTPException(status_code=400, detail="PO already validated")
            
            vendor_id = po['vendor_id']
            fc_code = po['fc_code']
            
            # Find warehouse for this FC
            warehouse_id = None
            if fc_code:
                cur.execute("""
                    SELECT warehouse_id FROM warehouse_fc_mappings
                    WHERE tenant_id = %s AND vendor_id = %s 
                    AND channel = %s AND fc_code = %s AND is_active = TRUE
                    ORDER BY priority LIMIT 1
                """, (tenant_id, vendor_id, po['channel'], fc_code))
                mapping = cur.fetchone()
                if mapping:
                    warehouse_id = mapping['warehouse_id']
            
            # If no FC mapping, use first warehouse
            if not warehouse_id:
                cur.execute("""
                    SELECT id FROM vendor_warehouses 
                    WHERE tenant_id = %s AND vendor_id = %s AND is_active = TRUE
                    LIMIT 1
                """, (tenant_id, vendor_id))
                wh = cur.fetchone()
                if wh:
                    warehouse_id = wh['id']
            
            # Get PO lines
            cur.execute("""
                SELECT * FROM purchase_order_lines WHERE po_id = %s
            """, (po_id,))
            lines = cur.fetchall()
            
            # Validate each line
            fulfilled_count = 0
            partial_count = 0
            none_count = 0
            
            for line in lines:
                sku_id = line['sku_id']
                ordered_qty = float(line['ordered_qty'])
                
                if not sku_id:
                    # SKU not mapped
                    cur.execute("""
                        UPDATE purchase_order_lines 
                        SET line_status = 'SKU_NOT_FOUND', 
                            status_reason = 'No SKU mapping found',
                            available_qty = 0, allocated_qty = 0, 
                            unallocated_qty = %s
                        WHERE id = %s
                    """, (ordered_qty, line['id']))
                    none_count += 1
                    continue
                
                # Check inventory
                available = 0
                if warehouse_id:
                    cur.execute("""
                        SELECT COALESCE(available_qty, 0) as available
                        FROM inventory 
                        WHERE tenant_id = %s AND sku_id = %s AND warehouse_id = %s
                    """, (tenant_id, sku_id, warehouse_id))
                    inv = cur.fetchone()
                    if inv:
                        available = float(inv['available'])
                else:
                    # Sum across all warehouses
                    cur.execute("""
                        SELECT COALESCE(SUM(available_qty), 0) as available
                        FROM inventory 
                        WHERE tenant_id = %s AND vendor_id = %s AND sku_id = %s
                    """, (tenant_id, vendor_id, sku_id))
                    inv = cur.fetchone()
                    if inv:
                        available = float(inv['available'])
                
                # Calculate allocation
                allocatable = min(available, ordered_qty)
                unallocatable = ordered_qty - allocatable
                
                if allocatable >= ordered_qty:
                    line_status = 'FULFILLED'
                    fulfilled_count += 1
                elif allocatable > 0:
                    line_status = 'PARTIAL'
                    partial_count += 1
                else:
                    line_status = 'NONE'
                    none_count += 1
                
                # Update line
                cur.execute("""
                    UPDATE purchase_order_lines 
                    SET available_qty = %s, allocated_qty = %s, 
                        unallocated_qty = %s, line_status = %s
                    WHERE id = %s
                """, (available, allocatable, unallocatable, line_status, line['id']))
                
                # Reserve inventory if allocatable
                if allocatable > 0 and warehouse_id:
                    # Update inventory
                    cur.execute("""
                        UPDATE inventory 
                        SET reserved_qty = reserved_qty + %s, updated_at = NOW()
                        WHERE tenant_id = %s AND warehouse_id = %s AND sku_id = %s
                    """, (allocatable, tenant_id, warehouse_id, sku_id))
                    
                    # Create allocation record
                    cur.execute("""
                        INSERT INTO po_allocations 
                        (tenant_id, po_line_id, warehouse_id, sku_id, allocated_qty)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (tenant_id, line['id'], warehouse_id, sku_id, allocatable))
                    
                    # Log transaction
                    cur.execute("""
                        INSERT INTO inventory_transactions 
                        (tenant_id, vendor_id, warehouse_id, sku_id, tx_type, 
                         qty_change, qty_type, reference_type, reference_id)
                        VALUES (%s, %s, %s, %s, 'PO_RESERVE', %s, 'RESERVED', 
                                'PURCHASE_ORDER', %s)
                    """, (tenant_id, vendor_id, warehouse_id, sku_id, allocatable, po_id))
            
            # Determine overall PO status
            total_lines = len(lines)
            if fulfilled_count == total_lines:
                fulfillment_status = 'FULFILLED'
            elif fulfilled_count > 0 or partial_count > 0:
                fulfillment_status = 'PARTIAL'
            else:
                fulfillment_status = 'NONE'
            
            # Update PO to RESERVED status (not VALIDATED)
            cur.execute("""
                UPDATE purchase_orders 
                SET status = 'RESERVED', fulfillment_status = %s, 
                    validated_at = NOW(), updated_at = NOW()
                WHERE id = %s
            """, (fulfillment_status, po_id))
            
            conn.commit()
            
            return {
                'success': True,
                'po_id': po_id,
                'status': 'RESERVED',
                'fulfillment_status': fulfillment_status,
                'summary': {
                    'total_lines': total_lines,
                    'fulfilled': fulfilled_count,
                    'partial': partial_count,
                    'none': none_count
                }
            }
            
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/{po_id}/cancel")
def cancel_purchase_order(
    po_id: int, 
    reason: Optional[str] = None,
    tenant_id: str = Depends(get_tenant_id)
):
    """Cancel a PO and release reserved inventory."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get PO
            cur.execute("""
                SELECT * FROM purchase_orders 
                WHERE id = %s AND tenant_id = %s
            """, (po_id, tenant_id))
            po = cur.fetchone()
            
            if not po:
                raise HTTPException(status_code=404, detail="PO not found")
            
            if po['is_cancelled']:
                raise HTTPException(status_code=400, detail="PO already cancelled")
            
            vendor_id = po['vendor_id']
            
            # Release allocations
            cur.execute("""
                SELECT pa.*, pol.id as line_id
                FROM po_allocations pa
                JOIN purchase_order_lines pol ON pol.id = pa.po_line_id
                WHERE pol.po_id = %s AND pa.status = 'RESERVED'
            """, (po_id,))
            allocations = cur.fetchall()
            
            for alloc in allocations:
                # Release from inventory
                cur.execute("""
                    UPDATE inventory 
                    SET reserved_qty = GREATEST(0, reserved_qty - %s), updated_at = NOW()
                    WHERE tenant_id = %s AND warehouse_id = %s AND sku_id = %s
                """, (alloc['allocated_qty'], tenant_id, alloc['warehouse_id'], alloc['sku_id']))
                
                # Update allocation status
                cur.execute("""
                    UPDATE po_allocations SET status = 'RELEASED', updated_at = NOW()
                    WHERE id = %s
                """, (alloc['id'],))
                
                # Log transaction
                cur.execute("""
                    INSERT INTO inventory_transactions 
                    (tenant_id, vendor_id, warehouse_id, sku_id, tx_type, 
                     qty_change, qty_type, reference_type, reference_id, note)
                    VALUES (%s, %s, %s, %s, 'PO_RELEASE', %s, 'RESERVED', 
                            'PURCHASE_ORDER', %s, %s)
                """, (tenant_id, vendor_id, alloc['warehouse_id'], alloc['sku_id'], 
                      -alloc['allocated_qty'], po_id, reason))
            
            # Mark PO as cancelled
            cur.execute("""
                UPDATE purchase_orders 
                SET is_cancelled = TRUE, cancelled_at = NOW(), 
                    cancel_reason = %s, updated_at = NOW()
                WHERE id = %s
            """, (reason, po_id))
            
            conn.commit()
            
            return {
                'success': True,
                'po_id': po_id,
                'released_allocations': len(allocations)
            }
            
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ============================================================================
# RESERVE & NOTIFY IMS
# ============================================================================

@router.post("/{po_id}/reserve")
def reserve_stock(po_id: int, tenant_id: str = Depends(get_tenant_id)):
    """
    Reserve stock for a PO and notify IMS.
    
    This combines validation + reservation + notification:
    1. Validate inventory availability
    2. Reserve stock in AMS
    3. Notify IMS based on tenant's notification_method (API/EMAIL/MANUAL)
    4. Mark the PO as "RESERVED" or "CONFIRMED" based on IMS response
    """
    # First validate the PO
    validation_result = validate_purchase_order(po_id, tenant_id)
    
    if not validation_result.get('success'):
        return validation_result
    
    # Now notify IMS based on tenant's notification method
    from ..services.notification_service import NotificationService, OrderItem
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get tenant config for notification method
            cur.execute("""
                SELECT notification_method, ims_config FROM tenants WHERE id = %s
            """, (tenant_id,))
            tenant = cur.fetchone()
            
            if not tenant:
                raise HTTPException(status_code=400, detail="Tenant not found")
            
            notification_method = tenant.get('notification_method', 'MANUAL')
            ims_config = tenant.get('ims_config', {})
            
            # Get PO
            cur.execute("""
                SELECT * FROM purchase_orders 
                WHERE id = %s AND tenant_id = %s
            """, (po_id, tenant_id))
            po = cur.fetchone()
            
            if not po:
                raise HTTPException(status_code=404, detail="PO not found")
            
            if po['status'] not in ('RESERVED', 'RECEIVED'):
                if po['status'] == 'CONFIRMED':
                    raise HTTPException(status_code=400, detail="PO already confirmed")
                # Allow re-notification for already reserved POs
            
            # Get PO lines with allocated quantities
            cur.execute("""
                SELECT 
                    pol.*,
                    vs.sku_code as internal_sku,
                    vs.selling_price
                FROM purchase_order_lines pol
                LEFT JOIN vendor_skus vs ON vs.id = pol.sku_id
                WHERE pol.po_id = %s
            """, (po_id,))
            lines = cur.fetchall()
            
            # Build order items for notification
            order_items = []
            for line in lines:
                sku_code = line.get('internal_sku') or line.get('sku_code')
                if sku_code:
                    order_items.append(OrderItem(
                        sku_code=sku_code,
                        quantity=float(line.get('allocated_qty') or 0),
                        unit_price=float(line.get('selling_price') or line.get('unit_price') or 0),
                        line_status=line.get('line_status')
                    ))
            
            # Create notification service and send notification
            notification_svc = NotificationService(
                tenant_id=tenant_id,
                notification_method=notification_method,
                ims_config=ims_config
            )
            
            result = notification_svc.notify_reservation(
                po_number=po['po_number'],
                channel=po['channel'],
                items=order_items,
                fulfillment_status=po.get('fulfillment_status', 'UNKNOWN'),
                fc_code=po.get('fc_code'),
                notes=f"Reserved via AMS"
            )
            
            # Update PO based on notification result
            if result.success:
                if result.method == 'API' and result.ims_order_id:
                    # API success - mark as CONFIRMED
                    cur.execute("""
                        UPDATE purchase_orders SET 
                            status = 'CONFIRMED',
                            notification_method = %s,
                            notification_status = 'CONFIRMED',
                            notification_sent_at = NOW(),
                            confirmed_at = NOW(),
                            ims_order_id = %s,
                            ims_order_number = %s,
                            updated_at = NOW()
                        WHERE id = %s
                    """, (result.method, result.ims_order_id, result.ims_order_number, po_id))
                else:
                    # Email or Manual - mark as RESERVED, waiting for confirmation
                    cur.execute("""
                        UPDATE purchase_orders SET 
                            status = 'RESERVED',
                            notification_method = %s,
                            notification_status = 'SENT',
                            notification_sent_at = NOW(),
                            updated_at = NOW()
                        WHERE id = %s
                    """, (result.method, po_id))
                
                conn.commit()
                
                return {
                    'success': True,
                    'po_id': po_id,
                    'po_number': po['po_number'],
                    'status': 'CONFIRMED' if result.ims_order_id else 'RESERVED',
                    'notification_method': result.method,
                    'ims_order_id': result.ims_order_id,
                    'ims_order_number': result.ims_order_number,
                    'message': result.message,
                    'validation': validation_result
                }
            else:
                # Notification failed - still reserved in AMS
                cur.execute("""
                    UPDATE purchase_orders SET 
                        notification_method = %s,
                        notification_status = 'FAILED',
                        updated_at = NOW()
                    WHERE id = %s
                """, (result.method, po_id))
                conn.commit()
                
                return {
                    'success': False,
                    'po_id': po_id,
                    'status': 'RESERVED',
                    'notification_method': result.method,
                    'message': result.message or 'Notification failed',
                    'validation': validation_result
                }
                
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# Keep legacy endpoint for backwards compatibility
@router.post("/{po_id}/push-to-ims")
def push_to_ims(po_id: int, tenant_id: str = Depends(get_tenant_id)):
    """Legacy endpoint - redirects to reserve_stock."""
    return reserve_stock(po_id, tenant_id)


@router.post("/{po_id}/validate-and-push")
def validate_and_push_to_ims(po_id: int, tenant_id: str = Depends(get_tenant_id)):
    """Legacy endpoint - redirects to reserve_stock which does both."""
    return reserve_stock(po_id, tenant_id)


# ============================================================================
# MANUAL CONFIRMATION
# ============================================================================

@router.post("/{po_id}/confirm")
def confirm_order(
    po_id: int, 
    confirmed_by: Optional[str] = "MANUAL",
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Manually confirm a reserved order.
    Used when notification_method is MANUAL or EMAIL.
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM purchase_orders 
                WHERE id = %s AND tenant_id = %s
            """, (po_id, tenant_id))
            po = cur.fetchone()
            
            if not po:
                raise HTTPException(status_code=404, detail="PO not found")
            
            if po['status'] == 'CONFIRMED':
                raise HTTPException(status_code=400, detail="PO already confirmed")
            
            if po['status'] != 'RESERVED':
                raise HTTPException(
                    status_code=400, 
                    detail=f"PO must be in RESERVED status to confirm. Current: {po['status']}"
                )
            
            cur.execute("""
                UPDATE purchase_orders SET 
                    status = 'CONFIRMED',
                    notification_status = 'CONFIRMED',
                    confirmed_at = NOW(),
                    confirmed_by = %s,
                    updated_at = NOW()
                WHERE id = %s
            """, (confirmed_by, po_id))
            
            conn.commit()
            
            return {
                'success': True,
                'po_id': po_id,
                'po_number': po['po_number'],
                'status': 'CONFIRMED',
                'confirmed_by': confirmed_by,
                'message': 'Order confirmed successfully'
            }
            
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ============================================================================
# WEBHOOK FOR EXTERNAL IMS CONFIRMATION
# ============================================================================

@router.post("/webhook/confirm")
def webhook_confirm_order(
    payload: dict,
    x_tenant_id: Optional[str] = Header(None)
):
    """
    Webhook endpoint for external IMS to confirm orders.
    
    Expected payload:
    {
        "po_number": "AMAZON-123",
        "status": "confirmed" | "rejected",
        "ims_order_id": "optional",
        "message": "optional"
    }
    """
    tenant_id = x_tenant_id or DEFAULT_TENANT_ID
    po_number = payload.get("po_number")
    status = payload.get("status", "confirmed").lower()
    ims_order_id = payload.get("ims_order_id")
    message = payload.get("message", "")
    
    if not po_number:
        raise HTTPException(status_code=400, detail="po_number is required")
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Find PO by number
            cur.execute("""
                SELECT * FROM purchase_orders 
                WHERE po_number = %s AND tenant_id = %s
            """, (po_number, tenant_id))
            po = cur.fetchone()
            
            if not po:
                raise HTTPException(status_code=404, detail=f"PO {po_number} not found")
            
            if status == "confirmed":
                cur.execute("""
                    UPDATE purchase_orders SET 
                        status = 'CONFIRMED',
                        notification_status = 'CONFIRMED',
                        confirmed_at = NOW(),
                        confirmed_by = 'WEBHOOK',
                        ims_order_id = COALESCE(%s, ims_order_id),
                        updated_at = NOW()
                    WHERE id = %s
                """, (ims_order_id, po['id']))
                
                conn.commit()
                
                return {
                    'success': True,
                    'po_id': po['id'],
                    'po_number': po_number,
                    'status': 'CONFIRMED'
                }
            else:
                # Rejected - release reservations
                # (Could call cancel_purchase_order here)
                cur.execute("""
                    UPDATE purchase_orders SET 
                        notification_status = 'FAILED',
                        updated_at = NOW()
                    WHERE id = %s
                """, (po['id'],))
                
                conn.commit()
                
                return {
                    'success': False,
                    'po_id': po['id'],
                    'po_number': po_number,
                    'status': 'REJECTED',
                    'message': message
                }
            
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
