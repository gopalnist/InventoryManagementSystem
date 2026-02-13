"""Inventory Upload Processing"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .types import InventoryUploadResult


def process_inventory_csv(
    cur,
    *,
    vendor_code: str,
    uploaded_by: str,
    source_filename: str,
    csv_bytes: bytes,
    auto_create_vendor: bool = False,
    auto_create_warehouse: bool = True,
    default_warehouse_code: str = "VWH-DEFAULT",
    expected_warehouse_code: Optional[str] = None,
) -> InventoryUploadResult:
    """
    Process an inventory CSV upload and update:
      - inventory_uploads
      - inventory_snapshot_items
      - vendor_inventory_current (on_hand updates; available recomputed)
      - inventory_transactions (UPLOAD_SET_ON_HAND)
    """
    now = datetime.now(timezone.utc)

    vendor_id = _get_or_create_vendor(cur, vendor_code, auto_create_vendor)

    # Create upload record
    cur.execute(
        """
        INSERT INTO inventory_uploads (vendor_id, source_filename, status, uploaded_by, total_rows, accepted_rows, rejected_rows, created_at)
        VALUES (%s,%s,'PROCESSING',%s,0,0,0,NOW())
        RETURNING id
        """,
        (vendor_id, source_filename, uploaded_by),
    )
    upload_id = int(cur.fetchone()[0])

    try:
        text = csv_bytes.decode("utf-8-sig")
    except Exception:
        _mark_upload_failed(cur, upload_id, "Invalid file encoding")
        return InventoryUploadResult(
            upload_id=upload_id,
            status="FAILED",
            total_rows=0,
            accepted_rows=0,
            rejected_rows=0,
            error_report_path=None,
            message="Invalid file encoding. Please upload a UTF-8 CSV.",
        )

    f = io.StringIO(text)
    reader = csv.DictReader(f)
    required_cols = {"vendor_code", "vendor_warehouse_code", "sku_code", "on_hand_qty"}
    
    if reader.fieldnames is None or not required_cols.issubset(set(reader.fieldnames)):
        msg = f"Missing required columns. Required: {sorted(required_cols)}"
        _mark_upload_failed(cur, upload_id, msg)
        return InventoryUploadResult(
            upload_id=upload_id,
            status="FAILED",
            total_rows=0,
            accepted_rows=0,
            rejected_rows=0,
            error_report_path=None,
            message=msg,
        )

    # Aggregate rows by (warehouse_code, sku_code)
    totals: dict[tuple[str, str], float] = {}
    sku_names: dict[str, str] = {}
    errors: list[dict[str, str]] = []
    total_rows = 0

    for row in reader:
        total_rows += 1
        row_vendor = (row.get("vendor_code") or "").strip()
        wh_code = (row.get("vendor_warehouse_code") or "").strip() or default_warehouse_code
        sku_code = (row.get("sku_code") or "").strip()
        sku_name = (row.get("sku_name") or row.get("sku_desc") or "").strip()
        qty_raw = (row.get("on_hand_qty") or "").strip()

        if row_vendor and row_vendor != vendor_code:
            errors.append({**row, "error": f"vendor_code mismatch"})
            continue
        if expected_warehouse_code and wh_code != expected_warehouse_code:
            errors.append({**row, "error": f"warehouse_code mismatch"})
            continue
        if not sku_code:
            errors.append({**row, "error": "missing sku_code"})
            continue
        try:
            qty = float(qty_raw)
        except Exception:
            errors.append({**row, "error": f"invalid on_hand_qty"})
            continue
        if qty < 0:
            errors.append({**row, "error": "on_hand_qty must be >= 0"})
            continue

        totals[(wh_code, sku_code)] = totals.get((wh_code, sku_code), 0.0) + qty
        if sku_name and sku_code not in sku_names:
            sku_names[sku_code] = sku_name

    # Process aggregated rows
    wh_id_by_code: dict[str, int] = {}
    sku_id_by_code: dict[str, int] = {}
    accepted = 0

    for (wh_code, sku_code), qty in totals.items():
        wh_id = _get_or_create_warehouse(cur, vendor_id, wh_code, auto_create_warehouse, wh_id_by_code)
        if wh_id is None:
            errors.append({"sku_code": sku_code, "error": f"unknown warehouse: {wh_code}"})
            continue

        sku_id = _get_or_create_sku(cur, vendor_id, sku_code, sku_names.get(sku_code), sku_id_by_code)

        # Update SKU name if provided
        if sku_code in sku_names:
            cur.execute("UPDATE vendor_skus SET sku_name=%s, updated_at=NOW() WHERE id=%s", (sku_names[sku_code], sku_id))

        # Snapshot item
        cur.execute(
            """
            INSERT INTO inventory_snapshot_items
              (inventory_upload_id, vendor_id, vendor_warehouse_id, vendor_sku_id, on_hand_qty)
            VALUES (%s,%s,%s,%s,%s)
            ON CONFLICT (inventory_upload_id, vendor_warehouse_id, vendor_sku_id)
            DO UPDATE SET on_hand_qty = EXCLUDED.on_hand_qty
            """,
            (upload_id, vendor_id, wh_id, sku_id, qty),
        )

        # Upsert current inventory
        cur.execute(
            """
            INSERT INTO vendor_inventory_current
              (vendor_id, vendor_warehouse_id, vendor_sku_id, on_hand_qty, reserved_qty, available_qty, last_inventory_upload_id, updated_at)
            VALUES (%s,%s,%s,%s,0,%s,%s,NOW())
            ON CONFLICT (vendor_id, vendor_warehouse_id, vendor_sku_id)
            DO UPDATE SET
              on_hand_qty = EXCLUDED.on_hand_qty,
              last_inventory_upload_id = EXCLUDED.last_inventory_upload_id,
              available_qty = GREATEST(0, EXCLUDED.on_hand_qty - vendor_inventory_current.reserved_qty),
              updated_at = NOW()
            """,
            (vendor_id, wh_id, sku_id, qty, qty, upload_id),
        )

        # Audit transaction
        cur.execute(
            """
            INSERT INTO inventory_transactions
              (vendor_id, vendor_warehouse_id, vendor_sku_id, tx_type, qty_delta_on_hand, qty_delta_reserved, reference_type, reference_id, note)
            VALUES (%s,%s,%s,'UPLOAD_SET_ON_HAND',%s,0,'INVENTORY_UPLOAD',%s,%s)
            """,
            (vendor_id, wh_id, sku_id, qty, upload_id, f"Upload: {source_filename}"),
        )

        accepted += 1

    rejected = len(errors)
    error_path = None
    msg = f"Processed {total_rows} rows. Accepted {accepted}. Rejected {rejected}."

    # Save error report
    if errors:
        error_dir = Path(__file__).resolve().parent.parent.parent / "uploads" / "error_reports"
        error_dir.mkdir(parents=True, exist_ok=True)
        error_path = str((error_dir / f"inventory_upload_{upload_id}_errors.csv").resolve())
        _write_error_report(Path(error_path), errors)

    # Mark upload complete
    cur.execute(
        """
        UPDATE inventory_uploads
        SET status='SUCCESS',
            total_rows=%s,
            accepted_rows=%s,
            rejected_rows=%s,
            error_report_path=%s,
            processed_at=NOW()
        WHERE id=%s
        """,
        (total_rows, accepted, rejected, error_path, upload_id),
    )

    return InventoryUploadResult(
        upload_id=upload_id,
        status="SUCCESS",
        total_rows=total_rows,
        accepted_rows=accepted,
        rejected_rows=rejected,
        error_report_path=error_path,
        message=msg,
    )


def _get_or_create_vendor(cur, vendor_code: str, auto_create: bool) -> int:
    cur.execute("SELECT id FROM vendors WHERE vendor_code=%s", (vendor_code,))
    row = cur.fetchone()
    if row:
        return int(row[0])
    if not auto_create:
        raise ValueError(f"Vendor not found: {vendor_code}")
    cur.execute(
        "INSERT INTO vendors (vendor_code, vendor_name) VALUES (%s,%s) RETURNING id",
        (vendor_code, vendor_code),
    )
    return int(cur.fetchone()[0])


def _get_or_create_warehouse(cur, vendor_id: int, code: str, auto_create: bool, cache: dict) -> Optional[int]:
    if code in cache:
        return cache[code]
    cur.execute(
        "SELECT id FROM vendor_warehouses WHERE vendor_id=%s AND vendor_warehouse_code=%s",
        (vendor_id, code),
    )
    r = cur.fetchone()
    if r:
        cache[code] = int(r[0])
        return cache[code]
    if auto_create:
        cur.execute(
            """
            INSERT INTO vendor_warehouses (vendor_id, vendor_warehouse_code, warehouse_name)
            VALUES (%s,%s,%s)
            RETURNING id
            """,
            (vendor_id, code, code),
        )
        cache[code] = int(cur.fetchone()[0])
        return cache[code]
    return None


def _get_or_create_sku(cur, vendor_id: int, code: str, name: Optional[str], cache: dict) -> int:
    if code in cache:
        return cache[code]
    cur.execute("SELECT id FROM vendor_skus WHERE vendor_id=%s AND sku_code=%s", (vendor_id, code))
    r = cur.fetchone()
    if r:
        cache[code] = int(r[0])
        return cache[code]
    cur.execute(
        "INSERT INTO vendor_skus (vendor_id, sku_code, sku_name) VALUES (%s,%s,%s) RETURNING id",
        (vendor_id, code, name or code),
    )
    cache[code] = int(cur.fetchone()[0])
    return cache[code]


def _mark_upload_failed(cur, upload_id: int, message: str) -> None:
    cur.execute(
        "UPDATE inventory_uploads SET status='FAILED', processed_at=NOW() WHERE id=%s",
        (upload_id,),
    )


def _write_error_report(path: Path, rows: list[dict[str, str]]) -> None:
    keys = list(set().union(*[r.keys() for r in rows]))
    if "error" not in keys:
        keys.append("error")
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        for r in rows:
            w.writerow(r)


