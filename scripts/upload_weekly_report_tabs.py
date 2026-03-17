#!/usr/bin/env python3
"""
Upload each Main-Dashboard tab from the Weekly Report Excel to the report service.
Creates one batch tag so you can filter the Main Dashboard by this upload.

Usage:
  python scripts/upload_weekly_report_tabs.py [excel_path] [batch_tag]
  python scripts/upload_weekly_report_tabs.py
  python scripts/upload_weekly_report_tabs.py "excelsheet/WEEKLY REPORT _- Nourishyou (1) (1).xlsx" "Nourishyou-Weekly-M"

Requires: report service running (e.g. port 8005), pandas, openpyxl, requests.
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

try:
    import pandas as pd
    import requests
except ImportError as e:
    print("Need: pip install pandas openpyxl requests", file=sys.stderr)
    raise SystemExit(1) from e

# Defaults
DEFAULT_EXCEL = Path(__file__).resolve().parent.parent / "excelsheet" / "WEEKLY REPORT _- Nourishyou (1) (1).xlsx"
DEFAULT_BATCH_TAG = "Nourishyou-Weekly-M"
DEFAULT_BASE_URL = "http://localhost:8005"
DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

# Sheet name -> (channel, report_type, data_type or None)
TAB_CONFIG = [
    ("TOTAL-CITY-WISE SALE", "weekly_report", "sales", None),
    ("AD-CITY LEVEL DATA", "weekly_report", "ads", "ad_city"),
    ("AD-CATEGORY PERFORMANCE", "weekly_report", "ads", "ad_category"),
    ("SP-AD-PRODUCT PERFORMANCE", "weekly_report", "ads", "ad_sp_product"),
    ("SB-AD-PRODUCT PERFORMANCE", "weekly_report", "ads", "ad_sb_product"),
]


def upload_sheet(
    base_url: str,
    tenant_id: str,
    batch_tag: str,
    sheet_name: str,
    channel: str,
    report_type: str,
    data_type: str | None,
    excel_path: Path,
) -> tuple[bool, str]:
    """Read one sheet from the Excel, write to a temp .xlsx, POST to report service."""
    url = f"{base_url.rstrip('/')}/api/v1/reports/upload"
    headers = {"X-Tenant-ID": tenant_id}

    try:
        df = pd.read_excel(excel_path, sheet_name=sheet_name)
    except Exception as e:
        return False, f"read sheet '{sheet_name}': {e}"

    if df.empty:
        return False, f"sheet '{sheet_name}' is empty"

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        df.to_excel(tmp_path, sheet_name=sheet_name, index=False)
        with open(tmp_path, "rb") as f:
            files = {"file": (f"{sheet_name}.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            data = {
                "channel": channel,
                "report_type": report_type,
            }
            if data_type:
                data["data_type"] = data_type
            if batch_tag:
                data["batch_tag"] = batch_tag

        # requests requires file to be opened when building multipart; re-open
        with open(tmp_path, "rb") as f:
            files = {"file": (f"{sheet_name}.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            r = requests.post(url, files=files, data=data, headers=headers, timeout=120)
    finally:
        tmp_path.unlink(missing_ok=True)

    if r.status_code != 200:
        try:
            detail = r.json().get("detail", r.text)
        except Exception:
            detail = r.text
        return False, f"upload '{sheet_name}': HTTP {r.status_code} — {detail}"

    return True, "OK"


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload Weekly Report Excel tabs to report service with a batch tag.")
    parser.add_argument(
        "excel_path",
        nargs="?",
        type=Path,
        default=DEFAULT_EXCEL,
        help=f"Path to Weekly Report Excel (default: {DEFAULT_EXCEL})",
    )
    parser.add_argument(
        "batch_tag",
        nargs="?",
        default=DEFAULT_BATCH_TAG,
        help=f"Batch tag for this upload (default: {DEFAULT_BATCH_TAG}). Use this in Main Dashboard filter.",
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Report service base URL (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--tenant-id",
        default=DEFAULT_TENANT_ID,
        help="Tenant ID header",
    )
    args = parser.parse_args()

    if not args.excel_path.exists():
        print(f"Error: file not found: {args.excel_path}", file=sys.stderr)
        return 1

    print(f"Excel: {args.excel_path}")
    print(f"Batch tag: {args.batch_tag}")
    print(f"Report service: {args.base_url}")
    print()

    ok = 0
    for sheet_name, channel, report_type, data_type in TAB_CONFIG:
        success, msg = upload_sheet(
            args.base_url,
            args.tenant_id,
            args.batch_tag,
            sheet_name,
            channel,
            report_type,
            data_type,
            args.excel_path,
        )
        if success:
            print(f"  OK   {sheet_name}")
            ok += 1
        else:
            print(f"  FAIL {sheet_name} — {msg}")

    print()
    print(f"Done: {ok}/{len(TAB_CONFIG)} tabs uploaded. Batch tag '{args.batch_tag}' — select it on Main Dashboard to view this data.")
    return 0 if ok == len(TAB_CONFIG) else 1


if __name__ == "__main__":
    raise SystemExit(main())
