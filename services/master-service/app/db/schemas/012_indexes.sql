-- ============================================================================
-- PERFORMANCE INDEXES FOR SCALABILITY
-- ============================================================================
-- These indexes optimize common query patterns for handling 100K+ records
-- Run time: Usually < 1 minute for small datasets, may take longer for large datasets
-- ============================================================================

-- ============================================================================
-- PRODUCTS TABLE INDEXES
-- ============================================================================

-- Primary listing query: tenant + active status (most common filter)
CREATE INDEX IF NOT EXISTS idx_products_tenant_active 
ON products(tenant_id, is_active);

-- Category filtering (common in product lists)
CREATE INDEX IF NOT EXISTS idx_products_category 
ON products(tenant_id, category_id) 
WHERE is_active = true;

-- Brand filtering
CREATE INDEX IF NOT EXISTS idx_products_brand 
ON products(tenant_id, brand_id) 
WHERE is_active = true;

-- Manufacturer filtering
CREATE INDEX IF NOT EXISTS idx_products_manufacturer 
ON products(tenant_id, manufacturer_id) 
WHERE is_active = true;

-- Sorting by created_at (recent products, dashboard)
CREATE INDEX IF NOT EXISTS idx_products_created_at 
ON products(tenant_id, created_at DESC);

-- Sorting by name (alphabetical listing)
CREATE INDEX IF NOT EXISTS idx_products_name 
ON products(tenant_id, name);

-- Sorting by selling_price (price-based sorting)
CREATE INDEX IF NOT EXISTS idx_products_price 
ON products(tenant_id, selling_price);

-- SKU lookup (unique constraint already creates index, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_products_sku 
ON products(tenant_id, sku);

-- Full-text search on name and description (for search functionality)
CREATE INDEX IF NOT EXISTS idx_products_search 
ON products USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')));

-- Product identifiers search (UPC, EAN, MPN, ISBN)
CREATE INDEX IF NOT EXISTS idx_products_upc ON products(upc) WHERE upc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean) WHERE ean IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_mpn ON products(mpn) WHERE mpn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_isbn ON products(isbn) WHERE isbn IS NOT NULL;

-- Low stock alert (reorder level check)
CREATE INDEX IF NOT EXISTS idx_products_low_stock 
ON products(tenant_id, reorder_level) 
WHERE is_active = true AND reorder_level IS NOT NULL;

-- ============================================================================
-- CATEGORIES TABLE INDEXES
-- ============================================================================

-- Category tree queries (parent lookup)
CREATE INDEX IF NOT EXISTS idx_categories_parent 
ON categories(tenant_id, parent_id);

-- Active categories listing
CREATE INDEX IF NOT EXISTS idx_categories_tenant_active 
ON categories(tenant_id, is_active);

-- Category name search
CREATE INDEX IF NOT EXISTS idx_categories_name 
ON categories(tenant_id, name);

-- ============================================================================
-- PARTIES TABLE INDEXES
-- ============================================================================

-- Party type filtering (suppliers vs customers)
CREATE INDEX IF NOT EXISTS idx_parties_type 
ON parties(tenant_id, party_type);

-- Active parties by type (most common query)
CREATE INDEX IF NOT EXISTS idx_parties_tenant_type_active 
ON parties(tenant_id, party_type, is_active);

-- Party name search
CREATE INDEX IF NOT EXISTS idx_parties_name 
ON parties(tenant_id, name);

-- Email lookup (for duplicate checking)
CREATE INDEX IF NOT EXISTS idx_parties_email 
ON parties(tenant_id, email) 
WHERE email IS NOT NULL;

-- Phone lookup
CREATE INDEX IF NOT EXISTS idx_parties_phone 
ON parties(tenant_id, phone) 
WHERE phone IS NOT NULL;

-- ============================================================================
-- UNITS TABLE INDEXES
-- ============================================================================

-- Units by tenant
CREATE INDEX IF NOT EXISTS idx_units_tenant 
ON units(tenant_id, is_active);

-- Unit symbol lookup
CREATE INDEX IF NOT EXISTS idx_units_symbol 
ON units(tenant_id, symbol);

-- ============================================================================
-- BRANDS TABLE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_brands_tenant_active 
ON brands(tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_brands_name 
ON brands(tenant_id, name);

-- ============================================================================
-- MANUFACTURERS TABLE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_manufacturers_tenant_active 
ON manufacturers(tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_manufacturers_name 
ON manufacturers(tenant_id, name);

-- ============================================================================
-- PRODUCT BUNDLES TABLE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bundles_tenant_active 
ON product_bundles(tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_bundles_created_at 
ON product_bundles(tenant_id, created_at DESC);

-- ============================================================================
-- BUNDLE COMPONENTS TABLE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bundle_components_bundle 
ON bundle_components(bundle_id);

CREATE INDEX IF NOT EXISTS idx_bundle_components_product 
ON bundle_components(product_id);

-- ============================================================================
-- PRODUCTION ORDERS TABLE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_production_orders_tenant_status 
ON production_orders(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_production_orders_bundle 
ON production_orders(bundle_id);

CREATE INDEX IF NOT EXISTS idx_production_orders_created_at 
ON production_orders(tenant_id, created_at DESC);

-- Order number lookup
CREATE INDEX IF NOT EXISTS idx_production_orders_number 
ON production_orders(tenant_id, order_number);

-- ============================================================================
-- OUTBOX TABLE INDEXES (for event processing)
-- ============================================================================

-- Already created in 010_outbox.sql, but adding composite for efficiency
CREATE INDEX IF NOT EXISTS idx_outbox_processing 
ON outbox(status, created_at) 
WHERE status IN ('pending', 'processing');

-- Aggregate timeline queries
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate_timeline 
ON outbox(tenant_id, aggregate_type, aggregate_id, created_at DESC);

-- ============================================================================
-- STATISTICS AND MAINTENANCE
-- ============================================================================

-- Update table statistics for query planner
ANALYZE products;
ANALYZE categories;
ANALYZE parties;
ANALYZE units;
ANALYZE brands;
ANALYZE manufacturers;
ANALYZE product_bundles;
ANALYZE bundle_components;
ANALYZE production_orders;
ANALYZE outbox;

-- ============================================================================
-- HELPFUL FUNCTIONS FOR LARGE DATASETS
-- ============================================================================

-- Function to get approximate row count (fast, no full table scan)
CREATE OR REPLACE FUNCTION get_approximate_count(table_name text)
RETURNS bigint AS $$
DECLARE
    count_estimate bigint;
BEGIN
    SELECT reltuples::bigint INTO count_estimate
    FROM pg_class
    WHERE relname = table_name;
    RETURN COALESCE(count_estimate, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to get cached counts (can be extended to use Redis)
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_tenant_id uuid)
RETURNS TABLE(
    products_count bigint,
    categories_count bigint,
    suppliers_count bigint,
    customers_count bigint,
    units_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM products WHERE tenant_id = p_tenant_id AND is_active = true),
        (SELECT COUNT(*) FROM categories WHERE tenant_id = p_tenant_id AND is_active = true),
        (SELECT COUNT(*) FROM parties WHERE tenant_id = p_tenant_id AND party_type = 'supplier' AND is_active = true),
        (SELECT COUNT(*) FROM parties WHERE tenant_id = p_tenant_id AND party_type = 'customer' AND is_active = true),
        (SELECT COUNT(*) FROM units WHERE tenant_id = p_tenant_id AND is_active = true);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEX VERIFICATION QUERY (run to check indexes were created)
-- ============================================================================
-- SELECT indexname, tablename, indexdef 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename, indexname;

RAISE NOTICE '✓ All performance indexes created successfully!';
RAISE NOTICE 'Run EXPLAIN ANALYZE on your queries to verify index usage.';




