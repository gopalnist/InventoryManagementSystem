# Amazon Ads Report – Where to Upload

**File:** `excelsheet/Amazon/Ads/Campaign_Mar_15_2026.csv` (or any Amazon campaign ads CSV/Excel from Seller Central)

---

## Where to upload

**Reports → Ads Report** (not Main Dashboard).

1. Go to **Reports → Ads Report** in the UI.
2. Choose **Ad Source:** **Amazon Advertising**.
3. Select the file (e.g. `Campaign_Mar_15_2026.csv`).
4. Click **Upload Report**.

---

## Why not Main Dashboard?

- **Main Dashboard** upload is only for the **Weekly Report** workbook (the 5 tabs: TOTAL-CITY-WISE SALE, AD-CITY LEVEL DATA, AD-CATEGORY PERFORMANCE, SP-AD, SB-AD).
- **Amazon Ads** is a separate channel/source. It goes in **Reports → Ads Report** with Ad Source **Amazon Advertising**, so it is stored in the same `ads_reports` table but with `channel = 'amazon_ads'`.

---

## What gets mapped

| CSV column     | DB column (ads_reports) |
|----------------|--------------------------|
| Campaign name  | campaign_name            |
| Type           | campaign_type            |
| Clicks         | clicks                   |
| Total cost     | spend                    |
| Sales          | sales                    |
| ROAS           | roas                     |
| ACOS           | acos                     |
| Purchases      | orders                   |
| (no impressions in file) | impressions = 0 or null |

---

## Summary

| File / source        | Upload from                    |
|----------------------|--------------------------------|
| Amazon Ads CSV/Excel | **Reports → Ads Report** → Ad Source **Amazon Advertising** |
| Weekly Report ads tabs | **Main Dashboard** → Upload data → sections 2–5 |
