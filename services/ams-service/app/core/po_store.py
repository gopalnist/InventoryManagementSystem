"""PO Store - Store normalized POs in database"""
from __future__ import annotations

import json
from typing import Any

from .types import NormalizedPo


def store_po(
    cur,
    *,
    vendor_id: int,
    normalized_po: NormalizedPo,
    source_filename: str = None,
) -> int:
    """
    Store a normalized PO in the database.
    Returns the PO ID.
    """
    po = normalized_po
    channel = po.channel
    
    cur.execute(
        """
        INSERT INTO purchase_orders
          (vendor_id, channel, po_number, po_date, fulfillment_center_code, status, source_filename)
        VALUES
          (%s,%s,%s,%s,%s,'RECEIVED',%s)
        ON CONFLICT (vendor_id, channel, po_number)
        DO UPDATE SET
          po_date=EXCLUDED.po_date,
          fulfillment_center_code=EXCLUDED.fulfillment_center_code,
          status='RECEIVED',
          source_filename=EXCLUDED.source_filename,
          updated_at=NOW()
        RETURNING id
        """,
        (
            vendor_id,
            channel,
            po.po_number,
            po.po_date,
            po.fulfillment_center_code,
            source_filename,
        ),
    )
    po_id = int(cur.fetchone()[0])
    
    # Replace lines for idempotency
    cur.execute("DELETE FROM purchase_order_lines WHERE purchase_order_id=%s", (po_id,))
    
    for ln in po.lines:
        ordered_qty = float(ln.ordered_qty)
        id_type = ln.channel_item_id_type
        id_val = str(ln.channel_item_id).strip()
        item_name = ln.item_name
        raw_payload = ln.raw_payload or {}
        
        vendor_sku_id = _ensure_vendor_sku_and_mapping(
            cur,
            vendor_id=vendor_id,
            channel=channel,
            channel_item_id_type=id_type,
            channel_item_id=id_val,
            item_name=item_name,
        )
        
        cur.execute(
            """
            INSERT INTO purchase_order_lines
              (purchase_order_id, line_number, ordered_qty, channel_item_id_type, channel_item_id, vendor_sku_id, item_name, raw_payload)
            VALUES
              (%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                po_id,
                str(ln.line_number),
                ordered_qty,
                id_type,
                id_val,
                vendor_sku_id,
                item_name,
                json.dumps(_json_sanitize(raw_payload)),
            ),
        )
    
    cur.execute("UPDATE purchase_orders SET status='NORMALIZED', updated_at=NOW() WHERE id=%s", (po_id,))
    
    return po_id


def _json_sanitize(d: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in d.items():
        if isinstance(v, (str, int, float, bool)) or v is None:
            out[str(k)] = v
        else:
            out[str(k)] = str(v)
    return out


def _ensure_vendor_sku_and_mapping(
    cur,
    *,
    vendor_id: int,
    channel: str,
    channel_item_id_type: str,
    channel_item_id: str,
    item_name: str | None,
) -> int:
    """
    Ensure SKU and mapping exist for a channel item.
    Returns vendor_sku_id.
    """
    # Check existing mapping
    cur.execute(
        """
        SELECT vendor_sku_id
        FROM channel_item_mappings
        WHERE vendor_id=%s AND channel=%s AND channel_item_id_type=%s AND channel_item_id=%s
        """,
        (vendor_id, channel, channel_item_id_type, channel_item_id),
    )
    existing = cur.fetchone()
    if existing and existing[0]:
        sku_id = int(existing[0])
        if item_name:
            cur.execute("UPDATE vendor_skus SET sku_name=%s, updated_at=NOW() WHERE id=%s", (item_name, sku_id))
        return sku_id
    
    sku_code = f"{channel_item_id_type}-{channel_item_id}".strip()
    
    # vendor_skus
    cur.execute("SELECT id FROM vendor_skus WHERE vendor_id=%s AND sku_code=%s", (vendor_id, sku_code))
    row = cur.fetchone()
    if row:
        sku_id = int(row[0])
        if item_name:
            cur.execute("UPDATE vendor_skus SET sku_name=%s, updated_at=NOW() WHERE id=%s", (item_name, sku_id))
    else:
        cur.execute(
            "INSERT INTO vendor_skus (vendor_id, sku_code, sku_name) VALUES (%s,%s,%s) RETURNING id",
            (vendor_id, sku_code, item_name or sku_code),
        )
        sku_id = int(cur.fetchone()[0])
    
    # channel_item_mappings
    cur.execute(
        """
        INSERT INTO channel_item_mappings
          (vendor_id, channel, channel_item_id_type, channel_item_id, vendor_sku_id)
        VALUES (%s,%s,%s,%s,%s)
        ON CONFLICT (vendor_id, channel, channel_item_id_type, channel_item_id)
        DO UPDATE SET vendor_sku_id=EXCLUDED.vendor_sku_id, updated_at=NOW()
        """,
        (vendor_id, channel, channel_item_id_type, channel_item_id, sku_id),
    )
    
    return sku_id


