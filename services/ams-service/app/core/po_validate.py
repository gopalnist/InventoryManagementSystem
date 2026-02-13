"""PO Validation and Inventory Reservation"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .types import ValidationLineResult, ValidationResult


def validate_and_reserve_po(cur, *, po_id: int, vendor_code: str) -> ValidationResult:
    """
    Validate a stored PO against vendor_inventory_current and ALWAYS reserve.
    Updates purchase_order_lines + allocations + inventory_transactions, and sets purchase_orders.po_status.
    """
    vendor_id = _get_vendor_id(cur, vendor_code)

    # Make validation idempotent: if this PO was validated before (or user retries),
    # release existing reservations for this PO first so we don't double-reserve.
    release_existing_allocations(cur, vendor_id=vendor_id, po_id=po_id)

    cur.execute(
        """
        SELECT id, channel, po_number, fulfillment_center_code, is_cancelled
        FROM purchase_orders
        WHERE id=%s AND vendor_id=%s
        """,
        (po_id, vendor_id),
    )
    po_row = cur.fetchone()
    if not po_row:
        raise ValueError("PO not found for this vendor")

    _, channel, po_number, center_code, is_cancelled = po_row
    if bool(is_cancelled):
        raise ValueError("PO is cancelled")
    channel = str(channel)
    po_number = str(po_number)
    center_code = str(center_code) if center_code else None

    scope, warehouse_ids = _resolve_scope(cur, vendor_id, channel, center_code)

    cur.execute(
        """
        SELECT id, line_number, ordered_qty, vendor_sku_id
        FROM purchase_order_lines
        WHERE purchase_order_id=%s
        ORDER BY line_number
        """,
        (po_id,),
    )
    rows = cur.fetchall()
    if not rows:
        raise ValueError("PO has no lines")

    validated_at = datetime.now(timezone.utc)
    line_results: list[ValidationLineResult] = []
    any_alloc = False
    all_full = True

    for line_id, line_number, ordered_qty, vendor_sku_id in rows:
        ordered = float(ordered_qty)
        if ordered <= 0:
            _update_po_line_validation(
                cur,
                line_id=line_id,
                vendor_sku_id=vendor_sku_id,
                available=0.0,
                alloc=0.0,
                unalloc=ordered,
                status="NONE",
                reason="INVALID_QTY",
                scope=scope,
                wh_code=_wh_code(scope, warehouse_ids),
            )
            line_results.append(
                ValidationLineResult(
                    line_number=str(line_number),
                    vendor_sku_code=_sku_code(cur, vendor_sku_id),
                    ordered_qty=ordered,
                    available_qty=0.0,
                    allocatable_qty=0.0,
                    unallocatable_qty=ordered,
                    line_status="NONE",
                    reason="INVALID_QTY",
                    fulfillment_center_code=center_code,
                    inventory_scope=scope,
                    validated_warehouse_code=_wh_code(scope, warehouse_ids),
                )
            )
            all_full = False
            continue

        if vendor_sku_id is None:
            _update_po_line_validation(
                cur,
                line_id=line_id,
                vendor_sku_id=None,
                available=0.0,
                alloc=0.0,
                unalloc=ordered,
                status="NONE",
                reason="SKU_NOT_FOUND",
                scope=scope,
                wh_code=_wh_code(scope, warehouse_ids),
            )
            line_results.append(
                ValidationLineResult(
                    line_number=str(line_number),
                    vendor_sku_code=None,
                    ordered_qty=ordered,
                    available_qty=0.0,
                    allocatable_qty=0.0,
                    unallocatable_qty=ordered,
                    line_status="NONE",
                    reason="SKU_NOT_FOUND",
                    fulfillment_center_code=center_code,
                    inventory_scope=scope,
                    validated_warehouse_code=_wh_code(scope, warehouse_ids),
                )
            )
            all_full = False
            continue

        vendor_sku_id_int = int(vendor_sku_id)
        available_total = _available_for_sku(cur, vendor_id, vendor_sku_id_int, warehouse_ids)
        alloc = min(ordered, available_total)
        unalloc = ordered - alloc

        if alloc > 0:
            any_alloc = True
            _reserve_qty(
                cur,
                po_id=po_id,
                line_id=int(line_id),
                vendor_id=vendor_id,
                vendor_sku_id=vendor_sku_id_int,
                warehouse_ids=warehouse_ids,
                qty=alloc,
                line_number=str(line_number),
            )

        if alloc == ordered and ordered > 0:
            status = "FULFILLED"
            reason = None
        elif alloc > 0:
            status = "PARTIAL_FULFILLED"
            reason = "INSUFFICIENT_STOCK"
            all_full = False
        else:
            status = "NONE"
            reason = "INSUFFICIENT_STOCK"
            all_full = False

        _update_po_line_validation(
            cur,
            line_id=int(line_id),
            vendor_sku_id=vendor_sku_id_int,
            available=available_total,
            alloc=alloc,
            unalloc=unalloc,
            status=status,
            reason=reason,
            scope=scope,
            wh_code=_wh_code(scope, warehouse_ids),
        )

        line_results.append(
            ValidationLineResult(
                line_number=str(line_number),
                vendor_sku_code=_sku_code(cur, vendor_sku_id_int),
                ordered_qty=ordered,
                available_qty=available_total,
                allocatable_qty=alloc,
                unallocatable_qty=unalloc,
                line_status=status,
                reason=reason,
                fulfillment_center_code=center_code,
                inventory_scope=scope,
                validated_warehouse_code=_wh_code(scope, warehouse_ids),
            )
        )

    if all_full:
        po_status = "FULFILLED"
    elif any_alloc:
        po_status = "PARTIAL_FULFILLED"
    else:
        po_status = "NONE"

    cur.execute(
        """
        UPDATE purchase_orders
        SET status='VALIDATED', po_status=%s, validated_at=NOW(), updated_at=NOW()
        WHERE id=%s
        """,
        (po_status, po_id),
    )

    return ValidationResult(
        channel=channel,
        vendor_code=vendor_code,
        po_number=po_number,
        validated_at=validated_at,
        po_status=po_status,
        fulfillment_center_code=center_code,
        inventory_scope=scope,
        lines=line_results,
    )


def save_validation_report(cur, *, po_id: int, vendor_code: str, report_csv: str) -> str:
    """Saves validation report to disk and stores path on purchase_orders."""
    out_dir = Path(__file__).resolve().parent.parent.parent / "uploads" / "po_reports"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"po_{po_id}_validation.csv"
    path.write_text(report_csv, encoding="utf-8")

    vendor_id = _get_vendor_id(cur, vendor_code)
    cur.execute(
        """
        UPDATE purchase_orders
        SET validation_report_path=%s, validation_report_format='CSV', updated_at=NOW()
        WHERE id=%s AND vendor_id=%s
        """,
        (str(path.resolve()), po_id, vendor_id),
    )
    return str(path.resolve())


def release_existing_allocations(cur, *, vendor_id: int, po_id: int) -> None:
    """Release any existing RESERVED allocations for a PO."""
    cur.execute(
        """
        SELECT a.id, a.vendor_warehouse_id, a.vendor_sku_id, a.allocated_qty, a.purchase_order_line_id
        FROM purchase_order_allocations a
        JOIN purchase_order_lines l ON l.id = a.purchase_order_line_id
        WHERE l.purchase_order_id=%s
          AND a.vendor_id=%s
          AND a.allocation_status='RESERVED'
        """,
        (po_id, vendor_id),
    )
    allocs = cur.fetchall()
    if not allocs:
        return

    for alloc_id, wh_id, sku_id, qty, line_id in allocs:
        delta = float(qty or 0.0)
        if delta <= 0:
            continue

        cur.execute(
            """
            SELECT id, on_hand_qty, reserved_qty
            FROM vendor_inventory_current
            WHERE vendor_id=%s AND vendor_warehouse_id=%s AND vendor_sku_id=%s
            FOR UPDATE
            """,
            (vendor_id, int(wh_id), int(sku_id)),
        )
        row = cur.fetchone()
        if row:
            inv_id, on_hand, reserved = int(row[0]), float(row[1]), float(row[2])
            new_reserved = max(0.0, reserved - delta)
            cur.execute(
                """
                UPDATE vendor_inventory_current
                SET reserved_qty=%s,
                    available_qty=GREATEST(0, on_hand_qty - %s),
                    updated_at=NOW()
                WHERE id=%s
                """,
                (new_reserved, new_reserved, inv_id),
            )

        cur.execute(
            "UPDATE purchase_order_allocations SET allocation_status='RELEASED', updated_at=NOW() WHERE id=%s",
            (int(alloc_id),),
        )

        cur.execute(
            """
            INSERT INTO inventory_transactions
              (vendor_id, vendor_warehouse_id, vendor_sku_id, tx_type, qty_delta_on_hand, qty_delta_reserved, reference_type, reference_id, note)
            VALUES (%s,%s,%s,'PO_RELEASE',0,%s,'PURCHASE_ORDER',%s,%s)
            """,
            (vendor_id, int(wh_id), int(sku_id), -delta, po_id, f"PO re-validate release line {line_id}"),
        )


def _get_vendor_id(cur, vendor_code: str) -> int:
    cur.execute("SELECT id FROM vendors WHERE vendor_code=%s", (vendor_code,))
    row = cur.fetchone()
    if not row:
        raise ValueError(f"Vendor not found: {vendor_code}")
    return int(row[0])


def _resolve_scope(cur, vendor_id: int, channel: str, center_code: str | None) -> tuple[str, list[int]]:
    if center_code:
        cur.execute(
            """
            SELECT vendor_warehouse_id
            FROM warehouse_fulfillment_center_mappings
            WHERE vendor_id=%s AND channel=%s AND fulfillment_center_code=%s
            """,
            (vendor_id, channel, center_code),
        )
        rows = cur.fetchall()
        if rows:
            return "NODE_MAPPED", [int(r[0]) for r in rows]

    cur.execute("SELECT id FROM vendor_warehouses WHERE vendor_id=%s AND is_active=TRUE", (vendor_id,))
    return "VENDOR_WIDE", [int(r[0]) for r in cur.fetchall()]


def _available_for_sku(cur, vendor_id: int, vendor_sku_id: int, warehouse_ids: list[int]) -> float:
    if not warehouse_ids:
        return 0.0
    cur.execute(
        """
        SELECT COALESCE(SUM(GREATEST(0, on_hand_qty - reserved_qty)), 0)
        FROM vendor_inventory_current
        WHERE vendor_id=%s AND vendor_sku_id=%s AND vendor_warehouse_id = ANY(%s)
        """,
        (vendor_id, vendor_sku_id, warehouse_ids),
    )
    return float(cur.fetchone()[0] or 0.0)


def _reserve_qty(
    cur,
    *,
    po_id: int,
    line_id: int,
    vendor_id: int,
    vendor_sku_id: int,
    warehouse_ids: list[int],
    qty: float,
    line_number: str,
) -> None:
    remaining = float(qty)
    for wh_id in warehouse_ids:
        if remaining <= 0:
            break

        cur.execute(
            """
            SELECT id, on_hand_qty, reserved_qty
            FROM vendor_inventory_current
            WHERE vendor_id=%s AND vendor_warehouse_id=%s AND vendor_sku_id=%s
            FOR UPDATE
            """,
            (vendor_id, wh_id, vendor_sku_id),
        )
        row = cur.fetchone()
        if not row:
            cur.execute(
                """
                INSERT INTO vendor_inventory_current
                  (vendor_id, vendor_warehouse_id, vendor_sku_id, on_hand_qty, reserved_qty, available_qty, updated_at)
                VALUES (%s,%s,%s,0,0,0,NOW())
                ON CONFLICT DO NOTHING
                """,
                (vendor_id, wh_id, vendor_sku_id),
            )
            cur.execute(
                """
                SELECT id, on_hand_qty, reserved_qty
                FROM vendor_inventory_current
                WHERE vendor_id=%s AND vendor_warehouse_id=%s AND vendor_sku_id=%s
                FOR UPDATE
                """,
                (vendor_id, wh_id, vendor_sku_id),
            )
            row = cur.fetchone()

        inv_id, on_hand, reserved = int(row[0]), float(row[1]), float(row[2])
        available = max(0.0, on_hand - reserved)
        delta = min(remaining, available)
        if delta <= 0:
            continue

        cur.execute(
            """
            UPDATE vendor_inventory_current
            SET reserved_qty = reserved_qty + %s,
                available_qty = GREATEST(0, on_hand_qty - (reserved_qty + %s)),
                updated_at = NOW()
            WHERE id=%s
            """,
            (delta, delta, inv_id),
        )

        cur.execute(
            """
            INSERT INTO purchase_order_allocations
              (purchase_order_line_id, vendor_id, vendor_warehouse_id, vendor_sku_id, allocated_qty, allocation_status)
            VALUES (%s,%s,%s,%s,%s,'RESERVED')
            """,
            (line_id, vendor_id, wh_id, vendor_sku_id, delta),
        )

        cur.execute(
            """
            INSERT INTO inventory_transactions
              (vendor_id, vendor_warehouse_id, vendor_sku_id, tx_type, qty_delta_on_hand, qty_delta_reserved, reference_type, reference_id, note)
            VALUES (%s,%s,%s,'PO_RESERVE',0,%s,'PURCHASE_ORDER',%s,%s)
            """,
            (vendor_id, wh_id, vendor_sku_id, delta, po_id, f"PO reserve line {line_number}"),
        )

        remaining -= delta


def _update_po_line_validation(
    cur,
    *,
    line_id: int,
    vendor_sku_id: int | None,
    available: float,
    alloc: float,
    unalloc: float,
    status: str,
    reason: Optional[str],
    scope: str,
    wh_code: str,
) -> None:
    cur.execute(
        """
        UPDATE purchase_order_lines
        SET vendor_sku_id=%s,
            available_qty=%s,
            allocatable_qty=%s,
            unallocatable_qty=%s,
            line_status=%s,
            reason=%s,
            inventory_scope=%s,
            validated_warehouse_code=%s,
            updated_at=NOW()
        WHERE id=%s
        """,
        (
            vendor_sku_id,
            float(available),
            float(alloc),
            float(unalloc),
            status,
            reason,
            scope,
            wh_code,
            line_id,
        ),
    )


def _sku_code(cur, vendor_sku_id: int | None) -> str | None:
    if vendor_sku_id is None:
        return None
    cur.execute("SELECT sku_code FROM vendor_skus WHERE id=%s", (vendor_sku_id,))
    r = cur.fetchone()
    return str(r[0]) if r else None


def _wh_code(scope: str, warehouse_ids: list[int]) -> str:
    if scope == "NODE_MAPPED":
        return "MULTI" if len(warehouse_ids) > 1 else "MAPPED"
    return "VENDOR_WIDE"


