"""
Adapter for NY Daily Inventory Update Excel files.

File format:
  - Sheet: "Medchal Plant" (or similar)
  - Column "SKUs": Product names (e.g., "5In1 Super Seed Mix 200G")
  - Date columns: Daily inventory quantities (e.g., 2025-12-01, 2025-12-02, ...)
  - Column "Remarks": Optional notes (e.g., "Low Stock")

Output:
  - Generates inventory CSV rows ready for upload
  - Uses the LATEST date column for on_hand_qty
  - Generates SKU codes from product names
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import pandas as pd

from vms_core.tools.sku_generate import generate_internal_sku_code


# Default warehouse for Medchal Plant
DEFAULT_WAREHOUSE_CODE = "NY-HYD"
DEFAULT_WAREHOUSE_NAME = "Medchal Plant - Hyderabad"


@dataclass(frozen=True)
class NYInventoryRow:
    """A single inventory row extracted from the NY Daily Inventory Update."""
    sku_name: str
    sku_code: str
    on_hand_qty: float
    inventory_date: datetime
    remarks: Optional[str] = None


@dataclass(frozen=True)
class NYInventoryParseResult:
    """Result of parsing an NY Daily Inventory Update file."""
    vendor_code: str
    warehouse_code: str
    warehouse_name: str
    inventory_date: datetime
    rows: list[NYInventoryRow]
    sheet_name: str


def parse_ny_daily_inventory(
    file_path: Path,
    *,
    vendor_code: str = "NY",
    warehouse_code: str = DEFAULT_WAREHOUSE_CODE,
    warehouse_name: str = DEFAULT_WAREHOUSE_NAME,
    use_date: Optional[datetime] = None,
    sheet_name: Optional[str] = None,
) -> NYInventoryParseResult:
    """
    Parse an NY Daily Inventory Update Excel file.

    Args:
        file_path: Path to the Excel file
        vendor_code: Vendor code for SKU generation (default: "NY" for Nourish You)
        warehouse_code: Warehouse code to use (default: "NY-HYD")
        warehouse_name: Warehouse description (default: "Medchal Plant - Hyderabad")
        use_date: Specific date column to use; if None, uses the latest date
        sheet_name: Sheet to read; if None, reads the first sheet

    Returns:
        NYInventoryParseResult with parsed inventory rows
    """
    # Read Excel file
    xlsx = pd.ExcelFile(file_path)
    actual_sheet = sheet_name or xlsx.sheet_names[0]
    df = pd.read_excel(xlsx, sheet_name=actual_sheet)

    # Find the SKUs column (first column or named "SKUs")
    sku_col = None
    for col in df.columns:
        col_str = str(col).strip().upper()
        if col_str in ("SKUS", "SKU", "PRODUCT", "PRODUCT NAME", "ITEM", "ITEM NAME"):
            sku_col = col
            break
    if sku_col is None:
        # Assume first column is SKUs
        sku_col = df.columns[0]

    # Find date columns (columns that are datetime objects)
    date_columns: list[datetime] = []
    for col in df.columns:
        if isinstance(col, datetime):
            date_columns.append(col)
        elif isinstance(col, pd.Timestamp):
            date_columns.append(col.to_pydatetime())

    if not date_columns:
        raise ValueError(
            f"No date columns found in sheet '{actual_sheet}'. "
            "Expected columns with dates like 2025-12-01, 2025-12-02, etc."
        )

    # Sort dates and pick the target date
    date_columns.sort()
    if use_date is not None:
        # Find the closest matching date
        target_date = use_date
        if target_date not in date_columns:
            # Find closest date
            closest = min(date_columns, key=lambda d: abs((d - target_date).total_seconds()))
            target_date = closest
    else:
        # Use the latest date
        target_date = date_columns[-1]

    # Find remarks column if present
    remarks_col = None
    for col in df.columns:
        col_str = str(col).strip().upper()
        if col_str in ("REMARKS", "REMARK", "NOTES", "NOTE", "COMMENT", "COMMENTS"):
            remarks_col = col
            break

    # Parse rows
    rows: list[NYInventoryRow] = []
    used_sku_codes: set[str] = set()

    for idx, row in df.iterrows():
        sku_name_raw = row.get(sku_col)
        if pd.isna(sku_name_raw) or not str(sku_name_raw).strip():
            continue

        sku_name = str(sku_name_raw).strip()

        # Get quantity from target date column
        qty_raw = row.get(target_date)
        if pd.isna(qty_raw):
            qty = 0.0
        else:
            try:
                qty = float(qty_raw)
            except (ValueError, TypeError):
                qty = 0.0

        # Get remarks if available
        remarks = None
        if remarks_col is not None:
            remarks_raw = row.get(remarks_col)
            if not pd.isna(remarks_raw) and str(remarks_raw).strip():
                remarks = str(remarks_raw).strip()

        # Generate SKU code
        base_sku_code = generate_internal_sku_code(
            vendor_code=vendor_code,
            item_name=sku_name,
            include_process_tokens=True,
        )
        # Deduplicate
        sku_code = _dedupe_sku_code(base_sku_code, used_sku_codes)
        used_sku_codes.add(sku_code)

        rows.append(
            NYInventoryRow(
                sku_name=sku_name,
                sku_code=sku_code,
                on_hand_qty=qty,
                inventory_date=target_date,
                remarks=remarks,
            )
        )

    return NYInventoryParseResult(
        vendor_code=vendor_code,
        warehouse_code=warehouse_code,
        warehouse_name=warehouse_name,
        inventory_date=target_date,
        rows=rows,
        sheet_name=actual_sheet,
    )


def _dedupe_sku_code(base: str, used: set[str]) -> str:
    """Ensure SKU code is unique by appending suffix if needed."""
    if base not in used:
        return base
    i = 2
    while True:
        candidate = f"{base}-{i}"
        if candidate not in used:
            return candidate
        i += 1


def to_inventory_csv(result: NYInventoryParseResult, include_vendor_code: bool = False) -> str:
    """
    Convert parsed NY inventory to CSV format for upload.

    Args:
        result: Parsed inventory result
        include_vendor_code: If True, includes vendor_code column (optional for upload)

    Returns CSV string with columns:
        vendor_warehouse_code, sku_code, sku_name, on_hand_qty
        (vendor_code is optional - the system knows from login session)
    """
    buf = io.StringIO()
    writer = csv.writer(buf)

    # Header - vendor_code is optional since the system knows from session
    if include_vendor_code:
        writer.writerow([
            "vendor_code",
            "vendor_warehouse_code",
            "sku_code",
            "sku_name",
            "on_hand_qty",
        ])
    else:
        writer.writerow([
            "vendor_warehouse_code",
            "sku_code",
            "sku_name",
            "on_hand_qty",
        ])

    # Data rows
    for row in result.rows:
        if include_vendor_code:
            writer.writerow([
                result.vendor_code,
                result.warehouse_code,
                row.sku_code,
                row.sku_name,
                int(row.on_hand_qty) if row.on_hand_qty == int(row.on_hand_qty) else row.on_hand_qty,
            ])
        else:
            writer.writerow([
                result.warehouse_code,
                row.sku_code,
                row.sku_name,
                int(row.on_hand_qty) if row.on_hand_qty == int(row.on_hand_qty) else row.on_hand_qty,
            ])

    return buf.getvalue()


def convert_ny_inventory_file(
    input_path: Path,
    output_path: Path,
    *,
    vendor_code: str = "NY",
    warehouse_code: str = DEFAULT_WAREHOUSE_CODE,
    warehouse_name: str = DEFAULT_WAREHOUSE_NAME,
    use_date: Optional[datetime] = None,
    sheet_name: Optional[str] = None,
    include_vendor_code: bool = False,
) -> NYInventoryParseResult:
    """
    Convert an NY Daily Inventory Update Excel file to inventory upload CSV.

    Args:
        input_path: Path to the input Excel file
        output_path: Path to write the output CSV
        vendor_code: Vendor code for SKU generation (default: "NY")
        warehouse_code: Warehouse code (default: "NY-HYD")
        warehouse_name: Warehouse description
        use_date: Specific date to use; if None, uses latest
        sheet_name: Sheet to read; if None, uses first sheet
        include_vendor_code: If True, includes vendor_code column in CSV

    Returns:
        NYInventoryParseResult with parsing details
    """
    result = parse_ny_daily_inventory(
        input_path,
        vendor_code=vendor_code,
        warehouse_code=warehouse_code,
        warehouse_name=warehouse_name,
        use_date=use_date,
        sheet_name=sheet_name,
    )

    csv_content = to_inventory_csv(result, include_vendor_code=include_vendor_code)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(csv_content, encoding="utf-8")

    return result


# --- CLI helper for testing ---
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python ny_daily_inventory.py <input.xlsx> [output.csv]")
        print()
        print("Example:")
        print("  python ny_daily_inventory.py 'NY Daily Inventory Update - 29th Dec.xlsx' inventory.csv")
        print()
        print("Output CSV will have columns:")
        print("  vendor_warehouse_code, sku_code, sku_name, on_hand_qty")
        print()
        print("Default warehouse: NY-HYD (Medchal Plant - Hyderabad)")
        sys.exit(1)

    input_file = Path(sys.argv[1])
    output_file = Path(sys.argv[2]) if len(sys.argv) > 2 else input_file.with_suffix(".csv")

    print(f"Parsing: {input_file}")
    print(f"Output: {output_file}")
    print()

    result = convert_ny_inventory_file(
        input_file,
        output_file,
    )

    print(f"Sheet: {result.sheet_name}")
    print(f"Warehouse: {result.warehouse_code} ({result.warehouse_name})")
    print(f"Inventory Date: {result.inventory_date.strftime('%Y-%m-%d')}")
    print(f"Total SKUs: {len(result.rows)}")
    print()
    print("Sample rows:")
    for row in result.rows[:5]:
        print(f"  {row.sku_code}: {row.sku_name} = {row.on_hand_qty}")
    if len(result.rows) > 5:
        print(f"  ... and {len(result.rows) - 5} more")
    print()
    print(f"✓ CSV written to: {output_file}")

