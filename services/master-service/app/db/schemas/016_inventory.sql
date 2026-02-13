-- ============================================================================
-- Inventory Management Tables
-- ============================================================================
-- Tracks stock levels, reservations, and movements

-- ============================================================================
-- Warehouses Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Basic info
    code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    warehouse_type VARCHAR(50) DEFAULT 'internal',  -- internal, 3pl, virtual, dropship
    
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
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    accepts_returns BOOLEAN DEFAULT true,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_warehouse_code UNIQUE (tenant_id, code)
);

CREATE INDEX idx_wh_tenant ON warehouses(tenant_id);
CREATE INDEX idx_wh_code ON warehouses(tenant_id, code);

-- ============================================================================
-- Inventory Table (Stock Levels per Product per Warehouse)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    
    -- Stock quantities
    on_hand_qty NUMERIC(15, 3) NOT NULL DEFAULT 0,        -- Physical stock in warehouse
    reserved_qty NUMERIC(15, 3) NOT NULL DEFAULT 0,       -- Reserved for orders
    available_qty NUMERIC(15, 3) GENERATED ALWAYS AS (on_hand_qty - reserved_qty) STORED,  -- Free to sell
    incoming_qty NUMERIC(15, 3) NOT NULL DEFAULT 0,       -- Expected from purchase orders
    committed_qty NUMERIC(15, 3) NOT NULL DEFAULT 0,      -- Committed to sales orders (not yet shipped)
    
    -- Reorder settings
    reorder_level NUMERIC(15, 3) DEFAULT 0,
    reorder_qty NUMERIC(15, 3) DEFAULT 0,
    max_stock_level NUMERIC(15, 3),
    
    -- Bin/Location tracking
    bin_location VARCHAR(50),
    
    -- Valuation
    unit_cost NUMERIC(15, 2) DEFAULT 0,
    total_value NUMERIC(15, 2) GENERATED ALWAYS AS (on_hand_qty * unit_cost) STORED,
    
    -- Last activity
    last_count_date DATE,
    last_received_date DATE,
    last_sold_date DATE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_inventory_product_warehouse UNIQUE (tenant_id, product_id, warehouse_id),
    CONSTRAINT chk_on_hand_positive CHECK (on_hand_qty >= 0),
    CONSTRAINT chk_reserved_valid CHECK (reserved_qty >= 0 AND reserved_qty <= on_hand_qty)
);

CREATE INDEX idx_inv_tenant ON inventory(tenant_id);
CREATE INDEX idx_inv_product ON inventory(product_id);
CREATE INDEX idx_inv_warehouse ON inventory(warehouse_id);
CREATE INDEX idx_inv_low_stock ON inventory(tenant_id, product_id) WHERE available_qty <= reorder_level;

-- ============================================================================
-- Inventory Reservations Table (Links reservations to orders)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    
    -- Source reference
    source_type VARCHAR(50) NOT NULL,  -- 'sales_order', 'production_order', 'transfer'
    source_id UUID NOT NULL,           -- sales_order_id, production_order_id, etc.
    source_line_id UUID,               -- sales_order_item_id, etc.
    
    -- Reservation details
    reserved_qty NUMERIC(15, 3) NOT NULL,
    fulfilled_qty NUMERIC(15, 3) DEFAULT 0,
    cancelled_qty NUMERIC(15, 3) DEFAULT 0,
    pending_qty NUMERIC(15, 3) GENERATED ALWAYS AS (reserved_qty - fulfilled_qty - cancelled_qty) STORED,
    
    -- Status
    status VARCHAR(30) DEFAULT 'active',  -- active, fulfilled, cancelled, expired
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    
    CONSTRAINT chk_reservation_qty CHECK (reserved_qty > 0),
    CONSTRAINT chk_fulfilled_valid CHECK (fulfilled_qty >= 0 AND fulfilled_qty <= reserved_qty)
);

CREATE INDEX idx_res_tenant ON inventory_reservations(tenant_id);
CREATE INDEX idx_res_inventory ON inventory_reservations(inventory_id);
CREATE INDEX idx_res_source ON inventory_reservations(source_type, source_id);
CREATE INDEX idx_res_status ON inventory_reservations(tenant_id, status) WHERE status = 'active';

-- ============================================================================
-- Inventory Transactions Table (Movement history)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product_id UUID NOT NULL REFERENCES products(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    
    -- Transaction details
    transaction_type VARCHAR(50) NOT NULL,  -- 'receive', 'ship', 'adjust', 'transfer_in', 'transfer_out', 'reserve', 'unreserve', 'return'
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Quantities
    quantity NUMERIC(15, 3) NOT NULL,  -- Positive for in, negative for out
    unit_cost NUMERIC(15, 2),
    
    -- Running totals (after this transaction)
    on_hand_after NUMERIC(15, 3),
    reserved_after NUMERIC(15, 3),
    
    -- Reference
    reference_type VARCHAR(50),  -- 'sales_order', 'purchase_order', 'adjustment', 'transfer'
    reference_id UUID,
    reference_number VARCHAR(100),
    
    -- Details
    reason VARCHAR(200),
    notes TEXT,
    lot_number VARCHAR(100),
    serial_number VARCHAR(100),
    expiry_date DATE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

CREATE INDEX idx_txn_tenant ON inventory_transactions(tenant_id);
CREATE INDEX idx_txn_product ON inventory_transactions(product_id);
CREATE INDEX idx_txn_warehouse ON inventory_transactions(warehouse_id);
CREATE INDEX idx_txn_date ON inventory_transactions(tenant_id, transaction_date DESC);
CREATE INDEX idx_txn_reference ON inventory_transactions(reference_type, reference_id);

-- ============================================================================
-- Functions for Inventory Operations
-- ============================================================================

-- Reserve stock for an order
CREATE OR REPLACE FUNCTION reserve_inventory(
    p_tenant_id UUID,
    p_product_id UUID,
    p_warehouse_id UUID,
    p_quantity NUMERIC,
    p_source_type VARCHAR,
    p_source_id UUID,
    p_source_line_id UUID DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message VARCHAR,
    reservation_id UUID,
    available_before NUMERIC,
    available_after NUMERIC
) AS $$
DECLARE
    v_inventory_id UUID;
    v_available NUMERIC;
    v_reservation_id UUID;
BEGIN
    -- Get inventory record
    SELECT id, available_qty INTO v_inventory_id, v_available
    FROM inventory
    WHERE tenant_id = p_tenant_id 
    AND product_id = p_product_id 
    AND warehouse_id = p_warehouse_id
    FOR UPDATE;
    
    IF v_inventory_id IS NULL THEN
        RETURN QUERY SELECT false, 'No inventory record found'::VARCHAR, NULL::UUID, 0::NUMERIC, 0::NUMERIC;
        RETURN;
    END IF;
    
    IF v_available < p_quantity THEN
        RETURN QUERY SELECT false, ('Insufficient stock. Available: ' || v_available)::VARCHAR, NULL::UUID, v_available, v_available;
        RETURN;
    END IF;
    
    -- Update inventory
    UPDATE inventory
    SET reserved_qty = reserved_qty + p_quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_inventory_id;
    
    -- Create reservation record
    INSERT INTO inventory_reservations (tenant_id, inventory_id, source_type, source_id, source_line_id, reserved_qty, status)
    VALUES (p_tenant_id, v_inventory_id, p_source_type, p_source_id, p_source_line_id, p_quantity, 'active')
    RETURNING id INTO v_reservation_id;
    
    -- Log transaction
    INSERT INTO inventory_transactions (tenant_id, product_id, warehouse_id, transaction_type, quantity, on_hand_after, reserved_after, reference_type, reference_id)
    SELECT p_tenant_id, p_product_id, p_warehouse_id, 'reserve', p_quantity, on_hand_qty, reserved_qty, p_source_type, p_source_id
    FROM inventory WHERE id = v_inventory_id;
    
    RETURN QUERY SELECT true, 'Stock reserved successfully'::VARCHAR, v_reservation_id, v_available, (v_available - p_quantity);
END;
$$ LANGUAGE plpgsql;

-- Release reservation (cancel or fulfill)
CREATE OR REPLACE FUNCTION release_reservation(
    p_reservation_id UUID,
    p_action VARCHAR,  -- 'cancel' or 'fulfill'
    p_quantity NUMERIC DEFAULT NULL  -- NULL = full amount
)
RETURNS TABLE (success BOOLEAN, message VARCHAR) AS $$
DECLARE
    v_reservation RECORD;
    v_release_qty NUMERIC;
BEGIN
    SELECT * INTO v_reservation FROM inventory_reservations WHERE id = p_reservation_id FOR UPDATE;
    
    IF v_reservation IS NULL THEN
        RETURN QUERY SELECT false, 'Reservation not found'::VARCHAR;
        RETURN;
    END IF;
    
    v_release_qty := COALESCE(p_quantity, v_reservation.pending_qty);
    
    IF v_release_qty > v_reservation.pending_qty THEN
        RETURN QUERY SELECT false, 'Cannot release more than pending quantity'::VARCHAR;
        RETURN;
    END IF;
    
    -- Update reservation
    IF p_action = 'cancel' THEN
        UPDATE inventory_reservations SET cancelled_qty = cancelled_qty + v_release_qty, updated_at = CURRENT_TIMESTAMP WHERE id = p_reservation_id;
    ELSE
        UPDATE inventory_reservations SET fulfilled_qty = fulfilled_qty + v_release_qty, updated_at = CURRENT_TIMESTAMP WHERE id = p_reservation_id;
    END IF;
    
    -- Update status if fully processed
    UPDATE inventory_reservations 
    SET status = CASE WHEN pending_qty <= 0 THEN p_action || 'led' ELSE status END
    WHERE id = p_reservation_id;
    
    -- Update inventory
    UPDATE inventory
    SET reserved_qty = reserved_qty - v_release_qty,
        on_hand_qty = CASE WHEN p_action = 'fulfill' THEN on_hand_qty - v_release_qty ELSE on_hand_qty END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_reservation.inventory_id;
    
    RETURN QUERY SELECT true, ('Reservation ' || p_action || 'led: ' || v_release_qty)::VARCHAR;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Create default warehouse for demo tenant
-- ============================================================================
INSERT INTO warehouses (tenant_id, code, name, city, state, is_default)
VALUES ('00000000-0000-0000-0000-000000000001', 'WH-MAIN', 'Main Warehouse', 'Bengaluru', 'Karnataka', true)
ON CONFLICT (tenant_id, code) DO NOTHING;




