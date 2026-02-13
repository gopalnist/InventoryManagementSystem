-- ============================================================================
-- FULFILLMENT CENTERS MASTER DATA
-- ============================================================================
-- Stores fulfillment center/warehouse locations for different platforms
-- (Amazon FCs, Zepto dark stores, Blinkit warehouses, etc.)

CREATE TABLE IF NOT EXISTS fulfillment_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identification
    code VARCHAR(20) NOT NULL,                   -- 'BLR4', 'HKA2', 'HMH4'
    name VARCHAR(200) NOT NULL,                  -- 'BENGALURU, KARNATAKA'
    full_name VARCHAR(500),                      -- 'BLR4 - BENGALURU, KARNATAKA'
    
    -- Platform association
    platform VARCHAR(50) NOT NULL DEFAULT 'amazon',  -- 'amazon', 'zepto', 'blinkit', 'instamart', 'bigbasket'
    
    -- Address
    address_line1 VARCHAR(500),
    address_line2 VARCHAR(500),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    pincode VARCHAR(20),
    
    -- Contact
    contact_name VARCHAR(200),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(200),
    
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    -- Constraints
    UNIQUE(tenant_id, code, platform)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fc_tenant ON fulfillment_centers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fc_tenant_active ON fulfillment_centers(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_fc_platform ON fulfillment_centers(tenant_id, platform);
CREATE INDEX IF NOT EXISTS idx_fc_code ON fulfillment_centers(tenant_id, code);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_fulfillment_centers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fulfillment_centers_updated_at ON fulfillment_centers;
CREATE TRIGGER trg_fulfillment_centers_updated_at
    BEFORE UPDATE ON fulfillment_centers
    FOR EACH ROW
    EXECUTE FUNCTION update_fulfillment_centers_updated_at();

-- ============================================================================
-- SEED DATA: Common Amazon Fulfillment Centers in India
-- ============================================================================
-- Note: This will be inserted only if the demo tenant exists

DO $$
DECLARE
    demo_tenant_id UUID;
BEGIN
    -- Get demo tenant ID
    SELECT id INTO demo_tenant_id FROM tenants WHERE name = 'Demo Tenant' LIMIT 1;
    
    IF demo_tenant_id IS NOT NULL THEN
        -- Insert Amazon FCs if not exists
        INSERT INTO fulfillment_centers (tenant_id, code, name, full_name, platform, city, state)
        VALUES
            (demo_tenant_id, 'BLR4', 'BENGALURU, KARNATAKA', 'BLR4 - BENGALURU, KARNATAKA', 'amazon', 'Bengaluru', 'Karnataka'),
            (demo_tenant_id, 'HKA2', 'BENGALURU, KARNATAKA', 'HKA2 - BENGALURU, KARNATAKA', 'amazon', 'Bengaluru', 'Karnataka'),
            (demo_tenant_id, 'HBL4', 'Kolar, KARNATAKA', 'HBL4 - Kolar, KARNATAKA', 'amazon', 'Kolar', 'Karnataka'),
            (demo_tenant_id, 'HMH4', 'Kalyan, Maharashtra', 'HMH4 - Kalyan, Maharashtra', 'amazon', 'Kalyan', 'Maharashtra'),
            (demo_tenant_id, 'HMU5', 'BHIWANDI, MAHARASHTRA', 'HMU5 - BHIWANDI, MAHARASHTRA', 'amazon', 'Bhiwandi', 'Maharashtra'),
            (demo_tenant_id, 'HDL2', 'Sonepat, HARYANA', 'HDL2 - Sonepat, HARYANA', 'amazon', 'Sonepat', 'Haryana'),
            (demo_tenant_id, 'HHR7', 'Sonipat, HARYANA', 'HHR7 - Sonipat, HARYANA', 'amazon', 'Sonipat', 'Haryana'),
            (demo_tenant_id, 'HNR4', 'Dadri Toe, HARYANA', 'HNR4 - Dadri Toe, HARYANA', 'amazon', 'Dadri', 'Haryana'),
            (demo_tenant_id, 'HCC2', 'West Bengal - Hooghly, WEST BENGAL', 'HCC2 - West Bengal - Hooghly, WEST BENGAL', 'amazon', 'Hooghly', 'West Bengal'),
            (demo_tenant_id, 'HCC5', 'KOLKATA, WEST BENGAL', 'HCC5 - KOLKATA, WEST BENGAL', 'amazon', 'Kolkata', 'West Bengal')
        ON CONFLICT (tenant_id, code, platform) DO NOTHING;
    END IF;
END $$;




