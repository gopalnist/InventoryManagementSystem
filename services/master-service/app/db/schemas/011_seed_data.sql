-- ============================================================================
-- 011_SEED_DATA.SQL - Sample Data for Nourish You Products
-- ============================================================================
-- This creates sample data based on https://nourishyou.in/
-- ============================================================================

-- Demo Tenant ID
DO $$
DECLARE
    tenant_uuid UUID := '00000000-0000-0000-0000-000000000001';
    
    -- Category IDs
    cat_milk UUID;
    cat_dairy_alt UUID;
    cat_quinoa UUID;
    cat_seeds UUID;
    cat_breakfast UUID;
    cat_roasted UUID;
    cat_flour UUID;
    cat_snacks UUID;
    
    -- Brand IDs
    brand_nourish UUID;
    brand_onegood UUID;
    brand_organic UUID;
    
    -- Manufacturer IDs
    mfr_nourish UUID;
    mfr_onegood UUID;
    
    -- Unit IDs
    unit_pack UUID;
    unit_jar UUID;
    unit_bottle UUID;
    unit_pouch UUID;
    unit_kg UUID;
    unit_g UUID;
    unit_pcs UUID;
    
BEGIN
    -- ========================================================================
    -- CATEGORIES
    -- ========================================================================
    
    INSERT INTO categories (id, tenant_id, name, description, is_active) VALUES
        (uuid_generate_v4(), tenant_uuid, 'Plant-Based Milk', 'Dairy-free milk alternatives made from millets and plants', true)
    RETURNING id INTO cat_milk;
    
    INSERT INTO categories (id, tenant_id, name, description, is_active) VALUES
        (uuid_generate_v4(), tenant_uuid, 'Dairy-Free Alternatives', 'Curd, cheese, and ghee alternatives', true)
    RETURNING id INTO cat_dairy_alt;
    
    INSERT INTO categories (id, tenant_id, name, description, is_active) VALUES
        (uuid_generate_v4(), tenant_uuid, 'Quinoa', 'High-protein superfood grains', true)
    RETURNING id INTO cat_quinoa;
    
    INSERT INTO categories (id, tenant_id, name, description, is_active) VALUES
        (uuid_generate_v4(), tenant_uuid, 'Edible Seeds', 'Chia, flax, and other healthy seeds', true)
    RETURNING id INTO cat_seeds;
    
    INSERT INTO categories (id, tenant_id, name, description, is_active) VALUES
        (uuid_generate_v4(), tenant_uuid, 'Breakfast', 'Muesli, granola, and breakfast cereals', true)
    RETURNING id INTO cat_breakfast;
    
    INSERT INTO categories (id, tenant_id, name, description, is_active) VALUES
        (uuid_generate_v4(), tenant_uuid, 'Roasted Seeds', 'Ready-to-eat roasted seeds', true)
    RETURNING id INTO cat_roasted;
    
    INSERT INTO categories (id, tenant_id, name, description, is_active) VALUES
        (uuid_generate_v4(), tenant_uuid, 'Specialty Flours', 'Millet and gluten-free flours', true)
    RETURNING id INTO cat_flour;
    
    INSERT INTO categories (id, tenant_id, name, description, is_active) VALUES
        (uuid_generate_v4(), tenant_uuid, 'Healthy Snacks', 'Nutritious snacking options', true)
    RETURNING id INTO cat_snacks;
    
    -- ========================================================================
    -- BRANDS
    -- ========================================================================
    
    INSERT INTO brands (id, tenant_id, name, description, website, is_active) VALUES
        (uuid_generate_v4(), tenant_uuid, 'Nourish You', 'Premium plant-based food products from India', 'https://nourishyou.in', true)
    RETURNING id INTO brand_nourish;
    
    INSERT INTO brands (id, tenant_id, name, description, website, is_active) VALUES
        (uuid_generate_v4(), tenant_uuid, 'One Good', 'Innovative plant-based dairy alternatives', 'https://onegood.in', true)
    RETURNING id INTO brand_onegood;
    
    INSERT INTO brands (id, tenant_id, name, description, website, is_active) VALUES
        (uuid_generate_v4(), tenant_uuid, 'Organic India', 'Certified organic health products', 'https://organicindia.com', true)
    RETURNING id INTO brand_organic;
    
    -- ========================================================================
    -- MANUFACTURERS
    -- ========================================================================
    
    INSERT INTO manufacturers (id, tenant_id, name, description, country, is_active) VALUES
        (uuid_generate_v4(), tenant_uuid, 'Nourish You Foods Pvt Ltd', 'Manufacturer of Nourish You branded products', 'India', true)
    RETURNING id INTO mfr_nourish;
    
    INSERT INTO manufacturers (id, tenant_id, name, description, country, is_active) VALUES
        (uuid_generate_v4(), tenant_uuid, 'One Good Foods', 'Plant-based food manufacturer', 'India', true)
    RETURNING id INTO mfr_onegood;
    
    -- ========================================================================
    -- ADDITIONAL UNITS (if not exists)
    -- ========================================================================
    
    -- Get or create units
    SELECT id INTO unit_pack FROM units WHERE tenant_id = tenant_uuid AND symbol = 'pack' LIMIT 1;
    IF unit_pack IS NULL THEN
        INSERT INTO units (id, tenant_id, name, symbol, unit_type, is_active) VALUES
            (uuid_generate_v4(), tenant_uuid, 'Pack', 'pack', 'quantity', true)
        RETURNING id INTO unit_pack;
    END IF;
    
    SELECT id INTO unit_jar FROM units WHERE tenant_id = tenant_uuid AND symbol = 'jar' LIMIT 1;
    IF unit_jar IS NULL THEN
        INSERT INTO units (id, tenant_id, name, symbol, unit_type, is_active) VALUES
            (uuid_generate_v4(), tenant_uuid, 'Jar', 'jar', 'quantity', true)
        RETURNING id INTO unit_jar;
    END IF;
    
    SELECT id INTO unit_bottle FROM units WHERE tenant_id = tenant_uuid AND symbol = 'btl' LIMIT 1;
    IF unit_bottle IS NULL THEN
        INSERT INTO units (id, tenant_id, name, symbol, unit_type, is_active) VALUES
            (uuid_generate_v4(), tenant_uuid, 'Bottle', 'btl', 'quantity', true)
        RETURNING id INTO unit_bottle;
    END IF;
    
    SELECT id INTO unit_pouch FROM units WHERE tenant_id = tenant_uuid AND symbol = 'pch' LIMIT 1;
    IF unit_pouch IS NULL THEN
        INSERT INTO units (id, tenant_id, name, symbol, unit_type, is_active) VALUES
            (uuid_generate_v4(), tenant_uuid, 'Pouch', 'pch', 'quantity', true)
        RETURNING id INTO unit_pouch;
    END IF;
    
    SELECT id INTO unit_kg FROM units WHERE tenant_id = tenant_uuid AND symbol = 'kg' LIMIT 1;
    SELECT id INTO unit_g FROM units WHERE tenant_id = tenant_uuid AND symbol = 'g' LIMIT 1;
    SELECT id INTO unit_pcs FROM units WHERE tenant_id = tenant_uuid AND symbol = 'pcs' LIMIT 1;
    
    -- ========================================================================
    -- PRODUCTS - Nourish You Catalog
    -- ========================================================================
    
    -- Plant-Based Milk Products
    INSERT INTO products (tenant_id, sku, name, description, product_type, category_id, brand_id, manufacturer_id, primary_unit_id, selling_price, mrp, cost_price, hsn_code, is_taxable, sales_tax_rate, track_batches, track_expiry, reorder_level, is_active) VALUES
        (tenant_uuid, 'NY-MLK-001', 'Millet Mlk Original - 200ml', 'The most delicious plant based mlk. Experience the pure goodness of Original Millet Milk, the best dairy alternative.', 'goods', cat_milk, brand_nourish, mfr_nourish, unit_pack, 330, 350, 250, '2202', true, 5, true, true, 50, true),
        (tenant_uuid, 'NY-MLK-002', 'Millet Mlk Chocolate - 200ml', 'Rich, decadent taste of Chocolate Millet Mlk. The healthiest chocolatey treat out there.', 'goods', cat_milk, brand_nourish, mfr_nourish, unit_pack, 330, 350, 260, '2202', true, 5, true, true, 50, true),
        (tenant_uuid, 'NY-MLK-003', 'Millet Mlk Original - 1L', 'Family pack of Original Millet Milk. Pure, creamy, and nutritious.', 'goods', cat_milk, brand_nourish, mfr_nourish, unit_pack, 899, 999, 650, '2202', true, 5, true, true, 30, true),
        (tenant_uuid, 'NY-MLK-004', 'Oat Mlk Barista Edition - 1L', 'Perfect for coffee and tea. Froths beautifully for lattes and cappuccinos.', 'goods', cat_milk, brand_nourish, mfr_nourish, unit_pack, 449, 499, 320, '2202', true, 5, true, true, 40, true);
    
    -- Dairy-Free Alternatives
    INSERT INTO products (tenant_id, sku, name, description, product_type, category_id, brand_id, manufacturer_id, primary_unit_id, selling_price, mrp, cost_price, hsn_code, is_taxable, sales_tax_rate, track_batches, track_expiry, reorder_level, is_active) VALUES
        (tenant_uuid, 'NY-KRD-001', 'Peanut Kurd - 450g', 'Creamy, dairy-free delight made from high-quality peanuts. Rich in probiotics and plant protein.', 'goods', cat_dairy_alt, brand_nourish, mfr_nourish, unit_jar, 190, 210, 140, '2106', true, 5, true, true, 30, true),
        (tenant_uuid, 'NY-KRD-002', 'Coconut Kurd - 400g', 'Smooth and tangy coconut-based curd. Perfect for smoothies and desserts.', 'goods', cat_dairy_alt, brand_nourish, mfr_nourish, unit_jar, 180, 200, 130, '2106', true, 5, true, true, 30, true),
        (tenant_uuid, 'NY-PRD-001', 'Plant-based Prodigee - 500ml', 'Golden, aromatic, and 100% plant-powered ghee alternative. Zero trans fat, clean label.', 'goods', cat_dairy_alt, brand_nourish, mfr_nourish, unit_bottle, 499, 549, 380, '1517', true, 5, true, true, 25, true);
    
    -- Quinoa Products
    INSERT INTO products (tenant_id, sku, name, description, product_type, category_id, brand_id, manufacturer_id, primary_unit_id, selling_price, mrp, cost_price, hsn_code, is_taxable, sales_tax_rate, track_batches, track_expiry, reorder_level, is_active) VALUES
        (tenant_uuid, 'NY-QNA-001', 'White Quinoa - 500g', 'Whole protein grain, excellent choice for high-protein diet. Homegrown superfood.', 'goods', cat_quinoa, brand_nourish, mfr_nourish, unit_pouch, 289, 320, 220, '1008', false, 0, true, true, 40, true),
        (tenant_uuid, 'NY-QNA-002', 'White Quinoa - 1kg', 'Value pack of premium white quinoa. Cook like rice, eat like royalty.', 'goods', cat_quinoa, brand_nourish, mfr_nourish, unit_pouch, 549, 599, 420, '1008', false, 0, true, true, 30, true),
        (tenant_uuid, 'NY-QNA-003', 'Red Quinoa - 500g', 'Nuttier flavor and crunchier texture. High in antioxidants.', 'goods', cat_quinoa, brand_nourish, mfr_nourish, unit_pouch, 319, 350, 240, '1008', false, 0, true, true, 35, true),
        (tenant_uuid, 'NY-QNA-004', 'Tricolor Quinoa - 500g', 'Perfect blend of white, red, and black quinoa. Complete nutrition.', 'goods', cat_quinoa, brand_nourish, mfr_nourish, unit_pouch, 349, 380, 260, '1008', false, 0, true, true, 30, true);
    
    -- Edible Seeds
    INSERT INTO products (tenant_id, sku, name, description, product_type, category_id, brand_id, manufacturer_id, primary_unit_id, selling_price, mrp, cost_price, hsn_code, is_taxable, sales_tax_rate, track_batches, track_expiry, reorder_level, is_active) VALUES
        (tenant_uuid, 'NY-SED-001', 'Black Chia Seeds - 250g', 'Nature''s super seeds, packed with Omega-3 and Fiber. Hydrating and protein packed.', 'goods', cat_seeds, brand_nourish, mfr_nourish, unit_pouch, 225, 250, 170, '1207', false, 0, true, true, 35, true),
        (tenant_uuid, 'NY-SED-002', 'Black Chia Seeds - 500g', 'Value pack of premium chia seeds. Essential for smoothies and puddings.', 'goods', cat_seeds, brand_nourish, mfr_nourish, unit_pouch, 425, 475, 320, '1207', false, 0, true, true, 25, true),
        (tenant_uuid, 'NY-SED-003', 'Flax Seeds - 400g', 'Golden flax seeds rich in lignans. Support digestive health.', 'goods', cat_seeds, brand_nourish, mfr_nourish, unit_pouch, 179, 199, 130, '1207', false, 0, true, true, 40, true),
        (tenant_uuid, 'NY-SED-004', 'Hemp Seeds - 200g', 'Complete protein with all essential amino acids. Nutty and versatile.', 'goods', cat_seeds, brand_nourish, mfr_nourish, unit_pouch, 449, 499, 350, '1207', false, 0, true, true, 25, true);
    
    -- Breakfast Products
    INSERT INTO products (tenant_id, sku, name, description, product_type, category_id, brand_id, manufacturer_id, primary_unit_id, selling_price, mrp, cost_price, hsn_code, is_taxable, sales_tax_rate, track_batches, track_expiry, reorder_level, is_active) VALUES
        (tenant_uuid, 'NY-BRK-001', 'Super Muesli - Belgium Dark Chocolate - 400g', 'Plant-based, gluten-free millet blend with Belgium dark chocolate.', 'goods', cat_breakfast, brand_nourish, mfr_nourish, unit_pouch, 560, 620, 420, '1904', true, 12, true, true, 20, true),
        (tenant_uuid, 'NY-BRK-002', 'Super Muesli - Mixed Berries - 400g', 'Gluten-free muesli with mixed berries. Perfect healthy breakfast.', 'goods', cat_breakfast, brand_nourish, mfr_nourish, unit_pouch, 540, 599, 400, '1904', true, 12, true, true, 20, true),
        (tenant_uuid, 'NY-BRK-003', 'Overnight Oats - Apple Cinnamon - 300g', 'Ready to eat overnight oats. Just add milk and refrigerate.', 'goods', cat_breakfast, brand_nourish, mfr_nourish, unit_jar, 350, 399, 260, '1904', true, 12, true, true, 25, true),
        (tenant_uuid, 'NY-BRK-004', 'Granola - Honey Almond - 450g', 'Crunchy clusters with real honey and almonds.', 'goods', cat_breakfast, brand_nourish, mfr_nourish, unit_pouch, 449, 499, 340, '1904', true, 12, true, true, 25, true);
    
    -- Roasted Seeds
    INSERT INTO products (tenant_id, sku, name, description, product_type, category_id, brand_id, manufacturer_id, primary_unit_id, selling_price, mrp, cost_price, hsn_code, is_taxable, sales_tax_rate, track_batches, track_expiry, reorder_level, is_active) VALUES
        (tenant_uuid, 'NY-RST-001', 'Roasted Pumpkin Seeds - 150g', 'Crunchy, lightly salted roasted pumpkin seeds. Rich in zinc and magnesium.', 'goods', cat_roasted, brand_nourish, mfr_nourish, unit_pouch, 249, 280, 180, '2008', true, 5, true, true, 30, true),
        (tenant_uuid, 'NY-RST-002', 'Roasted Sunflower Seeds - 150g', 'Lightly roasted sunflower seeds. Great source of Vitamin E.', 'goods', cat_roasted, brand_nourish, mfr_nourish, unit_pouch, 199, 220, 140, '2008', true, 5, true, true, 30, true),
        (tenant_uuid, 'NY-RST-003', 'Trail Mix - Energy Boost - 200g', 'Perfect blend of seeds, nuts, and dried fruits.', 'goods', cat_roasted, brand_nourish, mfr_nourish, unit_pouch, 299, 349, 220, '2008', true, 5, true, true, 25, true);
    
    -- Specialty Flours
    INSERT INTO products (tenant_id, sku, name, description, product_type, category_id, brand_id, manufacturer_id, primary_unit_id, selling_price, mrp, cost_price, hsn_code, is_taxable, sales_tax_rate, track_batches, track_expiry, reorder_level, is_active) VALUES
        (tenant_uuid, 'NY-FLR-001', 'Ragi Flour - 500g', 'Homegrown finger millet flour. Gluten-free, rich in calcium and iron.', 'goods', cat_flour, brand_nourish, mfr_nourish, unit_pouch, 120, 140, 85, '1102', false, 0, true, true, 40, true),
        (tenant_uuid, 'NY-FLR-002', 'Jowar Flour - 500g', 'Premium sorghum flour. Gluten-free alternative for rotis and baking.', 'goods', cat_flour, brand_nourish, mfr_nourish, unit_pouch, 110, 130, 75, '1102', false, 0, true, true, 40, true),
        (tenant_uuid, 'NY-FLR-003', 'Bajra Flour - 500g', 'Pearl millet flour. Traditional and nutritious.', 'goods', cat_flour, brand_nourish, mfr_nourish, unit_pouch, 99, 120, 70, '1102', false, 0, true, true, 40, true),
        (tenant_uuid, 'NY-FLR-004', 'Multigrain Atta - 1kg', 'Blend of 7 nutritious grains. Perfect for healthy rotis.', 'goods', cat_flour, brand_nourish, mfr_nourish, unit_pouch, 189, 220, 140, '1102', false, 0, true, true, 35, true);
    
    -- Healthy Snacks
    INSERT INTO products (tenant_id, sku, name, description, product_type, category_id, brand_id, manufacturer_id, primary_unit_id, selling_price, mrp, cost_price, hsn_code, is_taxable, sales_tax_rate, track_batches, track_expiry, reorder_level, is_active) VALUES
        (tenant_uuid, 'NY-SNK-001', 'Quinoa Puffs - Masala - 50g', 'Crunchy quinoa puffs with Indian masala flavor. Healthy snacking.', 'goods', cat_snacks, brand_nourish, mfr_nourish, unit_pack, 55, 65, 35, '1905', true, 12, true, true, 60, true),
        (tenant_uuid, 'NY-SNK-002', 'Millet Cookies - Chocolate Chip - 150g', 'Delicious millet-based cookies with real chocolate chips.', 'goods', cat_snacks, brand_nourish, mfr_nourish, unit_pack, 175, 199, 120, '1905', true, 12, true, true, 40, true),
        (tenant_uuid, 'NY-SNK-003', 'Protein Bars - Peanut Butter - 60g', 'High protein snack bar with natural peanut butter.', 'goods', cat_snacks, brand_nourish, mfr_nourish, unit_pack, 99, 120, 65, '1905', true, 12, true, true, 50, true),
        (tenant_uuid, 'NY-SNK-004', 'Ragi Chips - Tangy Tomato - 100g', 'Baked ragi chips with tangy tomato flavor. Low fat.', 'goods', cat_snacks, brand_nourish, mfr_nourish, unit_pack, 79, 99, 50, '1905', true, 12, true, true, 45, true);
    
    RAISE NOTICE 'Seed data inserted successfully!';
    RAISE NOTICE 'Categories: 8';
    RAISE NOTICE 'Brands: 3';
    RAISE NOTICE 'Manufacturers: 2';
    RAISE NOTICE 'Products: 30';
    
END $$;

-- ============================================================================
-- VERIFY DATA
-- ============================================================================

SELECT 'Categories' as entity, COUNT(*) as count FROM categories WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'Brands', COUNT(*) FROM brands WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'Manufacturers', COUNT(*) FROM manufacturers WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'Products', COUNT(*) FROM products WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'Units', COUNT(*) FROM units WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

