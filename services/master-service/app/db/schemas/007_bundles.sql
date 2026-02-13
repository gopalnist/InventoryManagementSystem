-- ============================================================================
-- 007_BUNDLES.SQL - Product Bundles (Bill of Materials) Schema
-- ============================================================================
-- Bundled/Composite products made from multiple components

CREATE TABLE IF NOT EXISTS product_bundles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Bundle Info
    sku VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Classification
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    
    -- Unit (how the bundle is sold)
    unit_id UUID REFERENCES units(id),
    
    -- Pricing (can be auto-calculated from components or manually set)
    auto_calculate_cost BOOLEAN NOT NULL DEFAULT true,
    total_component_cost DECIMAL(12,2),   -- Sum of component costs
    additional_cost DECIMAL(12,2) DEFAULT 0,  -- Packaging, labor, etc.
    total_cost DECIMAL(12,2),             -- Total cost (auto or manual)
    selling_price DECIMAL(12,2),
    mrp DECIMAL(12,2),
    
    -- Tax
    hsn_code VARCHAR(20),
    tax_rate DECIMAL(5,2),
    
    -- Inventory
    reorder_level INT DEFAULT 0,
    
    -- Images
    image_url TEXT,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, sku)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bundles_tenant ON product_bundles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bundles_sku ON product_bundles(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_bundles_active ON product_bundles(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bundles_name_trgm ON product_bundles USING gin(name gin_trgm_ops);


-- ============================================================================
-- BUNDLE COMPONENTS (Bill of Materials Items)
-- ============================================================================
-- Components that make up a bundle

CREATE TABLE IF NOT EXISTS bundle_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    bundle_id UUID NOT NULL REFERENCES product_bundles(id) ON DELETE CASCADE,
    
    -- Component can be a product or another bundle
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    component_bundle_id UUID REFERENCES product_bundles(id) ON DELETE RESTRICT,
    
    -- Quantity of this component needed
    quantity DECIMAL(10,4) NOT NULL DEFAULT 1,
    
    -- Unit cost at time of adding (can be updated)
    unit_cost DECIMAL(12,2),
    
    -- Total cost for this line (quantity * unit_cost)
    line_cost DECIMAL(12,2),
    
    -- Sort order for display
    sort_order INT DEFAULT 0,
    
    -- Notes for this component
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    
    -- Either product_id or component_bundle_id must be set, not both
    CONSTRAINT chk_component_type CHECK (
        (product_id IS NOT NULL AND component_bundle_id IS NULL) OR
        (product_id IS NULL AND component_bundle_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bundle_components_bundle ON bundle_components(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_components_product ON bundle_components(product_id);


-- ============================================================================
-- VIEWS
-- ============================================================================

-- Bundle with component counts
CREATE OR REPLACE VIEW bundle_summary AS
    SELECT 
        b.*,
        COUNT(bc.id) as component_count,
        COALESCE(SUM(bc.line_cost), 0) as calculated_cost
    FROM product_bundles b
    LEFT JOIN bundle_components bc ON b.id = bc.bundle_id
    GROUP BY b.id;

-- ============================================================================
-- TRIGGER: Auto-recalculate bundle cost
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_bundle_cost()
RETURNS TRIGGER AS $$
DECLARE
    v_bundle_id UUID;
    v_total_component_cost DECIMAL(12,2);
    v_additional_cost DECIMAL(12,2);
BEGIN
    -- Get bundle_id based on operation
    IF TG_OP = 'DELETE' THEN
        v_bundle_id := OLD.bundle_id;
    ELSE
        v_bundle_id := NEW.bundle_id;
    END IF;
    
    -- Calculate total component cost
    SELECT COALESCE(SUM(line_cost), 0) INTO v_total_component_cost
    FROM bundle_components WHERE bundle_id = v_bundle_id;
    
    -- Get additional cost
    SELECT additional_cost INTO v_additional_cost
    FROM product_bundles WHERE id = v_bundle_id;
    
    -- Update bundle
    UPDATE product_bundles
    SET 
        total_component_cost = v_total_component_cost,
        total_cost = v_total_component_cost + COALESCE(v_additional_cost, 0),
        updated_at = NOW()
    WHERE id = v_bundle_id AND auto_calculate_cost = true;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_recalculate_bundle_cost ON bundle_components;
CREATE TRIGGER trg_recalculate_bundle_cost
    AFTER INSERT OR UPDATE OR DELETE ON bundle_components
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_bundle_cost();

-- ============================================================================
-- END OF BUNDLES SCHEMA
-- ============================================================================

