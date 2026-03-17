# Zepto Ads – Which Sheets to Upload

If your Zepto ads export is **one Excel file with multiple sheets** (Campaign, Category, City, Keyword Performance, Page Level Performance, Product Level Performance, Traffic Performance), here’s how they map to the report service and what to upload.

---

## How upload works today

- **One upload = one sheet.** The report service reads **only the first sheet** of an Excel file.
- So for each sheet you want to load, either:
  - **Option A:** Save each sheet as a **separate Excel or CSV** and upload each file in **Reports → Ads Report** (channel: Zepto), or  
  - **Option B:** Upload the same multi-sheet Excel multiple times **after changing which sheet is first** (not practical).

**Recommended:** Export each sheet to its own file (e.g. “Zepto_Ads_Campaign.xlsx”, “Zepto_Ads_City.xlsx”, …) and upload each file once in **Reports → Ads Report** with Ad Source **Zepto**.

---

## Sheet-by-sheet analysis

| Sheet name (typical) | Fits ads_reports? | Recommended to upload? | Notes |
|----------------------|-------------------|------------------------|--------|
| **Campaign** (Campaign level performance) | ✅ Yes | **Yes** | Campaign name, spend, revenue, clicks, impressions, ROAS, etc. Map well to `ads_reports`. |
| **Category** (Category performance) | ✅ Yes | **Yes** | Category, campaign, spend, revenue, orders. We have `category` and other columns. |
| **City** (City level performance) | ✅ Yes | **Yes** | City, spend, revenue, orders, etc. We have `city` and ad metrics. |
| **Product level performance** | ✅ Yes | **Yes** | Product ID/name, category, campaign, spend, revenue. Best for product-level ads analytics. |
| **Keyword performance** | ⚠️ Partial | Optional | Usually keyword, campaign, clicks, spend. No `keyword` column in DB; stored in `raw_data` only. Still useful for reporting if you want it. |
| **Page level performance** | ⚠️ Partial | Optional | Page/URL level. No dedicated columns; stored in `raw_data`. Upload if you need page-level data. |
| **Traffic** / Traffic performance | ❌ Different data | **No** | Usually site/app traffic (sessions, page views), not ad spend/sales. Does not match `ads_reports` (which is for ad campaigns). Skip for ads upload. |

---

## Required vs optional

- **None of the sheets are required** for the system to work.
- **What to upload depends on what you need:**
  - **Minimum useful set:** **Campaign** + **Product level** (campaign and product-level ads).
  - **Add City** if you need city-wise ad performance.
  - **Add Category** if you need category-wise ad performance.
  - **Keyword / Page level** are optional (data goes to `raw_data`).
  - **Traffic** is not for ads; don’t use it for Zepto ads upload.

---

## Summary

| Upload? | Sheets |
|--------|--------|
| **Yes – recommended** | Campaign, Category, City, Product level performance |
| **Optional** | Keyword performance, Page level performance |
| **No** | Traffic / Traffic performance (not ad data) |

**Where to upload:** **Reports → Ads Report** → choose Ad Source **Zepto** → upload **one file per sheet** (each file = one of the sheets above, exported as Excel or CSV).
