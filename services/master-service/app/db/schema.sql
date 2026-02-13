-- ============================================================================
-- MASTER SERVICE - COMBINED DATABASE SCHEMA
-- ============================================================================
-- This is a combined schema file for reference.
-- For individual modules, see the /schemas directory.
--
-- Order of execution:
--   001_init.sql              - Extensions & Tenants
--   002_categories.sql        - Categories
--   003_units.sql             - Units of Measurement
--   004_brands_manufacturers.sql - Brands & Manufacturers
--   005_parties.sql           - Suppliers & Customers
--   006_products.sql          - Products & Variants
--   007_bundles.sql           - Product Bundles (BOM)
--   008_production.sql        - Production Orders
--   009_custom_fields.sql     - Custom Fields
--   010_outbox.sql            - Outbox Pattern (Event Sourcing for AI/Analytics)
--
-- To run migrations, use: python -m app.db.migrate --create-db
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Quick setup: Run each schema file in order
\i schemas/001_init.sql
\i schemas/002_categories.sql
\i schemas/003_units.sql
\i schemas/004_brands_manufacturers.sql
\i schemas/005_parties.sql
\i schemas/006_products.sql
\i schemas/007_bundles.sql
\i schemas/008_production.sql
\i schemas/009_custom_fields.sql
\i schemas/010_outbox.sql

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================


