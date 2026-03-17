-- ============================================================================
-- Weekly Report / Main Dashboard - New columns for ads_reports and sales_reports
-- ============================================================================
-- Run after 001_reports_init.sql
-- ============================================================================

BEGIN;

-- ads_reports: support AD-CITY, AD-CATEGORY, SP-AD, SB-AD (city, campaign_type, orders, category)
ALTER TABLE ads_reports
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS orders INTEGER,
  ADD COLUMN IF NOT EXISTS category VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_ads_reports_campaign_type ON ads_reports(campaign_type);
CREATE INDEX IF NOT EXISTS idx_ads_reports_city ON ads_reports(city);

-- sales_reports: optional columns for MAIN-1 product/category analytics (TOTAL-CITY-WISE SALE)
ALTER TABLE sales_reports
  ADD COLUMN IF NOT EXISTS sku_category VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sku_sub_category VARCHAR(255),
  ADD COLUMN IF NOT EXISTS brand_name VARCHAR(255);

COMMIT;
