"""Core data types for AMS"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional


@dataclass(frozen=True)
class NormalizedPoLine:
    line_number: str
    ordered_qty: float
    channel_item_id_type: str
    channel_item_id: str
    item_name: Optional[str] = None
    raw_payload: Optional[dict[str, Any]] = None


@dataclass(frozen=True)
class NormalizedPo:
    vendor_code: str
    channel: str
    po_number: str
    po_date: Optional[datetime]
    fulfillment_center_code: Optional[str]
    lines: list[NormalizedPoLine]


@dataclass(frozen=True)
class ValidationLineResult:
    line_number: str
    vendor_sku_code: Optional[str]
    ordered_qty: float
    available_qty: float
    allocatable_qty: float
    unallocatable_qty: float
    line_status: str
    reason: Optional[str]
    fulfillment_center_code: Optional[str]
    inventory_scope: str
    validated_warehouse_code: str


@dataclass(frozen=True)
class ValidationResult:
    channel: str
    vendor_code: str
    po_number: str
    validated_at: datetime
    po_status: str
    fulfillment_center_code: Optional[str]
    inventory_scope: str
    lines: list[ValidationLineResult]

    def to_csv(self) -> str:
        import csv
        import io

        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(
            [
                "po_number",
                "channel",
                "vendor_code",
                "validated_at",
                "po_status",
                "fulfillment_center_code",
                "inventory_scope",
                "line_number",
                "vendor_sku_code",
                "ordered_qty",
                "available_qty",
                "allocatable_qty",
                "unallocatable_qty",
                "line_status",
                "reason",
                "validated_warehouse_code",
            ]
        )
        for ln in self.lines:
            w.writerow(
                [
                    self.po_number,
                    self.channel,
                    self.vendor_code,
                    self.validated_at.isoformat(),
                    self.po_status,
                    self.fulfillment_center_code or "",
                    ln.inventory_scope,
                    ln.line_number,
                    ln.vendor_sku_code or "",
                    ln.ordered_qty,
                    ln.available_qty,
                    ln.allocatable_qty,
                    ln.unallocatable_qty,
                    ln.line_status,
                    ln.reason or "",
                    ln.validated_warehouse_code,
                ]
            )
        return buf.getvalue()


@dataclass(frozen=True)
class InventoryUploadResult:
    upload_id: int
    status: str  # SUCCESS/FAILED
    total_rows: int
    accepted_rows: int
    rejected_rows: int
    error_report_path: Optional[str]
    message: str


