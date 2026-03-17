-- Allow negative quantity and total_amount in sales_reports (returns/refunds, e.g. ordered_revenue)
-- Run this on existing DBs that were created with the previous CHECK constraints.

ALTER TABLE sales_reports DROP CONSTRAINT IF EXISTS check_quantity_positive;
ALTER TABLE sales_reports DROP CONSTRAINT IF EXISTS check_amount_positive;
