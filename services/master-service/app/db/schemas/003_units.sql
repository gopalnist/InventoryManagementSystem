-- ============================================================================
-- 003_UNITS.SQL - Units of Measurement Schema
-- ============================================================================
-- Units used for products (pieces, kg, liters, etc.)

CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    unit_type VARCHAR(20) NOT NULL DEFAULT 'quantity',  -- quantity, weight, volume, length
    
    -- For unit conversions
    base_unit_id UUID REFERENCES units(id),  -- Reference to base unit
    conversion_factor DECIMAL(15,8),  -- Multiply by this to convert to base unit
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique symbol within tenant
    UNIQUE(tenant_id, symbol)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_units_tenant ON units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_units_type ON units(tenant_id, unit_type);

-- ============================================================================
-- DEFAULT UNITS DATA
-- ============================================================================

-- Function to setup default units for a tenant
CREATE OR REPLACE FUNCTION setup_default_units(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    -- Quantity units
    INSERT INTO units (tenant_id, name, symbol, unit_type) VALUES
        (p_tenant_id, 'Pieces', 'pcs', 'quantity'),
        (p_tenant_id, 'Pack', 'pack', 'quantity'),
        (p_tenant_id, 'Box', 'box', 'quantity'),
        (p_tenant_id, 'Carton', 'ctn', 'quantity'),
        (p_tenant_id, 'Dozen', 'doz', 'quantity'),
        (p_tenant_id, 'Set', 'set', 'quantity'),
        (p_tenant_id, 'Pair', 'pair', 'quantity')
    ON CONFLICT (tenant_id, symbol) DO NOTHING;
    
    -- Weight units
    INSERT INTO units (tenant_id, name, symbol, unit_type) VALUES
        (p_tenant_id, 'Kilogram', 'kg', 'weight'),
        (p_tenant_id, 'Gram', 'g', 'weight'),
        (p_tenant_id, 'Milligram', 'mg', 'weight'),
        (p_tenant_id, 'Pound', 'lb', 'weight'),
        (p_tenant_id, 'Ounce', 'oz', 'weight')
    ON CONFLICT (tenant_id, symbol) DO NOTHING;
    
    -- Volume units
    INSERT INTO units (tenant_id, name, symbol, unit_type) VALUES
        (p_tenant_id, 'Litre', 'L', 'volume'),
        (p_tenant_id, 'Millilitre', 'ml', 'volume'),
        (p_tenant_id, 'Gallon', 'gal', 'volume')
    ON CONFLICT (tenant_id, symbol) DO NOTHING;
    
    -- Length units
    INSERT INTO units (tenant_id, name, symbol, unit_type) VALUES
        (p_tenant_id, 'Metre', 'm', 'length'),
        (p_tenant_id, 'Centimetre', 'cm', 'length'),
        (p_tenant_id, 'Millimetre', 'mm', 'length'),
        (p_tenant_id, 'Inch', 'in', 'length'),
        (p_tenant_id, 'Feet', 'ft', 'length')
    ON CONFLICT (tenant_id, symbol) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Setup defaults for demo tenant
SELECT setup_default_units('00000000-0000-0000-0000-000000000001');

-- ============================================================================
-- END OF UNITS SCHEMA
-- ============================================================================

