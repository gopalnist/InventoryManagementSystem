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
        return pd.to_datetime(v).to_pydatetime()  # type: ignore[no-any-return]
    except Exception:
        return None


def parse_amazon_vendor_download(po_path: Path, vendor_code: str = None) -> list[NormalizedPo]:
    """
    Parses VendorDownload.xlsx (Amazon) -> list of NormalizedPo.
    The file can contain multiple POs/Orders; we group by Order/PO Number.
    """
    preview = pd.read_excel(po_path, sheet_name="Line Items", header=None, nrows=50)
    header_row_idx = None
    for i in range(len(preview)):
        row = preview.iloc[i].astype(str).tolist()
        if any(c.strip() == "Order/PO Number" for c in row):
            header_row_idx = i
            break
    if header_row_idx is None:
        raise ValueError("Could not find header row (Order/PO Number) in Amazon file")

    df = pd.read_excel(po_path, sheet_name="Line Items", header=header_row_idx)
    df = df[df["Order/PO Number"].notna()].copy()

    pos: list[NormalizedPo] = []
    for po_number, g in df.groupby("Order/PO Number", sort=False):
        first = g.iloc[0]
        vendor_code = str(first.get("Vendor code", "")).strip()
        po_date = _parse_dt(first.get("Order date"))

        fulfillment_center_code = None
        v = first.get("Fulfillment Center") if "Fulfillment Center" in g.columns else None
        if v is not None and not (isinstance(v, float) and pd.isna(v)):
            fulfillment_center_code = str(v).strip() or None

        lines: list[NormalizedPoLine] = []
        for idx, row in g.reset_index(drop=True).iterrows():
            ordered = row.get("Quantity Ordered")
            try:
                ordered_qty = float(ordered) if ordered is not None else 0.0
            except Exception:
                ordered_qty = 0.0

            asin = row.get("ASIN")
            merch = row.get("Merchant SKU")
            model = row.get("Model number")
            ext = row.get("External ID")

            if asin is not None and not (isinstance(asin, float) and pd.isna(asin)) and str(asin).strip():
                id_type, id_val = "ASIN", str(asin).strip()
            elif merch is not None and not (isinstance(merch, float) and pd.isna(merch)) and str(merch).strip():
                id_type, id_val = "MERCHANT_SKU", str(merch).strip()
            elif model is not None and not (isinstance(model, float) and pd.isna(model)) and str(model).strip():
                id_type, id_val = "MODEL_NUMBER", str(model).strip()
            elif ext is not None and not (isinstance(ext, float) and pd.isna(ext)) and str(ext).strip():
                id_type, id_val = "EXTERNAL_ID", str(ext).strip()
            else:
                id_type, id_val = "UNKNOWN", f"ROW_{idx+1}"

            title = row.get("Title") if "Title" in g.columns else None
            item_name = None
            if title is not None and not (isinstance(title, float) and pd.isna(title)):
                item_name = str(title).strip() or None

            raw: dict[str, Any] = {}
            # Capture full row as JSON-serializable dict
            for k, v in row.to_dict().items():
                if isinstance(v, (pd.Timestamp, datetime)):
                    raw[str(k)] = str(v)
                elif v is None or (isinstance(v, float) and pd.isna(v)):
                    raw[str(k)] = None
                else:
                    raw[str(k)] = v  # type: ignore[assignment]

            lines.append(
                NormalizedPoLine(
                    line_number=str(idx + 1),
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
                channel="amazon",
                po_number=str(po_number).strip(),
                po_date=po_date,
                fulfillment_center_code=fulfillment_center_code,
                lines=lines,
            )
        )

    return pos


