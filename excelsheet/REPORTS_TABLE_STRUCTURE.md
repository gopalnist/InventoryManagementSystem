# Report Service – Database Table Structure

All report tables live in the report service DB. Migrations: `001_reports_init.sql` → `002_weekly_report_columns.sql` → `003_batch_tag.sql` → `004_allow_negative_sales.sql` → `005_allow_negative_all_tables.sql`.

---

## 1. `tenants`

| Column   | Type | Description |
|----------|------|-------------|
| id       | UUID | Primary key. Default tenant: `00000000-0000-0000-0000-000000000001`. |

---

## 2. `report_channel_configs`

Stores column mappings per tenant, channel, and report type.

| Column         | Type    | Description |
|----------------|---------|-------------|
| id             | UUID    | Primary key (default `gen_random_uuid()`). |
| tenant_id      | UUID    | FK → tenants(id). |
| channel        | VARCHAR(50) | e.g. zepto, flipkart, weekly_report. |
| report_type    | VARCHAR(50) | sales, inventory, po, profit_loss, ads. |
| column_mapping | JSONB   | Maps channel columns to standard fields. |
| is_active      | BOOLEAN | Default true. |
| created_at     | TIMESTAMP | |
| updated_at     | TIMESTAMP | |
| UNIQUE(tenant_id, channel, report_type) | | |

---

## 3. `report_uploads`

One row per uploaded file.

| Column          | Type      | Description |
|-----------------|-----------|-------------|
| id             | UUID      | Primary key. |
| tenant_id      | UUID      | FK → tenants(id). |
| channel        | VARCHAR(50) | |
| report_type    | VARCHAR(50) | sales, inventory, po, profit_loss, ads. |
| file_name      | VARCHAR(255) | |
| file_size      | BIGINT    | |
| total_rows     | INTEGER   | |
| processed_rows | INTEGER   | Default 0. |
| failed_rows    | INTEGER   | Default 0. |
| status         | VARCHAR(20) | processing, completed, failed, partial. |
| uploaded_by    | UUID      | Optional. |
| uploaded_at    | TIMESTAMP | |
| processed_at   | TIMESTAMP | |
| error_message  | TEXT      | |
| metadata       | JSONB    | |
| **batch_tag**  | VARCHAR(255) | *(002/003)* Optional; filter Main Dashboard by batch. |

Indexes: tenant_id, (channel, report_type), uploaded_at DESC, batch_tag.

---

## 4. `sales_reports`

One row per sales line (e.g. per SKU/date/city).

| Column             | Type         | Description |
|--------------------|--------------|-------------|
| id                 | UUID         | Primary key. |
| tenant_id          | UUID         | FK → tenants(id). |
| upload_id          | UUID         | FK → report_uploads(id), nullable. |
| channel            | VARCHAR(50)  | |
| report_date        | DATE         | |
| product_identifier | VARCHAR(255) | SKU / EAN / etc. |
| product_name       | TEXT         | |
| quantity           | DECIMAL(15,3) | Units sold. |
| unit_price         | DECIMAL(15,2) | |
| total_amount       | DECIMAL(15,2) | GMV. |
| city               | VARCHAR(100) | |
| location           | VARCHAR(255) | |
| **sku_category**   | VARCHAR(255) | *(002)* From TOTAL-CITY-WISE SALE. |
| **sku_sub_category** | VARCHAR(255) | *(002)* |
| **brand_name**     | VARCHAR(255) | *(002)* |
| raw_data           | JSONB        | Original row. |
| created_at         | TIMESTAMP    | |

Indexes: (tenant_id, report_date), channel, upload_id, product_identifier, raw_data (GIN).

---

## 5. `inventory_reports`

| Column             | Type         | Description |
|--------------------|--------------|-------------|
| id                 | UUID         | Primary key. |
| tenant_id          | UUID         | FK → tenants(id). |
| upload_id          | UUID         | FK → report_uploads(id), nullable. |
| channel            | VARCHAR(50)  | |
| report_date        | DATE         | |
| product_identifier | VARCHAR(255) | |
| product_name       | TEXT         | |
| quantity           | DECIMAL(15,3) | |
| city               | VARCHAR(100) | |
| location           | VARCHAR(255) | |
| warehouse_code     | VARCHAR(100) | |
| raw_data           | JSONB        | |
| created_at         | TIMESTAMP    | |

Indexes: (tenant_id, report_date), channel, upload_id, product_identifier, raw_data (GIN).

---

## 6. `po_reports` (Purchase Orders)

| Column             | Type         | Description |
|--------------------|--------------|-------------|
| id                 | UUID         | Primary key. |
| tenant_id          | UUID         | FK → tenants(id). |
| upload_id          | UUID         | FK → report_uploads(id), nullable. |
| channel            | VARCHAR(50)  | |
| po_number          | VARCHAR(255) | |
| po_date            | DATE         | |
| status             | VARCHAR(50)  | e.g. ASN_CREATED, GRN_DONE. |
| vendor_code        | VARCHAR(100) | |
| vendor_name        | VARCHAR(255) | |
| product_identifier | VARCHAR(255) | |
| product_name       | TEXT         | |
| quantity           | DECIMAL(15,3) | |
| unit_cost          | DECIMAL(15,2) | |
| landing_cost       | DECIMAL(15,2) | |
| total_amount       | DECIMAL(15,2) | |
| location           | VARCHAR(255) | |
| asn_quantity       | DECIMAL(15,3) | |
| grn_quantity       | DECIMAL(15,3) | |
| expiry_date        | DATE         | |
| raw_data           | JSONB        | |
| created_at         | TIMESTAMP    | |

Indexes: (tenant_id, po_number), channel, upload_id, po_date, status, raw_data (GIN).

---

## 7. `profit_loss_reports`

| Column             | Type         | Description |
|--------------------|--------------|-------------|
| id                 | UUID         | Primary key. |
| tenant_id          | UUID         | FK → tenants(id). |
| upload_id          | UUID         | FK → report_uploads(id), nullable. |
| channel            | VARCHAR(50)  | |
| report_date        | DATE         | |
| product_identifier | VARCHAR(255) | |
| product_name       | TEXT         | |
| revenue            | DECIMAL(15,2) | |
| cost_of_goods_sold | DECIMAL(15,2) | |
| gross_profit       | DECIMAL(15,2) | |
| operating_expenses | DECIMAL(15,2) | |
| net_profit         | DECIMAL(15,2) | |
| quantity_sold      | DECIMAL(15,3) | |
| raw_data           | JSONB        | |
| created_at         | TIMESTAMP    | |

Indexes: (tenant_id, report_date), channel, upload_id, raw_data (GIN).

---

## 8. `ads_reports`

| Column             | Type         | Description |
|--------------------|--------------|-------------|
| id                 | UUID         | Primary key. |
| tenant_id          | UUID         | FK → tenants(id). |
| upload_id          | UUID         | FK → report_uploads(id), nullable. |
| channel            | VARCHAR(50)  | |
| report_date        | DATE         | |
| campaign_name      | VARCHAR(255) | |
| ad_group           | VARCHAR(255) | |
| product_identifier | VARCHAR(255) | For SP/SB product performance. |
| impressions        | INTEGER      | |
| clicks             | INTEGER      | |
| spend              | DECIMAL(15,2) | |
| sales              | DECIMAL(15,2) | Revenue. |
| roas               | DECIMAL(10,4) | |
| acos               | DECIMAL(10,4) | |
| **city**           | VARCHAR(100) | *(002)* AD-CITY. |
| **campaign_type**  | VARCHAR(20)  | *(002)* SP, SB, SD. |
| **orders**         | INTEGER      | *(002)* |
| **category**       | VARCHAR(255) | *(002)* |
| raw_data           | JSONB        | |
| created_at         | TIMESTAMP    | |

Indexes: (tenant_id, report_date), channel, upload_id, campaign_name, campaign_type, city, raw_data (GIN).

---

## Summary

| Table                   | Purpose |
|-------------------------|--------|
| tenants                 | Tenant IDs. |
| report_channel_configs  | Column mappings per channel/report type. |
| report_uploads          | Upload metadata + batch_tag. |
| sales_reports           | Sales lines (TOTAL-CITY-WISE SALE, etc.). |
| inventory_reports       | Inventory snapshots. |
| po_reports              | Purchase orders. |
| profit_loss_reports     | P&amp;L. |
| ads_reports             | Ad metrics (AD-CITY, AD-CATEGORY, SP-AD, SB-AD). |

Columns in **bold** were added in migrations 002/003 (weekly report / Main Dashboard).
