-- ============================================================================
-- 008_PRODUCTION.SQL - Production Orders Schema
-- ============================================================================
-- Orders to assemble/produce bundles from components

CREATE TABLE IF NOT EXISTS production_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Order Info
    order_number VARCHAR(50) NOT NULL,
    bundle_id UUID NOT NULL REFERENCES product_bundles(id),
    
    -- Quantity
    quantity_ordered INT NOT NULL,
    quantity_produced INT DEFAULT 0,
    
    -- Status: draft, pending, in_progress, completed, cancelled
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    
    -- Dates
    expected_date DATE,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Assigned to
    assigned_to VARCHAR(100),
    
    -- Cost tracking
    estimated_cost DECIMAL(12,2),
    actual_cost DECIMAL(12,2),
    
    -- Notes
    notes TEXT,
    cancellation_reason TEXT,
    
    -- Audit
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, order_number),
    
    -- Validate status values
    CONSTRAINT chk_production_status CHECK (
        status IN ('draft', 'pending', 'in_progress', 'completed', 'cancelled')
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_production_orders_tenant ON production_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_bundle ON production_orders(bundle_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_production_orders_number ON production_orders(tenant_id, order_number);
CREATE INDEX IF NOT EXISTS idx_production_orders_expected ON production_orders(tenant_id, expected_date) 
    WHERE status IN ('pending', 'in_progress');


-- ============================================================================
-- PRODUCTION ORDER COMPONENTS (Material Consumption)
-- ============================================================================
-- Tracks actual material consumption for each production order

CREATE TABLE IF NOT EXISTS production_order_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    
    -- Component (from bundle BOM)
    product_id UUID REFERENCES products(id),
    
    -- Quantities
    quantity_required DECIMAL(10,4) NOT NULL,
    quantity_consumed DECIMAL(10,4) DEFAULT 0,
    
    -- Cost at time of consumption
    unit_cost DECIMAL(12,2),
    total_cost DECIMAL(12,2),
    
    -- Status
    is_fulfilled BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prod_order_components ON production_order_components(production_order_id);
CREATE INDEX IF NOT EXISTS idx_prod_order_comp_product ON production_order_components(product_id);


-- ============================================================================
-- PRODUCTION HISTORY (Audit Log)
-- ============================================================================
-- Tracks status changes and actions on production orders

CREATE TABLE IF NOT EXISTS production_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    
    -- Action: created, started, completed, cancelled, quantity_updated
    action VARCHAR(50) NOT NULL,
    previous_status VARCHAR(20),
    new_status VARCHAR(20),
    
    -- Details
    quantity_change INT,
    notes TEXT,
    
    -- Actor
    performed_by UUID,
    performed_by_name VARCHAR(100),
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_production_history_order ON production_history(production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_history_date ON production_history(performed_at);


-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active production orders with bundle info
CREATE OR REPLACE VIEW active_production_orders AS
    SELECT 
        po.*,
        pb.name as bundle_name,
        pb.sku as bundle_sku,
        pb.total_cost as bundle_cost
    FROM production_orders po
    JOIN product_bundles pb ON po.bundle_id = pb.id
    WHERE po.status IN ('pending', 'in_progress');


-- Production summary by status
CREATE OR REPLACE VIEW production_summary AS
    SELECT
        tenant_id,
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_orders,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_orders,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_orders,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
        COALESCE(SUM(quantity_produced) FILTER (WHERE status = 'completed'), 0) as total_units_produced
    FROM production_orders
    GROUP BY tenant_id;


-- ============================================================================
-- SEQUENCE FOR ORDER NUMBERS
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS production_order_seq START 1;

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_production_order_number(p_tenant_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_year INT;
    v_next_num INT;
BEGIN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Get next number for this tenant/year
    SELECT COALESCE(MAX(
        CAST(SPLIT_PART(order_number, '-', 3) AS INT)
    ), 0) + 1
    INTO v_next_num
    FROM production_orders
    WHERE tenant_id = p_tenant_id
    AND order_number LIKE 'PO-' || v_year || '-%';
    
    RETURN 'PO-' || v_year || '-' || LPAD(v_next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- END OF PRODUCTION SCHEMA
-- ============================================================================

