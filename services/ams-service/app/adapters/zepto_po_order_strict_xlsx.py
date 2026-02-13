from __future__ import annotations

import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import pandas as pd

from ..core.types import NormalizedPo, NormalizedPoLine


def _excel_col_letters(cell_ref: str) -> str:
    s = ""
    for ch in cell_ref:
        if ch.isalpha():
            s += ch
        else:
            break
    return s


def _parse_dt(v: object) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    try:
        return pd.to_datetime(v).to_pydatetime()  # type: ignore[no-any-return]
    except Exception:
        return None


def _read_shared_strings(ss_xml: bytes) -> list[str]:
    root = ET.fromstring(ss_xml)
    sis = root.findall(".//{*}si")
    out: list[str] = []
    for si in sis:
        texts = [t.text or "" for t in si.findall(".//{*}t")]
        out.append("".join(texts))
    return out


def _cell_value(cell: ET.Element, shared_strings: list[str]) -> Any:
    t = cell.attrib.get("t")
    v = cell.find("{*}v")
    if v is None or v.text is None:
        return None
    if t == "s":
        idx = int(v.text)
        return shared_strings[idx] if idx < len(shared_strings) else None
    return v.text


def parse_zepto_po_order_strict(po_path: Path, vendor_code: str = None) -> list[NormalizedPo]:
    """
    Parses Zepto PO_order.xlsx (OOXML strict) by reading sheet XML.
    Returns list[NormalizedPo], grouped by "PO No.".
    """
    with zipfile.ZipFile(po_path) as z:
        ss_xml = z.read("xl/sharedStrings.xml")
        sheet_xml = z.read("xl/worksheets/sheet1.xml")

    shared = _read_shared_strings(ss_xml)
    sheet_root = ET.fromstring(sheet_xml)
    rows = sheet_root.findall(".//{*}sheetData/{*}row")

    row1 = next((r for r in rows if r.attrib.get("r") == "1"), None)
    if row1 is None:
        raise ValueError("Zepto sheet missing header row (r=1)")

    headers_by_col: dict[str, str] = {}
    for c in row1.findall("{*}c"):
        col = _excel_col_letters(c.attrib.get("r", ""))
        h = _cell_value(c, shared)
        if col and isinstance(h, str):
            headers_by_col[col] = h.strip()

    data_rows: list[dict[str, Any]] = []
    for r in rows:
        rr = r.attrib.get("r")
        if rr is None or rr == "1":
            continue
        row_map: dict[str, Any] = {}
        for c in r.findall("{*}c"):
            col = _excel_col_letters(c.attrib.get("r", ""))
            header = headers_by_col.get(col)
            if not header:
                continue
            row_map[header] = _cell_value(c, shared)
        if row_map:
            data_rows.append(row_map)

    if not data_rows:
        return []

    df = pd.DataFrame(data_rows)
    if "PO No." not in df.columns:
        raise ValueError("Zepto file missing 'PO No.' column")
    df = df[df["PO No."].notna()].copy()

    pos: list[NormalizedPo] = []
    for po_number, g in df.groupby("PO No.", sort=False):
        first = g.iloc[0]
        vendor_code = str(first.get("Vendor Code", "")).strip()
        po_date = _parse_dt(first.get("PO Date"))
        fulfillment_center_code = None
        v = first.get("Del Location") if "Del Location" in g.columns else None
        if v is not None and str(v).strip() and str(v).strip() != "nan":
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
            sku_desc = row.get("SKU Desc")
            line_no = row.get("Line No")
            sku_uuid = row.get("SKU")

            if ean is not None and str(ean).strip() and str(ean).strip() != "nan":
                id_type, id_val = "EAN", str(ean).strip()
            elif sku_code is not None and str(sku_code).strip() and str(sku_code).strip() != "nan":
                # Zepto often provides a SKU Code that is channel-specific and stable even when EAN is missing.
                id_type, id_val = "SKU_CODE", str(sku_code).strip()
            elif sku_uuid is not None and str(sku_uuid).strip() and str(sku_uuid).strip() != "nan":
                id_type, id_val = "SKU", str(sku_uuid).strip()
            elif sku_desc is not None and str(sku_desc).strip() and str(sku_desc).strip() != "nan":
                id_type, id_val = "SKU_DESC", str(sku_desc).strip()
            else:
                id_type, id_val = "UNKNOWN", f"ROW_{idx+1}"

            if line_no is not None and str(line_no).strip() and str(line_no).strip() != "nan":
                ln = str(line_no).strip()
            elif sku_uuid is not None and str(sku_uuid).strip() and str(sku_uuid).strip() != "nan":
                ln = str(sku_uuid).strip()
            else:
                ln = str(idx + 1)

            item_name = (
                str(sku_desc).strip()
                if sku_desc is not None and str(sku_desc).strip() and str(sku_desc).strip() != "nan"
                else None
            )

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


