-- ============================================================================
-- Product Identifiers Table
-- ============================================================================
-- Maps external identifiers (EAN, UPC, ASIN, etc.) to internal products
-- This enables lookup of products by any external barcode/identifier

-- Drop if exists for clean migration
DROP TABLE IF EXISTS product_identifiers CASCADE;

CREATE TABLE product_identifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Identifier details
    identifier_type VARCHAR(20) NOT NULL,  -- 'ean', 'upc', 'asin', 'isbn', 'gtin', 'mpn', 'internal'
    identifier_value VARCHAR(100) NOT NULL,
    
    -- Platform association (optional)
    platform VARCHAR(50),  -- 'amazon', 'flipkart', 'zepto', 'blinkit', etc.
    
    -- Flags
    is_primary BOOLEAN DEFAULT false,  -- Primary identifier for this type
    is_active BOOLEAN DEFAULT true,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    -- Constraints
    CONSTRAINT uq_product_identifier UNIQUE (tenant_id, identifier_type, identifier_value, platform),
    CONSTRAINT chk_identifier_type CHECK (identifier_type IN ('ean', 'upc', 'asin', 'isbn', 'gtin', 'mpn', 'internal', 'sku_alias'))
);

-- Indexes for fast lookup
CREATE INDEX idx_pi_tenant ON product_identifiers(tenant_id);
CREATE INDEX idx_pi_product ON product_identifiers(product_id);
CREATE INDEX idx_pi_identifier ON product_identifiers(tenant_id, identifier_value);
CREATE INDEX idx_pi_type_value ON product_identifiers(tenant_id, identifier_type, identifier_value);
CREATE INDEX idx_pi_platform ON product_identifiers(tenant_id, platform, identifier_value);

-- Comments
COMMENT ON TABLE product_identifiers IS 'Maps external identifiers (EAN, UPC, ASIN) to internal products';
COMMENT ON COLUMN product_identifiers.identifier_type IS 'Type: ean, upc, asin, isbn, gtin, mpn, internal, sku_alias';
COMMENT ON COLUMN product_identifiers.platform IS 'Platform where this identifier is used: amazon, flipkart, zepto, etc.';
COMMENT ON COLUMN product_identifiers.is_primary IS 'Primary identifier for this type (e.g., primary EAN)';

-- ============================================================================
-- Function to find product by any identifier
-- ============================================================================
CREATE OR REPLACE FUNCTION find_product_by_identifier(
    p_tenant_id UUID,
    p_identifier VARCHAR(100),
    p_platform VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    product_id UUID,
    product_sku VARCHAR(100),
    product_name VARCHAR(500),
    identifier_type VARCHAR(20),
    matched_platform VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as product_id,
        p.sku as product_sku,
        p.name as product_name,
        pi.identifier_type,
        pi.platform as matched_platform
    FROM product_identifiers pi
    JOIN products p ON pi.product_id = p.id
    WHERE pi.tenant_id = p_tenant_id
    AND pi.identifier_value = p_identifier
    AND pi.is_active = true
    AND (p_platform IS NULL OR pi.platform = p_platform OR pi.platform IS NULL)
    ORDER BY 
        CASE WHEN pi.platform = p_platform THEN 0 ELSE 1 END,
        pi.is_primary DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_product_by_identifier IS 'Find product by any external identifier (EAN, ASIN, UPC, etc.)';




