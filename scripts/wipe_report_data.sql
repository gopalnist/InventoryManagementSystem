-- Wipe out all report data from the database
-- This script deletes all data from report tables but keeps the schema intact

-- Delete all report data
DELETE FROM sales_reports;
DELETE FROM inventory_reports;
DELETE FROM po_reports;
DELETE FROM ads_reports;
DELETE FROM profit_loss_reports;
DELETE FROM traffic_reports;
DELETE FROM report_uploads;

-- Reset sequences if needed (optional)
-- This ensures IDs start from 1 again
-- Note: Only works if tables have serial/sequence columns

-- Display counts to confirm deletion
SELECT 'sales_reports' as table_name, COUNT(*) as remaining_records FROM sales_reports
UNION ALL
SELECT 'inventory_reports', COUNT(*) FROM inventory_reports
UNION ALL
SELECT 'po_reports', COUNT(*) FROM po_reports
UNION ALL
SELECT 'ads_reports', COUNT(*) FROM ads_reports
UNION ALL
SELECT 'profit_loss_reports', COUNT(*) FROM profit_loss_reports
UNION ALL
SELECT 'traffic_reports', COUNT(*) FROM traffic_reports
UNION ALL
SELECT 'report_uploads', COUNT(*) FROM report_uploads;

