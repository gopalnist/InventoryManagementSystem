-- Allow negative values where applicable (adjustments, returns, credit memos, refunds).
-- Run on existing DBs that were created with the previous CHECK constraints.

-- inventory_reports: quantity can be negative (adjustments, returns)
ALTER TABLE inventory_reports DROP CONSTRAINT IF EXISTS check_inventory_quantity_positive;

-- po_reports: quantity and total_amount can be negative (credit memos, returns)
ALTER TABLE po_reports DROP CONSTRAINT IF EXISTS check_po_quantity_positive;
ALTER TABLE po_reports DROP CONSTRAINT IF EXISTS check_po_amount_positive;

-- ads_reports: spend can be negative (refunds from ad platform)
ALTER TABLE ads_reports DROP CONSTRAINT IF EXISTS check_ads_spend_positive;
