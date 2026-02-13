-- ============================================================================
-- 001_INIT.SQL - Initial Setup & Extensions
-- ============================================================================
-- Run this first to set up required extensions

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for text search (optional but recommended)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- TENANTS TABLE (for multi-tenancy)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Insert demo tenant
INSERT INTO tenants (id, name, slug, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Company', 'demo', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- END OF INIT SCHEMA
-- ============================================================================

