from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import pandas as pd

from ..core.types import NormalizedPo, NormalizedPoLine


def _parse_dt(v: object) -> Optional[datetime]:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, datetime):
        return v
    try:
        # Zepto examples look like: "02 Dec 2025 08:37 pm"
        # dayfirst=True keeps this robust for Indian-style dates.
        dt = pd.to_datetime(v, dayfirst=True, errors="coerce")
        if pd.isna(dt):
            return None
        return dt.to_pydatetime()  # type: ignore[no-any-return]
    except Exception:
        return None


def _is_present(v: object) -> bool:
    if v is None:
        return False
    if isinstance(v, float) and pd.isna(v):
        return False
    s = str(v).strip()
    return bool(s) and s.lower() != "nan"


def parse_zepto_po_csv(po_path: Path, vendor_code: str = None) -> list[NormalizedPo]:
    """
    Parses Zepto PO CSV export (like PO_ZEPTO.csv) -> list[NormalizedPo].
    Groups by "PO No.".
    """
    df = pd.read_csv(po_path)
    if "PO No." not in df.columns:
        raise ValueError("Zepto CSV missing 'PO No.' column")

    df = df[df["PO No."].notna()].copy()
    if df.empty:
        return []

    pos: list[NormalizedPo] = []
    for po_number, g in df.groupby("PO No.", sort=False):
        first = g.iloc[0]

        vendor_code = str(first.get("Vendor Code", "")).strip()
        po_date = _parse_dt(first.get("PO Date"))

        fulfillment_center_code = None
        v = first.get("Del Location") if "Del Location" in g.columns else None
        if _is_present(v):
            fulfillment_center_code = str(v).strip()

        lines: list[NormalizedPoLine] = []
        for idx, row in g.reset_index(drop=True).iterrows():
            qty = row.get("Qty")
            try:
                ordered_qty = float(qty) if qty is not None else 0.0
            except Exception:
                ordered_qty = 0.0

            ean = row.get("EAN")
            sku_code = row.get("SKU Code")
            sku_uuid = row.get("SKU")
            sku_desc = row.get("SKU Desc")
            line_no = row.get("Line No")

            if _is_present(ean):
                id_type, id_val = "EAN", str(ean).strip()
            elif _is_present(sku_code):
                id_type, id_val = "SKU_CODE", str(sku_code).strip()
            elif _is_present(sku_uuid):
                id_type, id_val = "SKU", str(sku_uuid).strip()
            elif _is_present(sku_desc):
                id_type, id_val = "SKU_DESC", str(sku_desc).strip()
            else:
                id_type, id_val = "UNKNOWN", f"ROW_{idx+1}"

            if _is_present(line_no):
                ln = str(line_no).strip()
            elif _is_present(sku_uuid):
                ln = str(sku_uuid).strip()
            else:
                ln = str(idx + 1)

            item_name = str(sku_desc).strip() if _is_present(sku_desc) else None

            raw: dict[str, Any] = {}
            for k, v in row.to_dict().items():
                if isinstance(v, (pd.Timestamp, datetime)):
                    raw[str(k)] = str(v)
                elif v is None or (isinstance(v, float) and pd.isna(v)):
                    raw[str(k)] = None
                else:
                    raw[str(k)] = v  # type: ignore[assignment]

            lines.append(
                NormalizedPoLine(
                    line_number=ln,
                    ordered_qty=ordered_qty,
                    channel_item_id_type=id_type,
                    channel_item_id=id_val,
                    item_name=item_name,
                    raw_payload=raw,
                )
            )

        pos.append(
            NormalizedPo(
                vendor_code=vendor_code,
                channel="zepto",
                po_number=str(po_number).strip(),
                po_date=po_date,
                fulfillment_center_code=fulfillment_center_code,
                lines=lines,
            )
        )

    return pos







