-- ============================================================================
-- 008: TRAFFIC REPORTS (e.g. Amazon Traffic / Featured Offer Page Views)
-- ============================================================================
-- Amazon Traffic files: ASIN, Product Title, Brand, Featured Offer Page Views.
-- report_date comes from Viewing Range in row 0 (single day).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS traffic_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES report_uploads(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,

    report_date DATE NOT NULL,
    product_identifier VARCHAR(255),
    product_name TEXT,
    brand VARCHAR(255),
    page_views INTEGER NOT NULL DEFAULT 0,

    raw_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_traffic_reports_tenant_date ON traffic_reports(tenant_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_reports_channel ON traffic_reports(channel);
CREATE INDEX IF NOT EXISTS idx_traffic_reports_upload ON traffic_reports(upload_id);
CREATE INDEX IF NOT EXISTS idx_traffic_reports_product ON traffic_reports(product_identifier);
CREATE INDEX IF NOT EXISTS idx_traffic_reports_raw_data ON traffic_reports USING GIN(raw_data);

COMMIT;
