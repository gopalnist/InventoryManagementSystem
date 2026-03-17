# Weekly Report – MAIN-1 Dashboard Analysis

## Overview

The **MAIN-1** tab is the main dashboard. It is **built from** the following source tabs:

| Source Tab | Purpose |
|------------|--------|
| **AD-CITY LEVEL DATA** | City-wise ad metrics (spend, orders, revenue, ROAS) → feeds **Campaign Type** breakdown and city-level views |
| **AD-CATEGORY PERFORMANCE** | Category/campaign-wise ad performance (SB) → feeds **Campaign Type** (SB) and category insights |
| **SP-AD-PRODUCT PERFORMANCE** | Sponsored Products (SP) ad performance by product → feeds **Campaign Type (SP)** and **Overall Product Performance** |
| **TOTAL-CITY-WISE SALE** | Transaction-level sales by Date, SKU, City → feeds **Overall Product Performance** and **City-Wise Sale** matrix |

---

## 1. MAIN-1 Tab Structure (What the Dashboard Contains)

### 1.1 Header / Context (Rows 0–4)

| Element | Location | Source / Logic |
|--------|----------|----------------|
| Brand + Channel | Row 0, Col 4 | e.g. "NOURISHYOU :- ZEPTO" (config or selection) |
| Date range | Row 0, Col 10–11 | e.g. "DATE", "1st feb - 28th feb" (selected week/month) |
| Marketplace | Row 1, Col 10–11 | e.g. "MARKETPLACE", "ZEPTO" |
| Verified | Row 2, Col 10 | Optional "VERIFIED" or similar badge |

**Required for dashboard:**  
- Brand name, channel/marketplace, date range (start–end), optional “verified” flag.

---

### 1.2 ADS vs ORGANIC vs OVERALL (Rows 5–14)

**Row 5:** Section labels – **ADS** | **ORGANIC** | **OVERALL**

**Row 6 (Headers):**

| Col | ADS | ORGANIC | OVERALL |
|-----|-----|---------|--------|
| 1 | Weeks | – | – |
| 2 | Ad Spend | – | – |
| 3 | Ad Order | – | – |
| 4 | Ads Order Value | – | – |
| 5 | ROAS (Ads) | – | – |
| 6 | Avg Order Value (Ads) | – | – |
| 7 | CPS | – | – |
| 8 | – | Total Organic Order | – |
| 9 | – | Organic Sale Value | – |
| 10 | – | – | Total Order |
| 11 | – | – | Total Sale Value |
| 12 | – | – | Avg Order Value (Total) |
| 13 | – | – | ROI (Total) |
| 14 | – | – | CPS (Total) |
| 15–16 | (optional) | – | e.g. Period total sale, Target (8028231, 9500000 in sample) |

**Row 7:** One data row for the selected period (e.g. "1st feb - 28th Feb") with all 14+ metrics.

**Derivation (what you need to build):**

- **ADS block (Cols 2–7):**  
  Sum/aggregate from **AD-CITY LEVEL DATA** (and optionally AD-CATEGORY / SP-AD / SB-AD):  
  - Ad Spend, Ad Order, Ads Order Value → then **ROAS = Ads Order Value / Ad Spend**, **Avg Order Value (Ads) = Ads Order Value / Ad Order**, **CPS = Ad Spend / Ad Order**.

- **ORGANIC (Cols 8–9):**  
  - Total Organic Order = Total Order − Ad Order (from same period).  
  - Organic Sale Value = Total Sale Value − Ads Order Value.  
  (Or from a dedicated organic source if you have it.)

- **OVERALL (Cols 10–14):**  
  - Total Order, Total Sale Value from **TOTAL-CITY-WISE SALE** (sum of orders and GMV for the period).  
  - Then: Avg Order Value (Total), ROI (Total), CPS (Total) as derived metrics.  
  - Cols 15–16: e.g. **Total Sale** (period sum) and **Target** (e.g. monthly target) if you use them.

**Required for dashboard:**  
- Aggregations from AD-CITY (and other ad tabs) for ADS.  
- Aggregations from TOTAL-CITY-WISE SALE for total orders and GMV.  
- Formulas: ROAS, AOV, CPS, ROI; optional target and “total sale” vs target.

---

### 1.3 Campaign Type Breakdown (Rows 15–19)

**Row 15 (Headers):**  
Campaign Type | Ad Spend | Ad Order | Ads Order Value | ROAS (Ads) | Avg Order Value (Ads) | CPS

**Rows 16–18:** One row per campaign type:

- **SD** – Sponsored Display (from AD-CITY or equivalent; sample has 0).
- **SP** – Sponsored Products: from **SP-AD-PRODUCT PERFORMANCE** (sum by campaign type or sheet).
- **SB** – Sponsored Brand: from **AD-CATEGORY PERFORMANCE** (SB) or **SB-AD-PRODUCT PERFORMANCE**.

**Required for dashboard:**  
- Split of ad metrics by campaign type (SD, SP, SB).  
- Source: AD-CITY LEVEL DATA (if tagged by type), **SP-AD-PRODUCT PERFORMANCE**, **AD-CATEGORY PERFORMANCE** / **SB-AD-PRODUCT PERFORMANCE**.  
- Same derived columns: ROAS, AOV, CPS.

---

### 1.4 Overall Product Performance (Rows 23–46)

**Row 23:** Title – "OVERALL PRODUCT PERFORMANCE"

**Row 24 (Headers):**  
Product Name | Category | Subcategory | Sales Contribution (%) | Available Stores | GMV | Stock on Hand | Quantity Sold | Week on Week Growth | Month on Month Growth | View to Order

**Rows 25–45:** One row per product (SKU) with:

- **Product Name, Category, Subcategory** – from **TOTAL-CITY-WISE SALE** (SKU Name, SKU Category, SKU Sub Category) or catalog.
- **Sales Contribution** – % of total GMV from this product in the period.
- **Available Stores** – from inventory/listing data (e.g. store count where SKU is available); if not in sheets, can be placeholder or from another source.
- **GMV** – from **TOTAL-CITY-WISE SALE** (Gross Merchandise Value), summed by product for the period.
- **Stock on Hand** – from inventory data (not in the provided tabs; may need inventory feed).
- **Quantity Sold** – from **TOTAL-CITY-WISE SALE** (Sales (Qty) - Units), summed by product.
- **Week on Week Growth** – (This week − Last week) / Last week, for GMV or units.
- **Month on Month Growth** – Same for month-over-month.
- **View to Order** – If you have view/impression data (e.g. from **SP-AD-PRODUCT PERFORMANCE** – Impressions vs Orders), else can leave 0 or optional.

**Required for dashboard:**  
- **TOTAL-CITY-WISE SALE** aggregated by product (and category/subcategory).  
- Optional: inventory for “Stock on Hand”, ad/impression data for “View to Order”.  
- Previous period data (week/month) for WoW and MoM growth.

---

### 1.5 TOTAL-CITY-WISE SALE (Rows 48–55+)

**Row 48:** Title – "TOTAL-CITY-WISE SALE"

**Row 49:** "SUM of Sales (Qty) - Units" | "City"

**Row 50 (Headers):**  
SKU Name | City1 | City2 | … | Grand Total

**Rows 51+:** One row per product; columns are cities; cell = quantity sold in that city (for the selected period). Last column = Grand Total.

**Source:**  
- **TOTAL-CITY-WISE SALE** tab: pivot by **SKU Name** (or product id) and **City**, sum **Sales (Qty) - Units** for the selected date range.

**Required for dashboard:**  
- Date filter on **TOTAL-CITY-WISE SALE**.  
- Pivot: rows = products, columns = cities, values = sum of units.  
- Grand Total column.

---

## 2. Source Tabs – Column Mapping Summary

### 2.1 AD-CITY LEVEL DATA

| Column (0-indexed) | Name | Use in MAIN-1 |
|--------------------|------|----------------|
| 2 | CityName | City dimension; city-wise breakdown |
| 3–4 | BrandID, BrandName | Filter by brand |
| 5–16 | Atc, Clicks, Cpc, Cpm, Impressions, Orders, Other_skus, Revenue, Roas, Robas, Same_skus, Spend | ADS block and Campaign Type (if type SD/SP/SB is identifiable); ROAS, CPS, AOV |

No campaign type in this sheet; campaign type breakdown comes from SP-AD and AD-CATEGORY (SB).

---

### 2.2 AD-CATEGORY PERFORMANCE (SB)

| Column | Name | Use in MAIN-1 |
|--------|------|----------------|
| 5–6 | Campaign_id, Campaign_name | Campaign grouping |
| 7 | Category | Category-level view |
| 8–17 | Atc, Clicks, Cpm, Impressions, Orders, Other_skus, Revenue, Roas, Robas, Same_skus, Spend | SB row in Campaign Type; category-level metrics |

---

### 2.3 SP-AD-PRODUCT PERFORMANCE

| Column | Name | Use in MAIN-1 |
|--------|------|----------------|
| 1–2 | ProductID, ProductName | Product-level ads and product performance |
| 6 | Campaign_name | Campaign / type (SP) |
| 8 | Category | Category for product table |
| 9–20 | Clicks, Cpc, Cpm, Ctr, Impressions, Orders, Other_skus, Revenue, Roas, Robas, Same_skus, Spend | SP row in Campaign Type; product-level ROAS/View to Order (Impressions vs Orders) |

---

### 2.4 TOTAL-CITY-WISE SALE

| Column | Name | Use in MAIN-1 |
|--------|------|----------------|
| 0 | Date | Date range filter for dashboard |
| 1–2 | SKU Number, SKU Name | Product key; product name in tables |
| 4–5 | SKU Category, SKU Sub Category | Category, Subcategory in Overall Product Performance |
| 9 | City | City dimension for city-wise sale matrix |
| 10 | Sales (Qty) - Units | Quantity sold; sum for product, city, period |
| 11–12 | MRP, Gross Merchandise Value | GMV calculation |

---

## 3. What You Need to Build the MAIN-1 Dashboard

### 3.1 Data Pipelines

1. **AD-CITY LEVEL DATA**  
   - Ingest and filter by brand + date (if date exists) or use as current snapshot.  
   - Aggregate: total Ad Spend, Ad Order, Ads Order Value (Revenue), then ROAS, AOV, CPS.  
   - Optional: city-level widget or table.

2. **AD-CATEGORY PERFORMANCE**  
   - Filter by brand.  
   - Aggregate for **SB**: Spend, Orders, Revenue → SP row in “Campaign Type” and category breakdown.

3. **SP-AD-PRODUCT PERFORMANCE**  
   - Aggregate for **SP**: Spend, Orders, Revenue → SP row in “Campaign Type”.  
   - Use product + Orders/Impressions for “View to Order” in product table if needed.

4. **TOTAL-CITY-WISE SALE**  
   - Filter by date range.  
   - Sum by product: Quantity Sold, GMV; compute Sales Contribution %.  
   - Pivot by product × city for city-wise sale matrix.  
   - Join category/subcategory from same sheet (or catalog).

### 3.2 Dashboard UI Components

| # | Component | Data source | Notes |
|---|-----------|-------------|--------|
| 1 | Header | Config / selection | Brand, channel, date range, marketplace |
| 2 | KPI block: ADS | AD-CITY + SP-AD + AD-CATEGORY (SB) | Ad Spend, Ad Order, Ads Order Value, ROAS, AOV, CPS |
| 3 | KPI block: ORGANIC | Derived | Total Order − Ad Order; Total Sale − Ads Order Value |
| 4 | KPI block: OVERALL | TOTAL-CITY-WISE SALE | Total Order, Total Sale Value, AOV, ROI, CPS; optional Target |
| 5 | Table: Campaign Type | AD-CITY (SD) + SP-AD (SP) + AD-CATEGORY (SB) | Rows: SD, SP, SB; same metrics as ADS block |
| 6 | Table: Overall Product Performance | TOTAL-CITY-WISE SALE + optional inventory/ads | Product, Category, Subcategory, GMV, Qty, Contribution %, WoW/MoM, View to Order |
| 7 | Matrix: City-Wise Sale | TOTAL-CITY-WISE SALE | Rows = products, columns = cities, values = units |

### 3.3 Derived Metrics (Formulas)

- **ROAS (Ads)** = Ads Order Value / Ad Spend  
- **Avg Order Value (Ads)** = Ads Order Value / Ad Order  
- **CPS** = Ad Spend / Ad Order  
- **Sales Contribution %** = (Product GMV / Total GMV) × 100  
- **WoW / MoM Growth** = (Current − Previous) / Previous (as %)  
- **View to Order** = Orders / Impressions (from ad data, optional)

### 3.4 Optional / External

- **Stock on Hand** – requires inventory feed if you want it in the product table.  
- **Target** (e.g. 9500000) – from goals/targets config or sheet.  
- **Available Stores** – from catalog/listings if available.

---

## 4. Summary Checklist for Building MAIN-1

- [ ] **Header:** Brand, channel, date range, marketplace.  
- [ ] **ADS block:** From AD-CITY (+ SP-AD + AD-CATEGORY for totals); Ad Spend, Ad Order, Ads Order Value, ROAS, AOV, CPS.  
- [ ] **ORGANIC block:** Total Order − Ad Order, Total Sale Value − Ads Order Value.  
- [ ] **OVERALL block:** From TOTAL-CITY-WISE SALE; Total Order, Total Sale Value, AOV, ROI, CPS; optional total sale vs target.  
- [ ] **Campaign Type table:** Rows SD, SP, SB from respective sources; same 7 columns as ADS.  
- [ ] **Overall Product Performance table:** From TOTAL-CITY-WISE SALE (product, category, subcategory, GMV, qty, contribution %); WoW/MoM from prior period; optional View to Order from SP-AD.  
- [ ] **City-Wise Sale matrix:** Pivot of TOTAL-CITY-WISE SALE by product × city (units).  
- [ ] **Date range filter** applied to all relevant tabs (especially TOTAL-CITY-WISE SALE and ad data if dated).  
- [ ] **Brand filter** where applicable (BrandID/BrandName in ad tabs).

Once these are in place, the MAIN-1 dashboard can be created and kept in sync with the four source tabs.
