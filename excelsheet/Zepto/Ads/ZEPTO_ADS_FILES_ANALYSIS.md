# Zepto Ads – Analysis of All Files in `excelsheet/Zepto/Ads/`

All files are **Excel (.xlsx)** with a single sheet **Sheet1**. Below: actual columns, mapping to `ads_reports`, and whether to upload.

---

## 1. Campaign Level Performance.xlsx

| Column in file | Maps to ads_reports | Notes |
|----------------|---------------------|--------|
| CampaignName | campaign_name | ✅ (fallback in code) |
| CampaignType | campaign_type | ✅ |
| Clicks | clicks | ✅ |
| Impressions | impressions | ✅ |
| Orders | orders | ✅ |
| Spend | spend | ✅ |
| Revenue | sales | ✅ |
| Roas | roas | ✅ |
| BrandID, BrandName, Atc, Cpc, Cpm, Daily_budget, etc. | — | Stored in raw_data |

**Verdict:** ✅ **Upload** — Full fit. Use **Reports → Ads Report**, Ad Source **Zepto**.

---

## 2. Category Performance.xlsx

| Column in file | Maps to ads_reports | Notes |
|----------------|---------------------|--------|
| Campaign_name | campaign_name | ✅ |
| Category | category | ✅ |
| Clicks, Impressions, Orders, Spend, Revenue, Roas | ✅ | Same as above |
| BrandID, BrandName, Campaign_id, etc. | — | raw_data |

**Verdict:** ✅ **Upload** — Full fit. Use **Reports → Ads Report**, Ad Source **Zepto**.

---

## 3. City_Level Performance.xlsx

| Column in file | Maps to ads_reports | Notes |
|----------------|---------------------|--------|
| CityName | city | ✅ |
| Clicks, Impressions, Orders, Spend, Revenue, Roas | ✅ | Same as above |
| BrandID, BrandName, etc. | — | raw_data |

**Verdict:** ✅ **Upload** — Full fit. Use **Reports → Ads Report**, Ad Source **Zepto**.

---

## 4. Keyword Performance.xlsx

| Column in file | Maps to ads_reports | Notes |
|----------------|---------------------|--------|
| Campaign_name | campaign_name | ✅ |
| Clicks, Impressions, Orders, Spend, Revenue, Roas | ✅ | Same as above |
| KeywordName, KeywordMatchType | — | No DB column; in raw_data only |

**Verdict:** ✅ **Upload** — Core metrics fit; keyword data in raw_data. Use **Reports → Ads Report**, Ad Source **Zepto**.

---

## 5. Overview.xlsx

| Column in file | Maps to ads_reports | Notes |
|----------------|---------------------|--------|
| Date | report_date | ✅ |
| Spends | spend | ✅ (fallback "Spends" added in code) |
| BrandID, BrandName | — | raw_data |

**Verdict:** ✅ **Upload** — Date + spend only; other metrics will be 0/null. Use **Reports → Ads Report**, Ad Source **Zepto**.

---

## 6. Page Level Performance.xlsx

| Column in file | Maps to ads_reports | Notes |
|----------------|---------------------|--------|
| PageName | campaign_name | ✅ (fallback in code so row has a label) |
| Clicks, Impressions, Orders, Spend, Revenue, Roas | ✅ | Same as above |
| BrandID, BrandName, etc. | — | raw_data |

**Verdict:** ✅ **Upload** — Core metrics fit; page name stored as campaign_name. Use **Reports → Ads Report**, Ad Source **Zepto**.

---

## 7. Performance.xlsx

| Column in file | Maps to ads_reports | Notes |
|----------------|---------------------|--------|
| Date | report_date | ✅ |
| Ctr | — | In raw_data only; no ctr column in ads_reports |
| BrandID, BrandName | — | raw_data |

**Verdict:** ⚠️ **Optional** — Only date + CTR; no spend/sales/orders. Rows will have mostly null/0. Upload only if you need this in raw_data.

---

## 8. Product Level Performance.xlsx

| Column in file | Maps to ads_reports | Notes |
|----------------|---------------------|--------|
| ProductID | product_identifier | ✅ |
| ProductName | product_name | ✅ |
| Campaign_name | campaign_name | ✅ |
| Category | category | ✅ |
| Clicks, Impressions, Orders, Spend, Revenue, Roas | ✅ | Same as above |
| BrandID, BrandName, etc. | — | raw_data |

**Verdict:** ✅ **Upload** — Best fit for product-level ads. Use **Reports → Ads Report**, Ad Source **Zepto**.

---

## 9. Traffic.xlsx

| Column in file | Maps to ads_reports | Notes |
|----------------|---------------------|--------|
| Date | report_date | ✅ |
| Impressions_per_thousand | impressions | ✅ (fallback in code) |
| BrandID, BrandName | — | raw_data |

**Verdict:** ⚠️ **Optional** — Traffic-style data (no Spend/Revenue/Clicks). Spend/sales/clicks will be 0. Upload only if you want this in DB; otherwise skip.

---

## Summary

| File | Recommended | Where to upload |
|------|-------------|------------------|
| Campaign Level Performance.xlsx | ✅ Yes | Reports → Ads Report, Zepto |
| Category Performance.xlsx | ✅ Yes | Reports → Ads Report, Zepto |
| City_Level Performance.xlsx | ✅ Yes | Reports → Ads Report, Zepto |
| Keyword Performance.xlsx | ✅ Yes | Reports → Ads Report, Zepto |
| Overview.xlsx | ✅ Yes | Reports → Ads Report, Zepto |
| Page Level Performance.xlsx | ✅ Yes | Reports → Ads Report, Zepto |
| Product Level Performance.xlsx | ✅ Yes | Reports → Ads Report, Zepto |
| Performance.xlsx | Optional | Reports → Ads Report, Zepto (date + CTR only) |
| Traffic.xlsx | Optional | Reports → Ads Report, Zepto (traffic-style) |

**Required:** None. Upload the files you need for reporting.

**Backend:** Zepto ads mapping and fallbacks support all column names above (CampaignName, Campaign_name, Spends, Impressions_per_thousand, PageName, etc.). Upload each file **separately** in **Reports → Ads Report** with Ad Source **Zepto**.
