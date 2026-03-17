# Where to Upload Data for the Main Dashboard

The **Main Dashboard** (MAIN-1) is built from data you upload in **one place** in the UI. Each tab/source is uploaded **separately**.

---

## Main Dashboard vs Ads Report — which UI to use?

| Your file / Excel sheets | Where to upload |
|--------------------------|-----------------|
| **Weekly Report Excel** (e.g. `WEEKLY REPORT _- Nourishyou.xlsx`) with sheets: **MAIN-1**, **TOTAL-CITY-WISE SALE**, **AD-CITY LEVEL DATA**, **AD-CATEGORY PERFORMANCE**, **SP-AD-PRODUCT PERFORMANCE**, **SB-AD-PRODUCT PERFORMANCE** | **Reports → Main Dashboard** → click **Upload data** → use the 5 sections in the drawer. Upload **one file per section** (you can export each sheet to a separate Excel/CSV and upload, or upload the same file and pick the right section for each sheet). |
| **Other ads reports**: Zepto ads Excel/CSV, **Amazon Ads** (e.g. `excelsheet/Amazon/Ads/Campaign_*.csv`), Google Ads export, etc. (standalone files, not the Weekly Report tabs above) | **Reports → Ads Report** → upload there and choose the **Ad Source** (e.g. Zepto, **Amazon Advertising**, Google Ads). |
| **Sales / Inventory / PO** from Zepto, Amazon, etc. (not the Weekly Report TOTAL-CITY-WISE SALE tab) | **Reports → Sales Report**, **Reports → Inventory Report**, or **Reports → PO Report** → upload and choose the channel. |

**Summary:**  
- **Main Dashboard upload** = only for the **Weekly Report** workbook. Use it to feed the MAIN-1 dashboard (the 5 sections: city-wise sale, AD-CITY, AD-CATEGORY, SP-AD, SB-AD).  
- **Ads Report page** = for **other** ads files (Zepto ads, Amazon ads, etc.). Those do **not** go into the Main Dashboard upload drawer.

**How ads data gets loaded:**

- **If the ads Excel sheets are from your Weekly Report file** (tabs: AD-CITY LEVEL DATA, AD-CATEGORY PERFORMANCE, SP-AD PRODUCT PERFORMANCE, SB-AD PRODUCT PERFORMANCE) → upload them from **Main Dashboard** → **Upload data** → open the matching section (AD-CITY LEVEL DATA, AD-CATEGORY PERFORMANCE, SP-AD PRODUCT PERFORMANCE, SB-AD PRODUCT PERFORMANCE) and upload the file/sheet. One upload per section.
- **If the ads file is a separate export** (e.g. Zepto ads, Amazon Advertising report, Google Ads) → upload from **Reports → Ads Report** and select the correct Ad Source (Zepto, Amazon Advertising, etc.).

So: **more than one Excel sheet for ads** → use **Main Dashboard** only when those sheets are the 4 ads tabs of the Weekly Report. Any other ads file → use **Ads Report** page.

---

## 1. Where in the UI

- Go to **Reports → Main Dashboard** (`/ims/reports/main-dashboard`).
- Click **Upload data** (top right).
- A drawer opens with **5 upload sections**. Use the section that matches your file:

| # | Section in the drawer | What to upload | When to use |
|---|------------------------|----------------|-------------|
| 1 | **TOTAL-CITY-WISE SALE** | File with columns: Date, SKU Number, SKU Name, City, Sales (Qty) - Units, Gross Merchandise Value, etc. | Sales by date/SKU/city (e.g. from Zepto/portal). |
| 2 | **AD-CITY LEVEL DATA** | File with columns: CityName, Spend, Orders, Revenue, Roas, Clicks, Impressions, etc. | City-level ad metrics. |
| 3 | **AD-CATEGORY PERFORMANCE** | File with: Campaign_name, Category, Orders, Spend, Revenue, Roas, etc. (SB). | Category/campaign (Sponsored Brand) performance. |
| 4 | **SP-AD PRODUCT PERFORMANCE** | File with: ProductID, ProductName, Campaign_name, Category, Orders, Spend, Revenue, etc. | Sponsored Products by product. |
| 5 | **SB-AD PRODUCT PERFORMANCE** | File with: ProductID, ProductName, Campaign_name, Category, Orders, Spend, Revenue, etc. | Sponsored Brand by product. |

- For each file: expand the matching section, choose the file, click **Upload**.  
- All uploads use channel **Weekly Report** and the correct **data type** (handled by the section you pick). You do **not** select channel or data type yourself.

---

## 2. Summary

| Tab / source | Where to upload in UI |
|--------------|------------------------|
| TOTAL-CITY-WISE SALE | Reports → Main Dashboard → Upload data → **TOTAL-CITY-WISE SALE** |
| AD-CITY LEVEL DATA | Reports → Main Dashboard → Upload data → **AD-CITY LEVEL DATA** |
| AD-CATEGORY PERFORMANCE | Reports → Main Dashboard → Upload data → **AD-CATEGORY PERFORMANCE** |
| SP-AD PRODUCT PERFORMANCE | Reports → Main Dashboard → Upload data → **SP-AD PRODUCT PERFORMANCE** |
| SB-AD PRODUCT PERFORMANCE | Reports → Main Dashboard → Upload data → **SB-AD PRODUCT PERFORMANCE** |

---

## 3. DB connection and migrations

The report service connects to PostgreSQL using env vars: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.

- **Default in code:** `DB_HOST=localhost`, `DB_PORT=5441`, `DB_NAME=ams_db`, `DB_USER=postgres`, `DB_PASSWORD=mypassword`
- If your Postgres is on port **5432** or a different database, set these (e.g. in a `.env` in `services/report-service/` or in the shell before starting the service).

**Run migrations in order** (so that the `tenants` table and report tables exist):

```bash
# 1) Create report tables and tenants (if not already done)
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f services/report-service/app/db/schemas/001_reports_init.sql

# 2) Add columns for Main Dashboard (weekly report)
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f services/report-service/app/db/schemas/002_weekly_report_columns.sql

# 3) Add batch_tag for filtering by upload batch (optional)
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f services/report-service/app/db/schemas/003_batch_tag.sql

# 4) Allow negative quantity/total_amount (returns/refunds) in sales_reports
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f services/report-service/app/db/schemas/004_allow_negative_sales.sql

# 5) Allow negative where applicable: inventory quantity, PO quantity/amount, ads spend
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f services/report-service/app/db/schemas/005_allow_negative_all_tables.sql
```

Example if your DB is on port 5432 and database is `ims_db`:

```bash
psql -h localhost -U postgres -d ims_db -f services/report-service/app/db/schemas/001_reports_init.sql
psql -h localhost -U postgres -d ims_db -f services/report-service/app/db/schemas/002_weekly_report_columns.sql
```

Then start the report service with the same DB settings (e.g. `DB_PORT=5432 DB_NAME=ims_db` if needed).

---

## 4. Backup and clean report data

**Backup** (saves report tables to a timestamped SQL file):

```bash
# From project root. Uses same DB as report-service (override with DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
./scripts/backup_report_data.sh
# Backup saved to: scripts/backups/report_data_YYYYMMDD_HHMMSS.sql
```

**Clean** (delete all report data; schema stays):

```bash
PGPASSWORD=mypassword psql -h localhost -p 5441 -U postgres -d ams_db -f scripts/wipe_report_data.sql
```

After cleaning, upload fresh files (e.g. from `WEEKLY REPORT _- Nourishyou (1) (1).xlsx` per tab).

---

## 5. Script: upload entire Weekly Report Excel with one batch tag

From the project root, with the **report service running** (e.g. port 8005):

```bash
# Default: uses excelsheet/WEEKLY REPORT _- Nourishyou (1) (1).xlsx and batch tag "Nourishyou-Weekly-M"
python scripts/upload_weekly_report_tabs.py

# Custom Excel path and batch tag
python scripts/upload_weekly_report_tabs.py "path/to/your/weekly_report.xlsx" "My-Batch-Tag"

# Custom report service URL
python scripts/upload_weekly_report_tabs.py "excelsheet/WEEKLY REPORT _- Nourishyou (1) (1).xlsx" "Nourishyou-Weekly-M" --base-url http://localhost:8005
```

This uploads each tab (TOTAL-CITY-WISE SALE, AD-CITY LEVEL DATA, AD-CATEGORY PERFORMANCE, SP-AD-PRODUCT PERFORMANCE, SB-AD-PRODUCT PERFORMANCE) with the same batch tag. Then on the Main Dashboard, select that batch tag to see only this data.

---

## 6. View data by batch (batch tag)

You can keep multiple upload batches and switch which one the dashboard shows:

1. **When uploading:** In the Main Dashboard upload drawer, set **Batch tag** (e.g. `Weekly Report Feb 2026`) and use the same tag for all 5 tab uploads. That group becomes one “batch”.
2. **When viewing:** On the Main Dashboard, use the **“All batches”** dropdown and select a batch tag. The dashboard shows only data from uploads with that tag.
3. **“All batches”** = show all data (no filter).
