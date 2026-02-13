-- ============================================================================
-- 004_BRANDS_MANUFACTURERS.SQL - Brands & Manufacturers Schema
-- ============================================================================

-- ============================================================================
-- BRANDS
-- ============================================================================
-- Product brands (e.g., Nike, Apple, Nourish You)

CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    logo_url TEXT,
    website VARCHAR(255),
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    
    -- Unique name within tenant
    UNIQUE(tenant_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brands_tenant ON brands(tenant_id);
CREATE INDEX IF NOT EXISTS idx_brands_name ON brands(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_brands_name_trgm ON brands USING gin(name gin_trgm_ops);


-- ============================================================================
-- MANUFACTURERS
-- ============================================================================
-- Product manufacturers (who makes the product)

CREATE TABLE IF NOT EXISTS manufacturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    contact_info TEXT,
    website VARCHAR(255),
    country VARCHAR(100),
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    
    -- Unique name within tenant
    UNIQUE(tenant_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_manufacturers_tenant ON manufacturers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_manufacturers_name ON manufacturers(tenant_id, name);

-- ============================================================================
-- END OF BRANDS & MANUFACTURERS SCHEMA
-- ============================================================================

