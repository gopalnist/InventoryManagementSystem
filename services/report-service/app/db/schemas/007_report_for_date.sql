-- Add report_for_date to report_uploads: "for which date" this report is (user-provided at upload).
-- uploaded_at = when the file was uploaded; report_for_date = for which date the report data is.
ALTER TABLE report_uploads
  ADD COLUMN IF NOT EXISTS report_for_date DATE;

COMMENT ON COLUMN report_uploads.report_for_date IS 'Date for which the report is (user-specified at upload). uploaded_at = when uploaded.';
