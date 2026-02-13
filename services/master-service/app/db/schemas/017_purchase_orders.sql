-- ============================================================================
-- PURCHASE ORDERS (VENDOR PURCHASES)
-- ============================================================================
-- Track orders placed with vendors/suppliers for incoming inventory

-- Purchase Orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Order identification
    order_number VARCHAR(50) NOT NULL,
    
    -- Vendor/Supplier
    vendor_id UUID REFERENCES parties(id),
    vendor_name VARCHAR(255),
    
    -- Warehouse receiving the goods
    warehouse_id UUID REFERENCES warehouses(id),
    
    -- Order dates
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    
    -- Status workflow
    status VARCHAR(30) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'ordered', 'partially_received', 'received', 'cancelled', 'closed')),
    
    -- Payment terms
    payment_terms VARCHAR(100),
    payment_status VARCHAR(30) DEFAULT 'unpaid'
        CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    
    -- Amounts
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    shipping_charges NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    
    -- Additional fields
    notes TEXT,
    internal_notes TEXT,
    shipping_address JSONB,
    
    -- Audit fields
    created_by VARCHAR(255),
    approved_by VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Unique order number per tenant
    UNIQUE(tenant_id, order_number)
);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    
    -- Product
    product_id UUID REFERENCES products(id),
    product_sku VARCHAR(100),
    product_name VARCHAR(500),
    
    -- Quantities
    quantity_ordered NUMERIC(10, 3) NOT NULL,
    quantity_received NUMERIC(10, 3) NOT NULL DEFAULT 0,
    
    -- Pricing
    unit_price NUMERIC(12, 2) NOT NULL,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    line_total NUMERIC(12, 2) NOT NULL,
    
    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'partially_received', 'received', 'cancelled')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Purchase Order Receipts (for partial/full receipts)
CREATE TABLE IF NOT EXISTS purchase_order_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
    
    -- Receipt info
    receipt_number VARCHAR(50) NOT NULL,
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Warehouse where goods received
    warehouse_id UUID REFERENCES warehouses(id),
    
    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'confirmed', 'cancelled')),
    
    notes TEXT,
    received_by VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, receipt_number)
);

-- Purchase Receipt Items
CREATE TABLE IF NOT EXISTS purchase_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES purchase_order_receipts(id) ON DELETE CASCADE,
    purchase_order_item_id UUID NOT NULL REFERENCES purchase_order_items(id),
    
    -- Product
    product_id UUID REFERENCES products(id),
    
    -- Quantities
    quantity_received NUMERIC(10, 3) NOT NULL,
    
    -- Batch/Lot info (optional)
    batch_number VARCHAR(100),
    expiry_date DATE,
    manufacture_date DATE,
    
    -- Quality check
    quality_status VARCHAR(30) DEFAULT 'pending'
        CHECK (quality_status IN ('pending', 'passed', 'failed', 'on_hold')),
    quality_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date ON purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product ON purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_po ON purchase_order_receipts(purchase_order_id);

-- Function to auto-generate PO number
CREATE OR REPLACE FUNCTION generate_po_number(p_tenant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_year TEXT;
    v_sequence INT;
    v_po_number VARCHAR;
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN order_number ~ ('^PO-' || v_year || '-[0-9]+$')
            THEN CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM purchase_orders
    WHERE tenant_id = p_tenant_id
    AND order_number LIKE 'PO-' || v_year || '-%';
    
    v_po_number := 'PO-' || v_year || '-' || LPAD(v_sequence::text, 5, '0');
    
    RETURN v_po_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update totals
CREATE OR REPLACE FUNCTION update_purchase_order_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE purchase_orders
    SET 
        subtotal = (
            SELECT COALESCE(SUM(line_total), 0)
            FROM purchase_order_items
            WHERE purchase_order_id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id)
        ),
        tax_amount = (
            SELECT COALESCE(SUM(tax_amount), 0)
            FROM purchase_order_items
            WHERE purchase_order_id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id)
        ),
        total_amount = (
            SELECT COALESCE(SUM(line_total + tax_amount - discount_amount), 0)
            FROM purchase_order_items
            WHERE purchase_order_id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id)
        ) + shipping_charges - discount_amount,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_po_totals ON purchase_order_items;
CREATE TRIGGER trg_update_po_totals
AFTER INSERT OR UPDATE OR DELETE ON purchase_order_items
FOR EACH ROW EXECUTE FUNCTION update_purchase_order_totals();

-- Function to receive items and update inventory
CREATE OR REPLACE FUNCTION receive_purchase_order_items(
    p_tenant_id UUID,
    p_receipt_id UUID,
    p_warehouse_id UUID,
    p_received_by VARCHAR
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    items_received INT
) AS $$
DECLARE
    v_receipt RECORD;
    v_item RECORD;
    v_inventory_id UUID;
    v_items_count INT := 0;
BEGIN
    -- Get receipt
    SELECT * INTO v_receipt 
    FROM purchase_order_receipts 
    WHERE id = p_receipt_id AND tenant_id = p_tenant_id;
    
    IF v_receipt IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Receipt not found'::TEXT, 0;
        RETURN;
    END IF;
    
    IF v_receipt.status = 'confirmed' THEN
        RETURN QUERY SELECT FALSE, 'Receipt already confirmed'::TEXT, 0;
        RETURN;
    END IF;
    
    -- Process each receipt item
    FOR v_item IN 
        SELECT pri.*, poi.product_id
        FROM purchase_receipt_items pri
        JOIN purchase_order_items poi ON poi.id = pri.purchase_order_item_id
        WHERE pri.receipt_id = p_receipt_id
    LOOP
        -- Get or create inventory record
        SELECT id INTO v_inventory_id
        FROM inventory
        WHERE tenant_id = p_tenant_id 
        AND product_id = v_item.product_id 
        AND warehouse_id = p_warehouse_id;
        
        IF v_inventory_id IS NULL THEN
            INSERT INTO inventory (tenant_id, product_id, warehouse_id, on_hand_qty)
            VALUES (p_tenant_id, v_item.product_id, p_warehouse_id, v_item.quantity_received)
            RETURNING id INTO v_inventory_id;
        ELSE
            UPDATE inventory
            SET on_hand_qty = on_hand_qty + v_item.quantity_received,
                last_received_date = CURRENT_DATE,
                updated_at = NOW()
            WHERE id = v_inventory_id;
        END IF;
        
        -- Record transaction
        INSERT INTO inventory_transactions (
            tenant_id, product_id, warehouse_id, transaction_type,
            quantity, reference_type, reference_id, reference_number,
            notes, performed_by
        ) VALUES (
            p_tenant_id, v_item.product_id, p_warehouse_id, 'in',
            v_item.quantity_received, 'purchase_order', v_receipt.purchase_order_id, 
            v_receipt.receipt_number,
            'Received via PO receipt ' || v_receipt.receipt_number,
            p_received_by
        );
        
        -- Update PO item received quantity
        UPDATE purchase_order_items
        SET quantity_received = quantity_received + v_item.quantity_received,
            status = CASE 
                WHEN quantity_received + v_item.quantity_received >= quantity_ordered THEN 'received'
                ELSE 'partially_received'
            END,
            updated_at = NOW()
        WHERE id = v_item.purchase_order_item_id;
        
        v_items_count := v_items_count + 1;
    END LOOP;
    
    -- Update receipt status
    UPDATE purchase_order_receipts
    SET status = 'confirmed', updated_at = NOW()
    WHERE id = p_receipt_id;
    
    -- Update PO status
    UPDATE purchase_orders po
    SET status = (
        SELECT CASE
            WHEN COUNT(*) FILTER (WHERE status = 'received') = COUNT(*) THEN 'received'
            WHEN COUNT(*) FILTER (WHERE status IN ('received', 'partially_received')) > 0 THEN 'partially_received'
            ELSE 'ordered'
        END
        FROM purchase_order_items
        WHERE purchase_order_id = po.id
    ),
    actual_delivery_date = CASE 
        WHEN actual_delivery_date IS NULL THEN CURRENT_DATE 
        ELSE actual_delivery_date 
    END,
    updated_at = NOW()
    WHERE id = v_receipt.purchase_order_id;
    
    RETURN QUERY SELECT TRUE, 'Items received successfully'::TEXT, v_items_count;
END;
$$ LANGUAGE plpgsql;


