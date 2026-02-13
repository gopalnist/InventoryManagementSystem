-- ============================================================================
-- Seed Inventory Data for Nourish You IMS
-- ============================================================================
-- Run this script to populate sample warehouses and inventory data

-- Get tenant ID (assuming single tenant demo)
DO $$
DECLARE
    v_tenant_id UUID;
    v_wh_blr UUID;
    v_wh_del UUID;
    v_wh_mum UUID;
BEGIN
    -- Get the first tenant
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No tenant found. Please create a tenant first.';
    END IF;
    
    RAISE NOTICE 'Using tenant: %', v_tenant_id;
    
    -- ========================================================================
    -- Create Warehouses
    -- ========================================================================
    
    -- Check if warehouses already exist
    IF NOT EXISTS (SELECT 1 FROM warehouses WHERE tenant_id = v_tenant_id) THEN
        
        -- Bengaluru Main Warehouse (Default)
        INSERT INTO warehouses (
            tenant_id, code, name, warehouse_type,
            address_line1, city, state, country, pincode,
            contact_name, contact_phone, contact_email,
            is_active, is_default, accepts_returns
        ) VALUES (
            v_tenant_id, 'BLR-MAIN', 'Bengaluru Main Warehouse', 'internal',
            'No. 45, Industrial Layout, Peenya',
            'Bengaluru', 'Karnataka', 'India', '560058',
            'Suresh Kumar', '+91 98765 43210', 'warehouse.blr@nourishyou.in',
            true, true, true
        ) RETURNING id INTO v_wh_blr;
        
        -- Delhi Warehouse
        INSERT INTO warehouses (
            tenant_id, code, name, warehouse_type,
            address_line1, city, state, country, pincode,
            contact_name, contact_phone, contact_email,
            is_active, is_default, accepts_returns
        ) VALUES (
            v_tenant_id, 'DEL-01', 'Delhi Distribution Center', '3pl',
            'Plot 23, Sector 62, Noida',
            'Delhi NCR', 'Delhi', 'India', '201301',
            'Amit Singh', '+91 98765 43211', 'warehouse.del@nourishyou.in',
            true, false, true
        ) RETURNING id INTO v_wh_del;
        
        -- Mumbai Warehouse
        INSERT INTO warehouses (
            tenant_id, code, name, warehouse_type,
            address_line1, city, state, country, pincode,
            contact_name, contact_phone, contact_email,
            is_active, is_default, accepts_returns
        ) VALUES (
            v_tenant_id, 'MUM-01', 'Mumbai Fulfillment Hub', '3pl',
            'MIDC, Bhiwandi',
            'Mumbai', 'Maharashtra', 'India', '421302',
            'Rahul Patil', '+91 98765 43212', 'warehouse.mum@nourishyou.in',
            true, false, true
        ) RETURNING id INTO v_wh_mum;
        
        RAISE NOTICE 'Created 3 warehouses: BLR-MAIN, DEL-01, MUM-01';
        
    ELSE
        -- Get existing warehouse IDs
        SELECT id INTO v_wh_blr FROM warehouses WHERE tenant_id = v_tenant_id AND code = 'BLR-MAIN';
        SELECT id INTO v_wh_del FROM warehouses WHERE tenant_id = v_tenant_id AND code = 'DEL-01';
        SELECT id INTO v_wh_mum FROM warehouses WHERE tenant_id = v_tenant_id AND code = 'MUM-01';
        
        RAISE NOTICE 'Warehouses already exist, using existing ones';
    END IF;
    
    -- ========================================================================
    -- Create Inventory Records
    -- ========================================================================
    
    -- Only insert if inventory is empty
    IF NOT EXISTS (SELECT 1 FROM inventory WHERE tenant_id = v_tenant_id LIMIT 1) THEN
        
        -- Insert inventory for each product in all warehouses
        INSERT INTO inventory (
            tenant_id, product_id, warehouse_id,
            on_hand_qty, reserved_qty, incoming_qty,
            reorder_level, reorder_qty, unit_cost
        )
        SELECT 
            v_tenant_id,
            p.id,
            v_wh_blr,
            -- Random quantities for demo
            FLOOR(RANDOM() * 500 + 50)::numeric,  -- on_hand: 50-550
            FLOOR(RANDOM() * 20)::numeric,         -- reserved: 0-20
            FLOOR(RANDOM() * 100)::numeric,        -- incoming: 0-100
            FLOOR(RANDOM() * 50 + 20)::numeric,    -- reorder_level: 20-70
            FLOOR(RANDOM() * 100 + 50)::numeric,   -- reorder_qty: 50-150
            COALESCE(p.cost_price, 0)
        FROM products p
        WHERE p.tenant_id = v_tenant_id
        ON CONFLICT (tenant_id, product_id, warehouse_id) DO NOTHING;
        
        RAISE NOTICE 'Created inventory records for BLR-MAIN warehouse';
        
        -- Also add some inventory to Delhi (fewer products)
        INSERT INTO inventory (
            tenant_id, product_id, warehouse_id,
            on_hand_qty, reserved_qty, incoming_qty,
            reorder_level, reorder_qty, unit_cost
        )
        SELECT 
            v_tenant_id,
            p.id,
            v_wh_del,
            FLOOR(RANDOM() * 200 + 20)::numeric,
            FLOOR(RANDOM() * 10)::numeric,
            0,
            FLOOR(RANDOM() * 30 + 10)::numeric,
            FLOOR(RANDOM() * 50 + 30)::numeric,
            COALESCE(p.cost_price, 0)
        FROM products p
        WHERE p.tenant_id = v_tenant_id
        AND RANDOM() > 0.3  -- Only 70% of products
        ON CONFLICT (tenant_id, product_id, warehouse_id) DO NOTHING;
        
        RAISE NOTICE 'Created inventory records for DEL-01 warehouse';
        
        -- Mumbai warehouse (fewer products still)
        INSERT INTO inventory (
            tenant_id, product_id, warehouse_id,
            on_hand_qty, reserved_qty, incoming_qty,
            reorder_level, reorder_qty, unit_cost
        )
        SELECT 
            v_tenant_id,
            p.id,
            v_wh_mum,
            FLOOR(RANDOM() * 150 + 10)::numeric,
            FLOOR(RANDOM() * 5)::numeric,
            0,
            FLOOR(RANDOM() * 20 + 10)::numeric,
            FLOOR(RANDOM() * 40 + 20)::numeric,
            COALESCE(p.cost_price, 0)
        FROM products p
        WHERE p.tenant_id = v_tenant_id
        AND RANDOM() > 0.5  -- Only 50% of products
        ON CONFLICT (tenant_id, product_id, warehouse_id) DO NOTHING;
        
        RAISE NOTICE 'Created inventory records for MUM-01 warehouse';
        
        -- Create some low stock items for testing
        UPDATE inventory
        SET on_hand_qty = reorder_level - 5,
            reserved_qty = 0
        WHERE tenant_id = v_tenant_id
        AND id IN (
            SELECT id FROM inventory 
            WHERE tenant_id = v_tenant_id 
            ORDER BY RANDOM() 
            LIMIT 5
        );
        
        -- Create some out of stock items
        UPDATE inventory
        SET on_hand_qty = 0,
            reserved_qty = 0
        WHERE tenant_id = v_tenant_id
        AND id IN (
            SELECT id FROM inventory 
            WHERE tenant_id = v_tenant_id 
            AND on_hand_qty > 0
            ORDER BY RANDOM() 
            LIMIT 3
        );
        
        RAISE NOTICE 'Created low stock and out of stock scenarios for testing';
        
    ELSE
        RAISE NOTICE 'Inventory data already exists, skipping';
    END IF;
    
    -- ========================================================================
    -- Create Sample Stock Transactions
    -- ========================================================================
    
    IF NOT EXISTS (SELECT 1 FROM inventory_transactions WHERE tenant_id = v_tenant_id LIMIT 1) THEN
        
        -- Insert some sample transactions
        INSERT INTO inventory_transactions (
            tenant_id, inventory_id, transaction_type, quantity, unit_cost,
            reference_type, reference_number, notes
        )
        SELECT 
            v_tenant_id,
            i.id,
            'in',
            FLOOR(RANDOM() * 100 + 20)::numeric,
            i.unit_cost,
            'purchase',
            'PO-' || LPAD((RANDOM() * 1000)::int::text, 4, '0'),
            'Initial stock receipt'
        FROM inventory i
        WHERE i.tenant_id = v_tenant_id
        LIMIT 20;
        
        RAISE NOTICE 'Created sample stock transactions';
        
    END IF;
    
    RAISE NOTICE 'Seed completed successfully!';
    
END $$;

-- Summary query
SELECT 
    'Warehouses' as entity,
    COUNT(*) as count
FROM warehouses
UNION ALL
SELECT 
    'Inventory Records',
    COUNT(*)
FROM inventory
UNION ALL
SELECT
    'Total Stock Value',
    ROUND(SUM(on_hand_qty * unit_cost)::numeric, 2)
FROM inventory;


