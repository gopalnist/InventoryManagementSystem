-- Remove duplicate Amazon sales rows: keep one row per
-- (tenant_id, report_date, product_identifier, product_name, quantity, total_amount)
-- and delete the rest (e.g. from a second upload of the same file).

BEGIN;

-- Delete duplicate Amazon rows (keep the one with smallest id per group)
DELETE FROM sales_reports a
USING sales_reports b
WHERE a.channel = 'amazon'
  AND a.tenant_id = b.tenant_id
  AND a.report_date = b.report_date
  AND (a.product_identifier IS NOT DISTINCT FROM b.product_identifier)
  AND (a.product_name IS NOT DISTINCT FROM b.product_name)
  AND a.quantity = b.quantity
  AND (a.total_amount IS NOT DISTINCT FROM b.total_amount)
  AND a.id > b.id;

-- Show how many Amazon sales rows remain
SELECT COUNT(*) AS amazon_sales_rows_remaining FROM sales_reports WHERE channel = 'amazon';

COMMIT;
