# DB Table Structure vs Weekly Report Excel – Incorporation Analysis

## Summary

The **current report-service schema can largely incorporate** the Weekly Report Excel, with a few **additions** so MAIN-1 dashboard and analytics work cleanly.

| Excel Tab | Fits in existing table? | Gaps / changes needed |
|-----------|--------------------------|------------------------|
| **TOTAL-CITY-WISE SALE** | ✅ **sales_reports** | Optional: category/subcategory columns for analytics |
| **AD-CITY LEVEL DATA** | ⚠️ **ads_reports** | Add: **city**, **campaign_type**, **orders** |
| **AD-CATEGORY PERFORMANCE** | ⚠️ **ads_reports** | Same + **category** (or in raw_data) |
| **SP-AD-PRODUCT PERFORMANCE** | ⚠️ **ads_reports** | Same; product-level already supported |
| **SB-AD-PRODUCT PERFORMANCE** | ⚠️ **ads_reports** | Same (campaign_type = 'SB') |

---

## 1. TOTAL-CITY-WISE SALE → `sales_reports`

**Excel columns:**  
Date, SKU Number, SKU Name, EAN, SKU Category, SKU Sub Category, Brand Name, Manufacturer Name, Manufacturer ID, City, Sales (Qty) - Units, MRP, Gross Merchandise Value

**Current `sales_reports` columns:**

| Column | Use for Excel | Note |
|--------|----------------|------|
| tenant_id | ✅ | From upload context |
| upload_id | ✅ | Link to report_uploads |
| channel | ✅ | e.g. `'zepto'` (from MAIN-1 header) |
| report_date | ✅ | **Date** |
| product_identifier | ✅ | **SKU Number** |
| product_name | ✅ | **SKU Name** |
| quantity | ✅ | **Sales (Qty) - Units** |
| unit_price | ✅ | **MRP** (or null) |
| total_amount | ✅ | **Gross Merchandise Value** |
| city | ✅ | **City** |
| location | ✅ | Optional / null |
| raw_data | ✅ | EAN, SKU Category, SKU Sub Category, Brand Name, Manufacturer Name, Manufacturer ID |

**Conclusion:** TOTAL-CITY-WISE SALE fits **as-is** into `sales_reports`. Category and subcategory can stay in `raw_data` for filters/analytics, or you can add:

- `sku_category VARCHAR(255)` 
- `sku_sub_category VARCHAR(255)`  
- `brand_name VARCHAR(255)`  

for simpler reporting and MAIN-1 “Overall Product Performance” (category/subcategory columns).

---

## 2. AD-CITY LEVEL DATA → `ads_reports`

**Excel columns (row 0):**  
SP (campaign type), CityName, BrandID, BrandName, Atc, Clicks, Cpc, Cpm, Impressions, Orders, Other_skus, Revenue, Roas, Robas, Same_skus, Spend

**Current `ads_reports` columns:**

| Column | Use for Excel | Note |
|--------|----------------|------|
| tenant_id | ✅ | From context |
| upload_id | ✅ | Link to upload |
| channel | ✅ | e.g. `'zepto'` |
| report_date | ✅ | From MAIN-1 period (e.g. 1st Feb–28th Feb) |
| campaign_name | ✅ | Can use `'City Level'` or sheet name |
| ad_group | ✅ | Null or city name |
| product_identifier | ✅ | Null (city-level aggregate) |
| impressions | ✅ | **Impressions** |
| clicks | ✅ | **Clicks** |
| spend | ✅ | **Spend** |
| sales | ✅ | **Revenue** |
| roas | ✅ | **Roas** |
| acos | ✅ | Optional / null |
| raw_data | ✅ | Atc, Cpc, Cpm, Orders, Other_skus, Same_skus, Robas, BrandID, BrandName |

**Gaps:**

- **City:** No column for **CityName**. Needed for MAIN-1 city-level view and for “TOTAL-CITY-WISE SALE” vs ad spend by city.
- **Campaign type:** No column for **SP / SB / SD**. Needed for MAIN-1 “Campaign Type” breakdown (SD, SP, SB).
- **Orders (ad orders):** No column for **Orders**. Needed for CPS (Cost Per Sale = Spend / Orders) and for organic = Total Order − Ad Order.

**Recommendation:** Add to `ads_reports`:

- `city VARCHAR(100)`  
- `campaign_type VARCHAR(20)` — e.g. `'SP'`, `'SB'`, `'SD'`  
- `orders INTEGER` (or DECIMAL) — ad order count  

Then store: Atc, Cpc, Cpm, Other_skus, Same_skus, Robas, BrandID, BrandName in `raw_data`.

---

## 3. AD-CATEGORY PERFORMANCE (SB) → `ads_reports`

**Excel columns:**  
SB, BrandID, BrandName, Atc, Campaign_id, Campaign_name, Category, Clicks, Cpm, Impressions, Orders, Other_skus, Revenue, Roas, Robas, Same_skus, Spend

Same as above: use **ads_reports** with:

- `campaign_type = 'SB'`
- `campaign_name` = **Campaign_name**
- `city` = null (category-level, not city-level)
- `orders` = **Orders**
- `category` = **Category** (if you add the column; otherwise in raw_data)

So the same three new columns (city, campaign_type, orders) plus optional **category** cover this sheet.

---

## 4. SP-AD-PRODUCT PERFORMANCE → `ads_reports`

**Excel columns (row 3):**  
ProductID, ProductName, BrandID, BrandName, Atc, Campaign_id, Campaign_name, Category, Clicks, Cpc, Cpm, Ctr, Impressions, Orders, Other_skus, Revenue, Roas, Robas, Same_skus, Spend

**Current schema already has:**  
product_identifier, product_name (in raw_data or you can add), campaign_name, impressions, clicks, spend, sales, roas.

**Needed for MAIN-1:**

- **campaign_type** = `'SP'` (so SP row in “Campaign Type” is sum of these rows).
- **orders** = **Orders** (for CPS and organic calculation).
- **city** = null for product-level.
- **category** = optional, for “Overall Product Performance” and category analytics.

So again: add **city**, **campaign_type**, **orders**, and optionally **category** to `ads_reports`; rest (ProductName, BrandID, BrandName, Atc, Cpc, Cpm, Ctr, Campaign_id, Other_skus, Same_skus, Robas) in **raw_data**.

---

## 5. SB-AD-PRODUCT PERFORMANCE → `ads_reports`

Same structure as SP-AD but **campaign_type = 'SB'**. No extra table or columns beyond what’s above.

---

## 6. What about MAIN-1?

MAIN-1 is a **dashboard view**, not a separate table. You build it by:

- **ADS / OVERALL KPIs:** Aggregate from `ads_reports` (and optionally from `sales_reports` for total order/sale).
- **Campaign Type table:** Filter `ads_reports` by `campaign_type` (SD, SP, SB), then sum spend, orders, revenue, and compute ROAS, AOV, CPS.
- **Overall Product Performance:** Aggregate `sales_reports` by product (and category/subcategory), join with ad metrics from `ads_reports` (e.g. impressions/orders for “View to Order”).
- **City-Wise Sale matrix:** Pivot `sales_reports` by product_identifier/product_name and city (sum of quantity).

So MAIN-1 is fully supported once the Excel data sits in **sales_reports** and **ads_reports** with the suggested additions.

---

## 7. Recommended schema changes (minimal)

Apply these in the report-service DB (e.g. new migration or `ALTER` in `001_reports_init.sql` or a new migration file).

### 7.1 `ads_reports` – add columns

```sql
-- Add to ads_reports for Weekly Report Excel (AD-CITY, AD-CATEGORY, SP-AD, SB-AD)
ALTER TABLE ads_reports
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(20),  -- 'SP', 'SB', 'SD'
  ADD COLUMN IF NOT EXISTS orders INTEGER,
  ADD COLUMN IF NOT EXISTS category VARCHAR(255);

-- Optional index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_ads_reports_campaign_type ON ads_reports(campaign_type);
CREATE INDEX IF NOT EXISTS idx_ads_reports_city ON ads_reports(city);
```

### 7.2 `sales_reports` – optional columns (for analytics)

```sql
-- Optional: avoid querying raw_data for category in MAIN-1 product table
ALTER TABLE sales_reports
  ADD COLUMN IF NOT EXISTS sku_category VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sku_sub_category VARCHAR(255),
  ADD COLUMN IF NOT EXISTS brand_name VARCHAR(255);
```

---

## 8. Upload flow (how Excel fits)

1. User uploads **Weekly Report** Excel (one file, multiple tabs).
2. Backend creates one **report_uploads** row (e.g. `report_type = 'weekly_report'` or keep as `ads`/`sales` and use metadata).
3. Parse each tab and insert:
   - **TOTAL-CITY-WISE SALE** → `sales_reports` (channel = e.g. zepto; report_date from row Date).
   - **AD-CITY LEVEL DATA** → `ads_reports` (city, campaign_type from first column, orders, spend, revenue, etc.; report_date from MAIN-1 period).
   - **AD-CATEGORY PERFORMANCE** → `ads_reports` (campaign_type = 'SB', category, campaign_name, etc.).
   - **SP-AD-PRODUCT PERFORMANCE** → `ads_reports` (campaign_type = 'SP', product_identifier, campaign_name, orders, etc.).
   - **SB-AD-PRODUCT PERFORMANCE** → `ads_reports` (campaign_type = 'SB', product-level).
4. MAIN-1 dashboard APIs query `sales_reports` and `ads_reports` with date range and channel (and campaign_type where needed).

---

## 9. Checklist: “Will current structure incorporate the Excel?”

| Requirement | Covered by current + changes |
|-------------|------------------------------|
| Store TOTAL-CITY-WISE SALE (date, SKU, city, qty, GMV) | ✅ sales_reports (+ optional category columns) |
| Store AD-CITY (city, spend, orders, revenue, ROAS) | ✅ ads_reports after adding city, campaign_type, orders |
| Store AD-CATEGORY / SB (category, campaign, metrics) | ✅ ads_reports with campaign_type, category, orders |
| Store SP-AD product performance | ✅ ads_reports with campaign_type, product_identifier, orders |
| Store SB-AD product performance | ✅ ads_reports with campaign_type = 'SB' |
| MAIN-1: ADS / ORGANIC / OVERALL KPIs | ✅ Aggregations from ads_reports + sales_reports |
| MAIN-1: Campaign Type (SD, SP, SB) | ✅ Filter by campaign_type in ads_reports |
| MAIN-1: Overall Product Performance | ✅ Group sales_reports by product; join ads for View to Order |
| MAIN-1: City-Wise Sale matrix | ✅ Pivot sales_reports by product × city |
| WoW / MoM analytics | ✅ Possible with report_date in both tables |

**Conclusion:** The current table structure **will** incorporate the Weekly Report Excel once you add **city**, **campaign_type**, and **orders** (and optionally **category**) to **ads_reports**, and optionally **sku_category**, **sku_sub_category**, **brand_name** to **sales_reports**. No new tables are required; MAIN-1 stays a computed dashboard over these two tables.
