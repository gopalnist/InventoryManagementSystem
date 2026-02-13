-- ============================================================================
-- 005_PARTIES.SQL - Parties (Suppliers & Customers) Schema
-- ============================================================================
-- Unified table for both suppliers and customers

CREATE TABLE IF NOT EXISTS parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Basic Info
    party_code VARCHAR(50),
    party_name VARCHAR(255) NOT NULL,
    party_type VARCHAR(10) NOT NULL DEFAULT 'supplier',  -- supplier, customer, both
    
    -- Contact
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    
    -- Address
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    pincode VARCHAR(10),
    country VARCHAR(50) DEFAULT 'India',
    
    -- Tax Info
    gstin VARCHAR(20),
    pan VARCHAR(15),
    
    -- Payment Terms
    payment_terms VARCHAR(50),
    credit_limit DECIMAL(12,2),
    credit_days INT,
    
    -- Supplier-specific
    lead_time_days INT,
    
    -- Customer-specific
    customer_group VARCHAR(50),  -- retail, wholesale, distributor
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    
    -- Unique code within tenant
    UNIQUE(tenant_id, party_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_parties_tenant ON parties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(tenant_id, party_type);
CREATE INDEX IF NOT EXISTS idx_parties_name ON parties(tenant_id, party_name);
CREATE INDEX IF NOT EXISTS idx_parties_active ON parties(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_parties_name_trgm ON parties USING gin(party_name gin_trgm_ops);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Suppliers view (for convenience)
CREATE OR REPLACE VIEW suppliers AS
    SELECT * FROM parties WHERE party_type IN ('supplier', 'both');

-- Customers view (for convenience)
CREATE OR REPLACE VIEW customers AS
    SELECT * FROM parties WHERE party_type IN ('customer', 'both');

-- ============================================================================
-- END OF PARTIES SCHEMA
-- ============================================================================

