-- ============================================================================
-- 002_CATEGORIES.SQL - Categories Schema
-- ============================================================================
-- Hierarchical product categories (supports nesting)

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    level INT NOT NULL DEFAULT 0,
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    
    -- Unique name per parent within tenant
    UNIQUE(tenant_id, name, parent_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_categories_name_trgm ON categories USING gin(name gin_trgm_ops);

-- ============================================================================
-- END OF CATEGORIES SCHEMA
-- ============================================================================

