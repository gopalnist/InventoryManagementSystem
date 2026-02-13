-- ============================================================================
-- 009_CUSTOM_FIELDS.SQL - Custom Fields Schema
-- ============================================================================
-- User-defined fields for extensibility

-- ============================================================================
-- CUSTOM FIELD DEFINITIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Which entity this field applies to
    entity_type VARCHAR(50) NOT NULL,  -- product, bundle, party, production_order
    
    -- Field definition
    field_name VARCHAR(100) NOT NULL,
    field_label VARCHAR(150) NOT NULL,  -- Display label
    field_type VARCHAR(20) NOT NULL,  -- text, number, date, dropdown, boolean, textarea
    
    -- For dropdown type
    dropdown_options TEXT[],
    
    -- Validation
    is_required BOOLEAN NOT NULL DEFAULT false,
    min_value DECIMAL(15,4),  -- For number type
    max_value DECIMAL(15,4),
    max_length INT,  -- For text type
    regex_pattern VARCHAR(255),  -- For validation
    
    -- Display
    sort_order INT DEFAULT 0,
    placeholder VARCHAR(255),
    help_text TEXT,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, entity_type, field_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_field_defs_tenant ON custom_field_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_defs_entity ON custom_field_definitions(tenant_id, entity_type);


-- ============================================================================
-- CUSTOM FIELD VALUES
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_field_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL,  -- The product_id, party_id, etc.
    
    -- Value storage (stored as text, parsed based on field_type)
    value TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    
    UNIQUE(definition_id, entity_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_values_entity ON custom_field_values(entity_id);
CREATE INDEX IF NOT EXISTS idx_custom_values_definition ON custom_field_values(definition_id);


-- ============================================================================
-- HELPER FUNCTION: Get custom fields for entity
-- ============================================================================

CREATE OR REPLACE FUNCTION get_custom_fields(
    p_tenant_id UUID,
    p_entity_type VARCHAR(50),
    p_entity_id UUID
)
RETURNS TABLE (
    field_name VARCHAR(100),
    field_label VARCHAR(150),
    field_type VARCHAR(20),
    value TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cfd.field_name,
        cfd.field_label,
        cfd.field_type,
        cfv.value
    FROM custom_field_definitions cfd
    LEFT JOIN custom_field_values cfv 
        ON cfv.definition_id = cfd.id AND cfv.entity_id = p_entity_id
    WHERE cfd.tenant_id = p_tenant_id
    AND cfd.entity_type = p_entity_type
    AND cfd.is_active = true
    ORDER BY cfd.sort_order;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- END OF CUSTOM FIELDS SCHEMA
-- ============================================================================

