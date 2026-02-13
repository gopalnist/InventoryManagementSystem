"""PO Cancellation"""
from __future__ import annotations

from .po_validate import release_existing_allocations


def cancel_po(cur, *, po_id: int, vendor_code: str) -> None:
    """
    Cancel a PO and release any reserved inventory for it.

    - Marks purchase_orders.is_cancelled = TRUE, cancelled_at = NOW()
    - Releases purchase_order_allocations (RESERVED -> RELEASED) 
    - Decrements vendor_inventory_current.reserved_qty
    - Marks lines as NONE with reason PO_CANCELLED
    """
    vendor_id = _get_vendor_id(cur, vendor_code)

    # Ensure PO exists for vendor
    cur.execute("SELECT is_cancelled FROM purchase_orders WHERE id=%s AND vendor_id=%s", (po_id, vendor_id))
    r = cur.fetchone()
    if not r:
        raise ValueError("PO not found for this vendor")
    if bool(r[0]):
        # already cancelled: idempotent
        return

    # Release any existing reservations for this PO
    release_existing_allocations(cur, vendor_id=vendor_id, po_id=po_id)

    # Mark PO cancelled
    cur.execute(
        """
        UPDATE purchase_orders
        SET is_cancelled=TRUE,
            cancelled_at=NOW(),
            updated_at=NOW()
        WHERE id=%s AND vendor_id=%s
        """,
        (po_id, vendor_id),
    )

    # Mark lines cancelled
    cur.execute(
        """
        UPDATE purchase_order_lines
        SET line_status='NONE',
            reason='PO_CANCELLED',
            allocatable_qty=0,
            unallocatable_qty=ordered_qty,
            updated_at=NOW()
        WHERE purchase_order_id=%s
        """,
        (po_id,),
    )


def _get_vendor_id(cur, vendor_code: str) -> int:
    cur.execute("SELECT id FROM vendors WHERE vendor_code=%s", (vendor_code,))
    row = cur.fetchone()
    if not row:
        raise ValueError(f"Vendor not found: {vendor_code}")
    return int(row[0])


