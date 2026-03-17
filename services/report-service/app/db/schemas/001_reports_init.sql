-- ============================================================================
-- REPORTS SCHEMA - Multi-Channel Report Upload and Storage
-- ============================================================================
-- Version: 1.0
-- Description: Supports uploading and storing reports from multiple channels
--              (Zepto, Flipkart, Amazon, Blinkit, BigBasket, etc.)
--              with flexible column mapping and JSONB storage for raw data
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. TENANTS (required by report tables; create if not exists for standalone DB)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY
);
INSERT INTO tenants (id)
SELECT '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (SELECT 1 FROM tenants LIMIT 1);

-- ============================================================================
-- 1. REPORT CHANNEL CONFIGURATIONS
-- ============================================================================
-- Stores column mappings for each channel and report type combination

CREATE TABLE IF NOT EXISTS report_channel_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL, -- 'zepto', 'flipkart', 'amazon', 'blinkit', 'bigbasket', etc.
    report_type VARCHAR(50) NOT NULL, -- 'sales', 'inventory', 'po', 'profit_loss', 'ads'
    column_mapping JSONB NOT NULL, -- Maps channel columns to standard fields
    -- Example: {"date": "Date", "sku": "SKU Number", "quantity": "Sales (Qty) - Units", ...}
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, channel, report_type)
);

CREATE INDEX IF NOT EXISTS idx_report_channel_configs_tenant_channel 
    ON report_channel_configs(tenant_id, channel, report_type);

-- ============================================================================
-- 2. REPORT UPLOADS (Track all file uploads)
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
    status VARCHAR(20) DEFAULT 'processing', -- 'processing', 'completed', 'failed', 'partial'
    uploaded_by UUID, -- REFERENCES users(id) when users table exists
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    error_message TEXT,
    metadata JSONB, -- Additional metadata about the upload
    CONSTRAINT check_status CHECK (status IN ('processing', 'completed', 'failed', 'partial'))
);

CREATE INDEX IF NOT EXISTS idx_report_uploads_tenant ON report_uploads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_uploads_channel_type ON report_uploads(channel, report_type);
CREATE INDEX IF NOT EXISTS idx_report_uploads_uploaded_at ON report_uploads(uploaded_at DESC);

-- ============================================================================
-- 3. SALES REPORTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES report_uploads(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    
    -- Standardized Fields (Common across all channels)
    report_date DATE NOT NULL,
    product_identifier VARCHAR(255), -- SKU, EAN, ASIN, etc. (normalized)
    product_name TEXT,
    quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
    unit_price DECIMAL(15, 2),
    total_amount DECIMAL(15, 2),
    city VARCHAR(100),
    location VARCHAR(255), -- Warehouse, fulfillment center, etc.
    
    -- Channel-Specific Raw Data (JSONB for flexibility)
    raw_data JSONB NOT NULL, -- All original columns from the channel
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- No CHECK for quantity/total_amount: allow negative for returns/refunds (e.g. ordered_revenue)
);

CREATE INDEX IF NOT EXISTS idx_sales_reports_tenant_date ON sales_reports(tenant_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_reports_channel ON sales_reports(channel);
CREATE INDEX IF NOT EXISTS idx_sales_reports_upload ON sales_reports(upload_id);
CREATE INDEX IF NOT EXISTS idx_sales_reports_product ON sales_reports(product_identifier);
CREATE INDEX IF NOT EXISTS idx_sales_reports_raw_data ON sales_reports USING GIN(raw_data); -- For JSONB queries

-- ============================================================================
-- 4. INVENTORY REPORTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES report_uploads(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    
    -- Standardized Fields
    report_date DATE NOT NULL,
    product_identifier VARCHAR(255),
    product_name TEXT,
    quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
    city VARCHAR(100),
    location VARCHAR(255),
    warehouse_code VARCHAR(100),
    
    -- Channel-Specific Raw Data
    raw_data JSONB NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- No CHECK for quantity: allow negative for adjustments/returns
);

CREATE INDEX IF NOT EXISTS idx_inventory_reports_tenant_date ON inventory_reports(tenant_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_reports_channel ON inventory_reports(channel);
CREATE INDEX IF NOT EXISTS idx_inventory_reports_upload ON inventory_reports(upload_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reports_product ON inventory_reports(product_identifier);
CREATE INDEX IF NOT EXISTS idx_inventory_reports_raw_data ON inventory_reports USING GIN(raw_data);

-- ============================================================================
-- 5. PO REPORTS (Purchase Order Reports)
-- ============================================================================

CREATE TABLE IF NOT EXISTS po_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES report_uploads(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    
    -- Standardized Fields
    po_number VARCHAR(255) NOT NULL,
    po_date DATE,
    status VARCHAR(50), -- 'ASN_CREATED', 'GRN_DONE', 'PENDING_GRN', etc.
    vendor_code VARCHAR(100),
    vendor_name VARCHAR(255),
    product_identifier VARCHAR(255),
    product_name TEXT,
    quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
    unit_cost DECIMAL(15, 2),
    landing_cost DECIMAL(15, 2),
    total_amount DECIMAL(15, 2),
    location VARCHAR(255), -- Delivery location
    asn_quantity DECIMAL(15, 3),
    grn_quantity DECIMAL(15, 3),
    expiry_date DATE,
    
    -- Channel-Specific Raw Data
    raw_data JSONB NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- No CHECK for quantity/total_amount: allow negative for credit memos/returns
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
    
    -- Standardized Fields
    report_date DATE NOT NULL,
    product_identifier VARCHAR(255),
    product_name TEXT,
    revenue DECIMAL(15, 2),
    cost_of_goods_sold DECIMAL(15, 2),
    gross_profit DECIMAL(15, 2),
    operating_expenses DECIMAL(15, 2),
    net_profit DECIMAL(15, 2),
    quantity_sold DECIMAL(15, 3),
    
    -- Channel-Specific Raw Data
    raw_data JSONB NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profit_loss_reports_tenant_date ON profit_loss_reports(tenant_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_profit_loss_reports_channel ON profit_loss_reports(channel);
CREATE INDEX IF NOT EXISTS idx_profit_loss_reports_upload ON profit_loss_reports(upload_id);
CREATE INDEX IF NOT EXISTS idx_profit_loss_reports_raw_data ON profit_loss_reports USING GIN(raw_data);

-- ============================================================================
-- 7. ADS REPORTS (Advertising Reports)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ads_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES report_uploads(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    
    -- Standardized Fields
    report_date DATE NOT NULL,
    campaign_name VARCHAR(255),
    ad_group VARCHAR(255),
    product_identifier VARCHAR(255),
    impressions INTEGER,
    clicks INTEGER,
    spend DECIMAL(15, 2),
    sales DECIMAL(15, 2),
    roas DECIMAL(10, 4), -- Return on Ad Spend
    acos DECIMAL(10, 4), -- Advertising Cost of Sales
    
    -- Channel-Specific Raw Data
    raw_data JSONB NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- impressions/clicks are counts (>= 0); spend/sales allow negative (refunds)
    CONSTRAINT check_ads_impressions_positive CHECK (impressions >= 0),
    CONSTRAINT check_ads_clicks_positive CHECK (clicks >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ads_reports_tenant_date ON ads_reports(tenant_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_ads_reports_channel ON ads_reports(channel);
CREATE INDEX IF NOT EXISTS idx_ads_reports_upload ON ads_reports(upload_id);
CREATE INDEX IF NOT EXISTS idx_ads_reports_campaign ON ads_reports(campaign_name);
CREATE INDEX IF NOT EXISTS idx_ads_reports_raw_data ON ads_reports USING GIN(raw_data);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_report_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_report_channel_configs_updated_at
    BEFORE UPDATE ON report_channel_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_report_configs_updated_at();

COMMIT;

