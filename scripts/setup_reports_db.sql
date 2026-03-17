-- ============================================================================
-- REPORTS DATABASE - FULL SETUP (all tables in one script)
-- ============================================================================
-- Run this script on a fresh PostgreSQL database to create all report tables.
-- Usage: psql "postgresql://user:pass@host:port/dbname" -f setup_reports_db.sql
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS where needed).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. TENANTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY
);
INSERT INTO tenants (id)
SELECT '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (SELECT 1 FROM tenants LIMIT 1);

INSERT INTO tenants (id)
SELECT '00000000-0000-0000-0000-000000000002'::uuid
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE id = '00000000-0000-0000-0000-000000000002'::uuid);

-- ============================================================================
-- 1. REPORT CHANNEL CONFIGURATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS report_channel_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    column_mapping JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, channel, report_type)
);
CREATE INDEX IF NOT EXISTS idx_report_channel_configs_tenant_channel ON report_channel_configs(tenant_id, channel, report_type);

-- ============================================================================
-- 2. REPORT UPLOADS
-- ============================================================================
CREATE TABLE IF NOT EXISTS report_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    total_rows INTEGER NOT NULL,
    processed_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'processing',
    uploaded_by UUID,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    error_message TEXT,
    metadata JSONB,
    batch_tag VARCHAR(255),
    report_for_date DATE,
    CONSTRAINT check_status CHECK (status IN ('processing', 'completed', 'failed', 'partial'))
);
CREATE INDEX IF NOT EXISTS idx_report_uploads_tenant ON report_uploads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_uploads_channel_type ON report_uploads(channel, report_type);
CREATE INDEX IF NOT EXISTS idx_report_uploads_uploaded_at ON report_uploads(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_uploads_batch_tag ON report_uploads(batch_tag);

-- ============================================================================
-- 3. SALES REPORTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS sales_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES report_uploads(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    report_date DATE NOT NULL,
    product_identifier VARCHAR(255),
    product_name TEXT,
    quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
    unit_price DECIMAL(15, 2),
    total_amount DECIMAL(15, 2),
    city VARCHAR(100),
    location VARCHAR(255),
    sku_category VARCHAR(255),
    sku_sub_category VARCHAR(255),
    brand_name VARCHAR(255),
    raw_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sales_reports_tenant_date ON sales_reports(tenant_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_reports_channel ON sales_reports(channel);
CREATE INDEX IF NOT EXISTS idx_sales_reports_upload ON sales_reports(upload_id);
CREATE INDEX IF NOT EXISTS idx_sales_reports_product ON sales_reports(product_identifier);
CREATE INDEX IF NOT EXISTS idx_sales_reports_raw_data ON sales_reports USING GIN(raw_data);

-- ============================================================================
-- 4. INVENTORY REPORTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES report_uploads(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    report_date DATE NOT NULL,
    product_identifier VARCHAR(255),
    product_name TEXT,
    quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
    city VARCHAR(100),
    location VARCHAR(255),
    warehouse_code VARCHAR(100),
    raw_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inventory_reports_tenant_date ON inventory_reports(tenant_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_reports_channel ON inventory_reports(channel);
CREATE INDEX IF NOT EXISTS idx_inventory_reports_upload ON inventory_reports(upload_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reports_product ON inventory_reports(product_identifier);
CREATE INDEX IF NOT EXISTS idx_inventory_reports_raw_data ON inventory_reports USING GIN(raw_data);

-- ============================================================================
-- 5. PO REPORTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS po_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES report_uploads(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    po_number VARCHAR(255) NOT NULL,
    po_date DATE,
    status VARCHAR(50),
    vendor_code VARCHAR(100),
    vendor_name VARCHAR(255),
    product_identifier VARCHAR(255),
    product_name TEXT,
    quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
    unit_cost DECIMAL(15, 2),
    landing_cost DECIMAL(15, 2),
    total_amount DECIMAL(15, 2),
    location VARCHAR(255),
    asn_quantity DECIMAL(15, 3),
    grn_quantity DECIMAL(15, 3),
    expiry_date DATE,
    raw_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_po_reports_tenant_po ON po_reports(tenant_id, po_number);
CREATE INDEX IF NOT EXISTS idx_po_reports_channel ON po_reports(channel);
CREATE INDEX IF NOT EXISTS idx_po_reports_upload ON po_reports(upload_id);
CREATE INDEX IF NOT EXISTS idx_po_reports_date ON po_reports(po_date DESC);
CREATE INDEX IF NOT EXISTS idx_po_reports_status ON po_reports(status);
CREATE INDEX IF NOT EXISTS idx_po_reports_raw_data ON po_reports USING GIN(raw_data);

-- ============================================================================
-- 6. PROFIT & LOSS REPORTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS profit_loss_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES report_uploads(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    report_date DATE NOT NULL,
    product_identifier VARCHAR(255),
    product_name TEXT,
    revenue DECIMAL(15, 2),
    cost_of_goods_sold DECIMAL(15, 2),
    gross_profit DECIMAL(15, 2),
    operating_expenses DECIMAL(15, 2),
    net_profit DECIMAL(15, 2),
    quantity_sold DECIMAL(15, 3),
    raw_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_profit_loss_reports_tenant_date ON profit_loss_reports(tenant_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_profit_loss_reports_channel ON profit_loss_reports(channel);
CREATE INDEX IF NOT EXISTS idx_profit_loss_reports_upload ON profit_loss_reports(upload_id);
CREATE INDEX IF NOT EXISTS idx_profit_loss_reports_raw_data ON profit_loss_reports USING GIN(raw_data);

-- ============================================================================
-- 7. ADS REPORTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ads_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES report_uploads(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    report_date DATE NOT NULL,
    campaign_name VARCHAR(255),
    ad_group VARCHAR(255),
    product_identifier VARCHAR(255),
    impressions INTEGER,
    clicks INTEGER,
    spend DECIMAL(15, 2),
    sales DECIMAL(15, 2),
    roas DECIMAL(10, 4),
    acos DECIMAL(10, 4),
    city VARCHAR(100),
    campaign_type VARCHAR(20),
    orders INTEGER,
    category VARCHAR(255),
    raw_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_ads_impressions_positive CHECK (impressions >= 0),
    CONSTRAINT check_ads_clicks_positive CHECK (clicks >= 0)
);
CREATE INDEX IF NOT EXISTS idx_ads_reports_tenant_date ON ads_reports(tenant_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_ads_reports_channel ON ads_reports(channel);
CREATE INDEX IF NOT EXISTS idx_ads_reports_upload ON ads_reports(upload_id);
CREATE INDEX IF NOT EXISTS idx_ads_reports_campaign ON ads_reports(campaign_name);
CREATE INDEX IF NOT EXISTS idx_ads_reports_campaign_type ON ads_reports(campaign_type);
CREATE INDEX IF NOT EXISTS idx_ads_reports_city ON ads_reports(city);
CREATE INDEX IF NOT EXISTS idx_ads_reports_raw_data ON ads_reports USING GIN(raw_data);

-- ============================================================================
-- 8. TRAFFIC REPORTS
-- ============================================================================
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

-- ============================================================================
-- TRIGGER (report_channel_configs.updated_at)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_report_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_report_channel_configs_updated_at ON report_channel_configs;
CREATE TRIGGER update_report_channel_configs_updated_at
    BEFORE UPDATE ON report_channel_configs
    FOR EACH ROW
    EXECUTE PROCEDURE update_report_configs_updated_at();

COMMIT;

-- ============================================================================
-- DONE. Tables created: tenants, report_channel_configs, report_uploads,
-- sales_reports, inventory_reports, po_reports, profit_loss_reports,
-- ads_reports, traffic_reports.
-- ============================================================================
