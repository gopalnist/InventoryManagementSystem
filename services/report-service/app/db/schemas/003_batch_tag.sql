-- ============================================================================
-- Add batch_tag to report_uploads so you can filter data by upload batch/source
-- ============================================================================
-- e.g. tag uploads as "Weekly Report Feb 2026" and view only that batch on Main Dashboard
-- ============================================================================

BEGIN;

ALTER TABLE report_uploads
  ADD COLUMN IF NOT EXISTS batch_tag VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_report_uploads_batch_tag ON report_uploads(batch_tag);

COMMIT;
