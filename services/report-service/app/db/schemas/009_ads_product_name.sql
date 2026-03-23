-- ============================================================================
-- Add product_name column to ads_reports
-- ============================================================================
-- Run after 008_traffic_reports.sql
-- ============================================================================

BEGIN;

ALTER TABLE ads_reports
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(500);

COMMIT;
