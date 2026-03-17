#!/usr/bin/env python3
"""
Upload all Zepto and Amazon report files to the report service.
Run from project root with report service up (e.g. port 8005).

  python scripts/upload_all_reports.py
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("Install: pip install requests", file=sys.stderr)
    sys.exit(1)

BASE_DIR = Path(__file__).resolve().parent.parent
EXCEL = BASE_DIR / "excelsheet"
BASE_URL = "http://localhost:8005"
TENANT_ID = "00000000-0000-0000-0000-000000000001"
HEADERS = {"X-Tenant-ID": TENANT_ID}

# (relative_path, channel, report_type)
UPLOADS = [
    # Zepto
    ("Zepto/Sales/SALES_b30ba49ec77e5b03.csv", "zepto", "sales"),
    ("Zepto/Inventory/INVENTORY_731416fa05186320.csv", "zepto", "inventory"),
    ("Zepto/PO/PO_738334d660d625ba.csv", "zepto", "po"),
    ("Zepto/Ads/Campaign Level Performance.xlsx", "zepto", "ads"),
    ("Zepto/Ads/City_Level Performance.xlsx", "zepto", "ads"),
    ("Zepto/Ads/Product Level Performance.xlsx", "zepto", "ads"),
    ("Zepto/Ads/Category Performance.xlsx", "zepto", "ads"),
    # Amazon
    ("Amazon/Sales/Sales_ASIN_Manufacturing_Retail_India_Custom_13-3-2026_13-3-2026.xlsx", "amazon", "sales"),
    ("Amazon/Inventory/Inventory_ASIN_Manufacturing_Retail_India_Custom_13-3-2026_13-3-2026.xlsx", "amazon", "inventory"),
    ("Amazon/PO/PurchaseOrderItems (29).xlsx", "amazon", "po"),
    ("Amazon/Ads/Campaign_Mar_15_2026.csv", "amazon", "ads"),
]


def main():
    url = f"{BASE_URL.rstrip('/')}/api/v1/reports/upload"
    ok = 0
    fail = 0
    for rel_path, channel, report_type in UPLOADS:
        path = EXCEL / rel_path
        if not path.exists():
            print(f"  SKIP (not found) {rel_path}")
            fail += 1
            continue
        name = path.name
        try:
            with open(path, "rb") as f:
                files = {"file": (name, f, "application/octet-stream")}
                data = {"channel": channel, "report_type": report_type}
                r = requests.post(url, files=files, data=data, headers=HEADERS, timeout=120)
        except Exception as e:
            print(f"  FAIL {rel_path}  {e}")
            fail += 1
            continue
        if r.status_code != 200:
            detail = r.json().get("detail", r.text) if r.headers.get("content-type", "").startswith("application/json") else r.text
            print(f"  FAIL {rel_path}  HTTP {r.status_code}  {detail}")
            fail += 1
        else:
            body = r.json()
            proc = body.get("processed_rows", 0)
            print(f"  OK   {rel_path}  ({proc} rows)")
            ok += 1
    print()
    print(f"Done: {ok} succeeded, {fail} failed.")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
