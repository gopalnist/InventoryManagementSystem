# Amazon Excel/CSV vs Report DB – Compatibility Analysis

Analysis of files under `excelsheet/Amazon/` (Sales, Inventory, PO, Ads, Traffic) against the report service database tables.

---

## Files found

| Folder    | File | Format |
|-----------|------|--------|
| Sales     | Sales_ASIN_Manufacturing_Retail_India_Custom_13-3-2026_13-3-2026.xlsx | Excel |
| Inventory | Inventory_ASIN_Manufacturing_Retail_India_Custom_13-3-2026_13-3-2026.xlsx | Excel |
| PO        | PurchaseOrderItems (29).xlsx | Excel |
| Ads       | Campaign_Mar_15_2026.csv | CSV |
| Traffic   | Traffic_ASIN_India_Custom_13-3-2026_13-3-2026.xlsx | Excel |

---

## 1. Sales

**File:** `Amazon/Sales/Sales_ASIN_Manufacturing_Retail_India_Custom_*.xlsx`

**Layout:** Row 0 = metadata (Programme, View By, Viewing Range, etc.). **Row 1 = column headers.** Data from row 2 onward.

**Columns (row 1):** ASIN, Product Title, Brand, Ordered Revenue, Ordered Units, Shipped Revenue, Shipped COGS, Shipped Units, Customer Returns, …

| Excel column     | DB column (sales_reports) | Notes |
|------------------|---------------------------|--------|
| ASIN             | product_identifier        | ✅ |
| Product Title    | product_name              | ✅ |
| Brand            | brand_name                | ✅ (migration 002) |
| Ordered Revenue  | total_amount              | ✅ (or Shipped Revenue) |
| Ordered Units    | quantity                  | ✅ (or Shipped Units) |
| (no date column) | report_date               | From metadata "Viewing Range" or default today |
| (no city)         | city                      | Optional; leave null |

**Verdict:** **Compatible** with `sales_reports`. Needs:
- **Amazon sales mapping** in backend (today there is **no** `DEFAULT_MAPPINGS["amazon"]`).
- **Excel read with `header=1`** (skip first row so row 1 is the header).

---

## 2. Inventory

**File:** `Amazon/Inventory/Inventory_ASIN_Manufacturing_Retail_India_Custom_*.xlsx`

**Layout:** Row 0 = metadata. **Row 1 = column headers.** Data from row 2.

**Columns (row 1):** ASIN, Product Title, Brand, Sourceable Product OOS %, Vendor Confirmation %, Net Received, Net Received Units, Open Purchase Order Quantity, …, Sellable On-Hand Inventory, Sellable On Hand Units, …

| Excel column           | DB column (inventory_reports) | Notes |
|------------------------|-------------------------------|--------|
| ASIN                   | product_identifier            | ✅ |
| Product Title         | product_name                  | ✅ |
| Sellable On Hand Units | quantity                      | ✅ (or Net Received Units) |
| (no date)              | report_date                   | Default today |
| (no city/location)     | city, location                | Optional; null |

**Verdict:** **Compatible** with `inventory_reports`. Needs Amazon inventory mapping and **read with `header=1`**.

---

## 3. PO (Purchase Order)

**File:** `Amazon/PO/PurchaseOrderItems (29).xlsx`

**Layout:** First row = headers. No metadata block.

**Columns:** PO, Vendor, Ship to location, ASIN, External Id, Title, Quantity Requested, Accepted quantity, Quantity received, Unit Cost, Total cost, Expected date, …

| Excel column        | DB column (po_reports) | Notes |
|---------------------|------------------------|--------|
| PO                  | po_number              | ✅ |
| Vendor              | vendor_code / vendor_name | ✅ (single column; can map to both or one) |
| Ship to location    | location               | ✅ |
| ASIN                | product_identifier     | ✅ |
| Title               | product_name           | ✅ |
| Quantity Requested  | quantity               | ✅ (or Accepted quantity) |
| Unit Cost           | unit_cost              | ✅ |
| Total cost          | total_amount           | ✅ (strip "INR" if present) |
| Expected date       | po_date or expiry_date | ✅ |
| (no status column)  | status                 | Optional; null or derived |

**Verdict:** **Compatible** with `po_reports`. Needs Amazon PO mapping. No header skip needed.

---

## 4. Ads

**File:** `Amazon/Ads/Campaign_Mar_15_2026.csv`

**Layout:** First row = headers. No skip.

**Columns:** State, Campaign name, Status, Type, Targeting, Campaign start date, Campaign end date, Campaign budget amount, Clicks, CTR, Total cost, CPC, Purchases, Sales, ACOS, ROAS, …

| CSV column      | DB column (ads_reports) | Notes |
|-----------------|--------------------------|--------|
| Campaign name   | campaign_name            | ✅ |
| Type            | campaign_type            | ✅ (SD, SP, etc. – migration 002) |
| Clicks          | clicks                   | ✅ |
| Total cost      | spend                    | ✅ (strip ₹) |
| Sales           | sales                    | ✅ (strip ₹) |
| ROAS            | roas                     | ✅ |
| ACOS            | acos                     | ✅ |
| Purchases       | orders                   | ✅ (migration 002) |
| (no impressions)| impressions              | Optional; null |
| Campaign start/end date | report_date     | Use start date or today |

**Verdict:** **Compatible** with `ads_reports`. Needs Amazon ads mapping. CSV may need number parsing (strip "₹" and commas).

---

## 5. Traffic

**File:** `Amazon/Traffic/Traffic_ASIN_India_Custom_*.xlsx`

**Layout:** Row 0 = metadata. Row 1 = ASIN, Product Title, Brand, Featured Offer Page Views, …

**Verdict:** No direct match to current report tables (we have sales, inventory, po, profit_loss, ads). Could be stored later in a dedicated traffic/views table or ignored for now. **Not mapped to existing report DB.**

---

## 6. Summary

| Data type   | DB table          | Compatible? | Backend today |
|------------|--------------------|------------|----------------|
| Sales      | sales_reports      | ✅ Yes     | No Amazon mapping; need `header=1` for Excel. |
| Inventory  | inventory_reports  | ✅ Yes     | No Amazon mapping; need `header=1` for Excel. |
| PO         | po_reports         | ✅ Yes     | No Amazon mapping. |
| Ads        | ads_reports        | ✅ Yes     | No Amazon mapping; CSV number parsing (₹, commas). |
| Traffic    | —                  | ❌ No      | No report table for traffic/page views. |

---

## 7. Recommended backend changes

1. **Add `DEFAULT_MAPPINGS["amazon"]`** with:
   - **sales:** date (none; use today or parse from metadata), product_identifier="ASIN", product_name="Product Title", quantity="Ordered Units", total_amount="Ordered Revenue", brand_name="Brand". Optional: sku_category/sku_sub_category if you add them to the file later.
   - **inventory:** product_identifier="ASIN", product_name="Product Title", quantity="Sellable On Hand Units", brand (if needed).
   - **po:** po_number="PO", vendor_code/vendor_name="Vendor", location="Ship to location", product_identifier="ASIN", product_name="Title", quantity="Quantity Requested", unit_cost="Unit Cost", total_amount="Total cost", po_date/expiry_date="Expected date".
   - **ads:** campaign_name="Campaign name", campaign_type="Type", clicks="Clicks", spend="Total cost", sales="Sales", roas="ROAS", acos="ACOS", orders="Purchases".

2. **Amazon Sales & Inventory Excel:** When `channel == 'amazon'` and `report_type in ('sales', 'inventory')`, read Excel with **`header=1`** (same pattern as Blinkit inventory).

3. **Amazon Ads CSV:** Strip "₹" and commas from numeric columns (Total cost, Sales, etc.) before insert.

After these changes, Amazon Sales, Inventory, PO, and Ads are compatible with the current DB; only Traffic has no matching table.
