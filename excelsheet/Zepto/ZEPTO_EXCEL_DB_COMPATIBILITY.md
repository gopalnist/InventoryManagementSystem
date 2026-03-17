# Zepto Excel/CSV vs Report DB – Compatibility Analysis

This document compares the files under `excelsheet/Zepto/` (Sales, Inventory, PO, Ads) with the current report service database table structure.

---

## 1. Sales

**File:** `Zepto/Sales/SALES_b30ba49ec77e5b03.csv` (CSV)

**Columns in file:**

| Column in file              | DB column (sales_reports) | Status |
|-----------------------------|---------------------------|--------|
| Date                        | report_date               | ✅ Mapped (zepto sales: `date` → "Date") |
| SKU Number                  | product_identifier        | ✅ Mapped |
| SKU Name                    | product_name             | ✅ Mapped |
| Sales (Qty) - Units         | quantity                 | ✅ Mapped |
| MRP                         | unit_price               | ✅ Mapped |
| Gross Merchandise Value     | total_amount             | ✅ Mapped |
| City                        | city                     | ✅ Mapped |
| SKU Category                | sku_category             | ⚠️ **Add to mapping** (column exists in DB after 002) |
| SKU Sub Category            | sku_sub_category         | ⚠️ **Add to mapping** |
| Brand Name                  | brand_name               | ⚠️ **Add to mapping** |
| EAN, Manufacturer Name, ID  | —                        | Stored in raw_data only |

**Verdict:** **Compatible.** Current zepto sales mapping covers core fields. Adding `sku_category`, `sku_sub_category`, `brand_name` to the zepto sales mapping will populate those DB columns.

---

## 2. Inventory

**File:** `Zepto/Inventory/INVENTORY_731416fa05186320.csv` (CSV)

**Columns in file:**

| Column in file     | DB column (inventory_reports) | Status |
|--------------------|--------------------------------|--------|
| City               | city                           | ✅ Mapped (zepto inventory: `city` → "City") |
| SKU Code           | product_identifier             | ✅ Mapped |
| SKU Name           | product_name                   | ✅ Mapped |
| Units              | quantity                       | ✅ Mapped |
| (no date column)   | report_date                    | ✅ Backend uses `date.today()` when missing |
| —                  | location, warehouse_code        | Optional; not in file |

**Verdict:** **Compatible.** Existing zepto inventory mapping matches the file. No schema or mapping change needed.

---

## 3. PO (Purchase Order)

**File:** `Zepto/PO/PO_738334d660d625ba.csv` (CSV)

**Columns in file:**

| Column in file   | DB column (po_reports) | Status |
|------------------|------------------------|--------|
| PO No.           | po_number              | ✅ Mapped |
| PO Date          | po_date                | ✅ Mapped |
| Status           | status                 | ✅ Mapped |
| Vendor Code      | vendor_code            | ✅ Mapped |
| Vendor Name      | vendor_name            | ✅ Mapped |
| Del Location     | location               | ✅ Mapped |
| SKU / SKU Code   | product_identifier     | ✅ Mapped ("SKU") |
| SKU Desc         | product_name           | ✅ Mapped |
| Qty              | quantity               | ✅ Mapped |
| Unit Base Cost   | unit_cost              | ✅ Mapped |
| Landing Cost     | landing_cost           | ✅ Mapped |
| Total Amount     | total_amount           | ✅ Mapped |
| ASN Quantity     | asn_quantity           | ✅ Mapped |
| GRN Quantity     | grn_quantity           | ✅ Mapped |
| PO Expiry Date   | expiry_date            | ✅ Mapped |
| PO Amount, etc.  | —                      | In raw_data |

**Verdict:** **Compatible.** Zepto PO mapping already covers all required and optional PO columns in the DB.

---

## 4. Ads

**Files (all Excel):**

- `Zepto/Ads/Campaign Level Performance.xlsx`
- `Zepto/Ads/Category Performance.xlsx`
- `Zepto/Ads/City_Level Performance.xlsx`
- `Zepto/Ads/Keyword Performance.xlsx`
- `Zepto/Ads/Overview.xlsx`
- `Zepto/Ads/Page Level Performance.xlsx`
- `Zepto/Ads/Performance.xlsx`
- `Zepto/Ads/Product Level Performance.xlsx`
- `Zepto/Ads/Traffic.xlsx`

**ads_reports columns:** report_date, campaign_name, ad_group, product_identifier, impressions, clicks, spend, sales, roas, acos, raw_data; plus (002) city, campaign_type, orders, category.

**Column mapping (common across most Ads files):**

| Excel column (typical) | DB column     | Notes |
|------------------------|---------------|--------|
| CampaignName / Campaign_name | campaign_name | ✅ |
| CampaignType           | campaign_type | ✅ (002) |
| Clicks                 | clicks        | ✅ |
| Impressions            | impressions   | ✅ |
| Orders                 | orders        | ✅ (002) |
| Revenue                | sales         | ✅ |
| Spend                  | spend         | ✅ |
| Roas                   | roas          | ✅ |
| CityName               | city          | ✅ (002) – City_Level |
| ProductID / ProductName| product_identifier / product_name | ✅ – Product Level |
| Category               | category      | ✅ (002) – Category / Product Level |
| Date                   | report_date   | Only in Overview, Performance; else use today |

**Per-file summary:**

| File                      | Has campaign | Has city | Has product | Has category | Has orders/revenue/spend | Compatible with ads_reports |
|---------------------------|-------------|----------|-------------|--------------|---------------------------|-----------------------------|
| Campaign Level Performance| ✅           | —        | —           | —            | ✅                         | ✅ With mapping             |
| Category Performance      | ✅           | —        | —           | ✅           | ✅                         | ✅ With mapping             |
| City_Level Performance   | —           | ✅       | —           | —            | ✅                         | ✅ With mapping             |
| Product Level Performance | ✅           | —        | ✅          | ✅           | ✅                         | ✅ With mapping             |
| Keyword / Page / Overview / Performance / Traffic | Various | — | — | — | Partial                    | ✅ With mapping (some cols only in raw_data) |

**Verdict:** **Compatible** with the current `ads_reports` structure. There is **no zepto ads mapping** in the report service today; adding a Zepto ads mapping (and optionally a `data_type` or file-type discriminator, e.g. campaign_level, city_level, product_level, category_level) would allow these Excel files to be uploaded and stored in the same table.

---

## 5. Summary

| Data type   | File(s)                          | DB table        | Compatible? | Action |
|------------|-----------------------------------|------------------|------------|--------|
| Sales      | Sales/*.csv                       | sales_reports    | ✅ Yes     | Add sku_category, sku_sub_category, brand_name to zepto sales mapping so DB columns are filled. |
| Inventory  | Inventory/*.csv                  | inventory_reports| ✅ Yes     | None. |
| PO         | PO/*.csv                          | po_reports       | ✅ Yes     | None. |
| Ads        | Ads/*.xlsx (all)                  | ads_reports      | ✅ Yes     | Add zepto ads mapping (and optionally data_type) so uploads write to ads_reports. |

---

## 6. Recommended backend changes

1. **Zepto sales**  
   In `DEFAULT_MAPPINGS["zepto"]["sales"]`, add:
   - `"sku_category": "SKU Category"`
   - `"sku_sub_category": "SKU Sub Category"`
   - `"brand_name": "Brand Name"`

2. **Zepto ads**  
   Add `DEFAULT_MAPPINGS["zepto"]["ads"]` (and, if desired, per–file-type logic similar to `weekly_report` ads with `data_type`):
   - Map: campaign_name (CampaignName / Campaign_name), campaign_type (CampaignType), clicks, impressions, orders, sales (Revenue), spend (Spend), roas (Roas), city (CityName), product_identifier (ProductID), product_name (ProductName), category (Category).
   - Default `report_date` to today when Date is absent.

After these changes, all Zepto Sales, Inventory, PO, and Ads files under `excelsheet/Zepto/` are compatible with the current database table structure and can be uploaded through the report service.
