-- ============================================================================
-- SALES ORDERS MODULE
-- ============================================================================
-- Manages sales orders from customers/platforms (Amazon, Zepto, Blinkit, etc.)

-- ============================================================================
-- SALES ORDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Order Identification
    order_number VARCHAR(50) NOT NULL,           -- SO-00001, auto-generated
    reference_number VARCHAR(100),               -- External reference (Amazon PO#)
    platform_order_id VARCHAR(100),              -- Platform's internal order ID
    
    -- Customer/Platform Information
    customer_id UUID REFERENCES parties(id),     -- Link to customer/platform
    platform VARCHAR(50) DEFAULT 'manual',       -- 'amazon', 'zepto', 'blinkit', 'instamart', 'bigbasket', 'manual'
    platform_vendor_code VARCHAR(50),            -- e.g., 'NU8FU' for Amazon
    
    -- Fulfillment
    fulfillment_center_id UUID REFERENCES fulfillment_centers(id),
    fulfillment_center_code VARCHAR(50),         -- Denormalized for display
    fulfillment_center_name VARCHAR(200),        -- Denormalized for display
    
    -- Dates
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_shipment_date DATE,
    delivery_window_start DATE,
    delivery_window_end DATE,
    actual_shipment_date DATE,
    actual_delivery_date DATE,
    
    -- Addresses (JSONB for flexibility)
    billing_address JSONB,
    shipping_address JSONB,
    
    -- Status & Workflow
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    -- Values: draft, pending_confirmation, confirmed, processing, 
    --         packed, shipped, delivered, invoiced, cancelled, on_hold
    
    availability_status VARCHAR(100),            -- Platform-specific status text
    
    -- Financial
    currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
    subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    discount_type VARCHAR(20),                   -- 'percentage', 'fixed'
    discount_percentage DECIMAL(5, 2),
    shipping_charges DECIMAL(15, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    adjustment DECIMAL(15, 2) DEFAULT 0,
    adjustment_description VARCHAR(200),
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    
    -- Payment & Terms
    payment_terms VARCHAR(50),                   -- 'net30', 'prepaid', 'cod'
    payment_method VARCHAR(50),                  -- 'invoice', 'cod', 'prepaid'
    freight_terms VARCHAR(50),                   -- 'prepaid', 'collect', 'fob'
    
    -- Assignment
    salesperson_id UUID,
    salesperson_name VARCHAR(200),               -- Denormalized for display
    
    -- Notes
    notes TEXT,
    terms_conditions TEXT,
    internal_notes TEXT,                         -- Not visible to customer
    
    -- Platform-specific metadata (stores any extra fields)
    platform_metadata JSONB DEFAULT '{}',
    
    -- Priority & Flags
    priority VARCHAR(20) DEFAULT 'normal',       -- 'low', 'normal', 'high', 'urgent'
    is_back_order BOOLEAN DEFAULT FALSE,
    is_dropship BOOLEAN DEFAULT FALSE,
    
    -- Totals (denormalized for quick access)
    total_items INTEGER DEFAULT 0,
    total_quantity DECIMAL(15, 3) DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    -- Constraints
    UNIQUE(tenant_id, order_number),
    CONSTRAINT valid_so_status CHECK (status IN (
        'draft', 'pending_confirmation', 'confirmed', 'processing',
        'packed', 'shipped', 'delivered', 'invoiced', 'cancelled', 'on_hold'
    )),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- ============================================================================
-- SALES ORDER LINE ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    
    -- Product Reference
    product_id UUID REFERENCES products(id),
    
    -- Product identifiers at time of order (denormalized for history)
    sku VARCHAR(100),
    product_name VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Platform-specific identifiers
    asin VARCHAR(20),                            -- Amazon ASIN
    external_id VARCHAR(100),                    -- EAN/UPC barcode
    external_id_type VARCHAR(20),                -- 'EAN', 'UPC', 'SKU'
    
    -- Quantities
    quantity_ordered DECIMAL(15, 3) NOT NULL,
    quantity_confirmed DECIMAL(15, 3),
    quantity_shipped DECIMAL(15, 3) DEFAULT 0,
    quantity_delivered DECIMAL(15, 3) DEFAULT 0,
    quantity_cancelled DECIMAL(15, 3) DEFAULT 0,
    quantity_returned DECIMAL(15, 3) DEFAULT 0,
    quantity_invoiced DECIMAL(15, 3) DEFAULT 0,
    
    -- Unit of Measure
    unit_id UUID REFERENCES units(id),
    unit_symbol VARCHAR(20),
    item_package_quantity INTEGER DEFAULT 1,     -- Units per package
    
    -- Pricing
    list_price DECIMAL(15, 2),                   -- MRP
    unit_price DECIMAL(15, 2) NOT NULL,          -- Selling price
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    discount_percentage DECIMAL(5, 2),
    tax_percentage DECIMAL(5, 2),
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    line_total DECIMAL(15, 2) NOT NULL,
    
    -- Line Item Status
    status VARCHAR(30) DEFAULT 'pending',
    -- Values: pending, confirmed, picking, packed, shipped, delivered, 
    --         invoiced, cancelled, backordered, dropshipped
    
    -- Warehouse & Inventory (to be set during processing)
    warehouse_id UUID,
    warehouse_name VARCHAR(200),
    bin_location VARCHAR(50),
    lot_number VARCHAR(100),
    serial_numbers TEXT[],                       -- Array of serial numbers
    expiry_date DATE,
    
    -- Fulfillment Details
    is_dropship BOOLEAN DEFAULT FALSE,
    dropship_vendor_id UUID REFERENCES parties(id),
    
    -- Sequence
    line_number INTEGER NOT NULL,
    
    -- Notes
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SALES ORDER STATUS HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales_order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    
    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_by UUID,
    changed_by_name VARCHAR(200),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    
    -- Platform sync info
    synced_to_platform BOOLEAN DEFAULT FALSE,
    platform_sync_time TIMESTAMP WITH TIME ZONE,
    platform_sync_response JSONB
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Sales Orders indexes
CREATE INDEX IF NOT EXISTS idx_so_tenant_status ON sales_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_so_tenant_date ON sales_orders(tenant_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_so_customer ON sales_orders(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_so_platform ON sales_orders(tenant_id, platform);
CREATE INDEX IF NOT EXISTS idx_so_reference ON sales_orders(tenant_id, reference_number);
CREATE INDEX IF NOT EXISTS idx_so_platform_order ON sales_orders(tenant_id, platform_order_id);
CREATE INDEX IF NOT EXISTS idx_so_order_number ON sales_orders(tenant_id, order_number);
CREATE INDEX IF NOT EXISTS idx_so_fc ON sales_orders(tenant_id, fulfillment_center_id);
CREATE INDEX IF NOT EXISTS idx_so_created_at ON sales_orders(tenant_id, created_at DESC);

-- Sales Order Items indexes
CREATE INDEX IF NOT EXISTS idx_soi_order ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_soi_product ON sales_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_soi_sku ON sales_order_items(sku);
CREATE INDEX IF NOT EXISTS idx_soi_asin ON sales_order_items(asin);
CREATE INDEX IF NOT EXISTS idx_soi_external_id ON sales_order_items(external_id);
CREATE INDEX IF NOT EXISTS idx_soi_status ON sales_order_items(status);

-- Status History indexes
CREATE INDEX IF NOT EXISTS idx_sosh_order ON sales_order_status_history(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sosh_changed_at ON sales_order_status_history(changed_at DESC);

-- ============================================================================
-- AUTO-GENERATE ORDER NUMBER
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_sales_order_number(p_tenant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_prefix VARCHAR := 'SO-';
    v_next_num INTEGER;
    v_order_number VARCHAR;
BEGIN
    -- Get next number for this tenant
    SELECT COALESCE(MAX(
        CASE 
            WHEN order_number ~ '^SO-[0-9]+$' 
            THEN CAST(SUBSTRING(order_number FROM 4) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_next_num
    FROM sales_orders
    WHERE tenant_id = p_tenant_id;
    
    -- Format with leading zeros (5 digits)
    v_order_number := v_prefix || LPAD(v_next_num::TEXT, 5, '0');
    
    RETURN v_order_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at trigger for sales_orders
CREATE OR REPLACE FUNCTION update_sales_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sales_orders_updated_at ON sales_orders;
CREATE TRIGGER trg_sales_orders_updated_at
    BEFORE UPDATE ON sales_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_orders_updated_at();

-- Updated_at trigger for sales_order_items
DROP TRIGGER IF EXISTS trg_sales_order_items_updated_at ON sales_order_items;
CREATE TRIGGER trg_sales_order_items_updated_at
    BEFORE UPDATE ON sales_order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_orders_updated_at();

-- Auto-generate order number on insert
CREATE OR REPLACE FUNCTION auto_generate_so_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := generate_sales_order_number(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_so_number ON sales_orders;
CREATE TRIGGER trg_auto_so_number
    BEFORE INSERT ON sales_orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_so_number();

-- Status change history trigger
CREATE OR REPLACE FUNCTION log_so_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO sales_order_status_history (
            sales_order_id,
            previous_status,
            new_status,
            changed_by,
            notes
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            NEW.updated_by,
            'Status changed from ' || COALESCE(OLD.status, 'null') || ' to ' || NEW.status
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_so_status_history ON sales_orders;
CREATE TRIGGER trg_so_status_history
    AFTER UPDATE ON sales_orders
    FOR EACH ROW
    EXECUTE FUNCTION log_so_status_change();

-- Recalculate order totals trigger
CREATE OR REPLACE FUNCTION recalculate_so_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_subtotal DECIMAL(15, 2);
    v_tax_total DECIMAL(15, 2);
    v_item_count INTEGER;
    v_qty_total DECIMAL(15, 3);
BEGIN
    -- Calculate totals from line items
    SELECT 
        COALESCE(SUM(line_total), 0),
        COALESCE(SUM(tax_amount), 0),
        COUNT(*),
        COALESCE(SUM(quantity_ordered), 0)
    INTO v_subtotal, v_tax_total, v_item_count, v_qty_total
    FROM sales_order_items
    WHERE sales_order_id = COALESCE(NEW.sales_order_id, OLD.sales_order_id);
    
    -- Update sales order
    UPDATE sales_orders
    SET 
        subtotal = v_subtotal,
        tax_amount = v_tax_total,
        total_amount = v_subtotal + v_tax_total + COALESCE(shipping_charges, 0) - COALESCE(discount_amount, 0) + COALESCE(adjustment, 0),
        total_items = v_item_count,
        total_quantity = v_qty_total,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = COALESCE(NEW.sales_order_id, OLD.sales_order_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalculate_so_totals_insert ON sales_order_items;
CREATE TRIGGER trg_recalculate_so_totals_insert
    AFTER INSERT ON sales_order_items
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_so_totals();

DROP TRIGGER IF EXISTS trg_recalculate_so_totals_update ON sales_order_items;
CREATE TRIGGER trg_recalculate_so_totals_update
    AFTER UPDATE ON sales_order_items
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_so_totals();

DROP TRIGGER IF EXISTS trg_recalculate_so_totals_delete ON sales_order_items;
CREATE TRIGGER trg_recalculate_so_totals_delete
    AFTER DELETE ON sales_order_items
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_so_totals();

-- ============================================================================
-- OUTBOX TRIGGER FOR SALES ORDERS
-- ============================================================================

CREATE OR REPLACE FUNCTION capture_sales_order_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_operation VARCHAR(10);
    v_old_data JSONB;
    v_new_data JSONB;
    v_event_type VARCHAR(50);
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_operation := 'INSERT';
        v_new_data := to_jsonb(NEW);
        v_old_data := NULL;
        v_event_type := 'SalesOrderCreated';
    ELSIF TG_OP = 'UPDATE' THEN
        v_operation := 'UPDATE';
        v_new_data := to_jsonb(NEW);
        v_old_data := to_jsonb(OLD);
        -- Determine specific event type
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            v_event_type := 'SalesOrderStatus' || initcap(NEW.status);
        ELSE
            v_event_type := 'SalesOrderUpdated';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_operation := 'DELETE';
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
        v_event_type := 'SalesOrderDeleted';
    END IF;

    INSERT INTO outbox (
        tenant_id,
        aggregate_type,
        aggregate_id,
        event_type,
        operation,
        payload,
        old_payload
    ) VALUES (
        COALESCE(NEW.tenant_id, OLD.tenant_id),
        'sales_order',
        COALESCE(NEW.id, OLD.id),
        v_event_type,
        v_operation,
        COALESCE(v_new_data, v_old_data),
        v_old_data
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sales_order_outbox ON sales_orders;
CREATE TRIGGER trg_sales_order_outbox
    AFTER INSERT OR UPDATE OR DELETE ON sales_orders
    FOR EACH ROW
    EXECUTE FUNCTION capture_sales_order_changes();

-- ============================================================================
-- END OF SALES ORDERS SCHEMA
-- ============================================================================

