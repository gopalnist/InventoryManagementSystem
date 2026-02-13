-- ============================================================================
-- 006_PRODUCTS.SQL - Products Schema
-- ============================================================================
-- Master product catalog - supports regular products and raw materials

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Basic Info
    sku VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Product Type
    product_type VARCHAR(20) NOT NULL DEFAULT 'goods',  -- goods, service, raw_material
    
    -- Classification
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    manufacturer_id UUID REFERENCES manufacturers(id) ON DELETE SET NULL,
    
    -- Product Identifiers
    upc VARCHAR(20),          -- Universal Product Code
    ean VARCHAR(20),          -- European Article Number
    mpn VARCHAR(50),          -- Manufacturer Part Number
    isbn VARCHAR(20),         -- ISBN for books
    
    -- Units
    primary_unit_id UUID REFERENCES units(id),
    secondary_unit_id UUID REFERENCES units(id),
    conversion_rate DECIMAL(10,4),  -- secondary = primary * conversion_rate
    
    -- Dimensions (stored in base units: cm for length, kg for weight)
    length DECIMAL(10,3),
    width DECIMAL(10,3),
    height DECIMAL(10,3),
    dimension_unit_id UUID REFERENCES units(id),  -- cm, in, m
    weight DECIMAL(10,3),
    weight_unit_id UUID REFERENCES units(id),     -- kg, g, lb
    
    -- Sales Information
    selling_price DECIMAL(12,2),
    mrp DECIMAL(12,2),
    sales_description TEXT,
    sales_account_id UUID,        -- Linked to Chart of Accounts (future)
    sales_tax_rate DECIMAL(5,2),
    is_taxable BOOLEAN NOT NULL DEFAULT true,
    
    -- Purchase Information
    cost_price DECIMAL(12,2),
    purchase_description TEXT,
    purchase_account_id UUID,     -- Linked to Chart of Accounts (future)
    purchase_tax_rate DECIMAL(5,2),
    preferred_vendor_id UUID REFERENCES parties(id),
    
    -- Tax & Compliance
    hsn_code VARCHAR(20),         -- HSN/SAC Code for GST
    
    -- Tracking Options
    track_batches BOOLEAN NOT NULL DEFAULT false,
    track_serials BOOLEAN NOT NULL DEFAULT false,
    track_expiry BOOLEAN NOT NULL DEFAULT false,
    has_variants BOOLEAN NOT NULL DEFAULT false,
    
    -- Inventory Settings
    reorder_level INT,
    reorder_qty INT,
    min_stock INT,
    max_stock INT,
    lead_time_days INT,           -- Supplier lead time
    
    -- Opening Stock (for initial setup)
    opening_stock DECIMAL(12,3) DEFAULT 0,
    opening_stock_value DECIMAL(12,2) DEFAULT 0,
    
    -- Images
    image_url TEXT,
    image_urls TEXT[],            -- Multiple product images
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    
    -- Unique SKU within tenant
    UNIQUE(tenant_id, sku)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(tenant_id, product_type);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_upc ON products(upc) WHERE upc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean) WHERE ean IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm ON products USING gin(sku gin_trgm_ops);


-- ============================================================================
-- PRODUCT VARIANTS (for products with variants like Size/Color)
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    variant_sku VARCHAR(100) NOT NULL,
    variant_name VARCHAR(255),
    
    -- Variant attributes as JSON
    attributes JSONB,  -- {"Size": "M", "Color": "Red"}
    
    -- Variant-specific pricing (optional, falls back to product pricing)
    cost_price DECIMAL(12,2),
    selling_price DECIMAL(12,2),
    mrp DECIMAL(12,2),
    
    -- Variant-specific identifiers
    upc VARCHAR(20),
    ean VARCHAR(20),
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, variant_sku)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_tenant ON product_variants(tenant_id);

-- ============================================================================
-- END OF PRODUCTS SCHEMA
-- ============================================================================

