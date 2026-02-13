-- =============================================================================
-- AMS Schema: Allocation Management System
-- Version: 2.0 - With Multi-Tenant Support
-- =============================================================================
-- 
-- Architecture:
--   Tenant (SaaS Customer)
--     └── Vendor (Brand/Company that owns inventory)
--           ├── Warehouses
--           ├── SKUs
--           ├── Inventory
--           └── Purchase Orders
--
-- =============================================================================

BEGIN;

-- =============================================================================
-- TENANTS - SaaS customers (top-level isolation)
-- =============================================================================
CREATE TABLE IF NOT EXISTS tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code   TEXT NOT NULL UNIQUE,
  tenant_name   TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  settings      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- VENDORS - Brands/Companies managed by a tenant
-- =============================================================================
CREATE TABLE IF NOT EXISTS vendors (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_code   TEXT NOT NULL,
  vendor_name   TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, vendor_code)
);

CREATE INDEX IF NOT EXISTS idx_vendors_tenant ON vendors(tenant_id);

-- =============================================================================
-- VENDOR SKUs - Products owned by vendors
-- =============================================================================
CREATE TABLE IF NOT EXISTS vendor_skus (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id     BIGINT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  sku_code      TEXT NOT NULL,
  sku_name      TEXT,
  ean           TEXT,
  uom           TEXT DEFAULT 'EACH',  -- Unit of measure
  mrp           NUMERIC(18,2),
  selling_price NUMERIC(18,2),
  cost_price    NUMERIC(18,2),
  currency      TEXT DEFAULT 'INR',
  hsn_code      TEXT,
  gst_rate      NUMERIC(5,2),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, vendor_id, sku_code)
);

CREATE INDEX IF NOT EXISTS idx_vendor_skus_tenant ON vendor_skus(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_skus_vendor ON vendor_skus(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_skus_ean ON vendor_skus(ean) WHERE ean IS NOT NULL;

-- =============================================================================
-- VENDOR WAREHOUSES - Storage locations
-- =============================================================================
CREATE TABLE IF NOT EXISTS vendor_warehouses (
  id                    BIGSERIAL PRIMARY KEY,
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id             BIGINT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  warehouse_code        TEXT NOT NULL,
  warehouse_name        TEXT NOT NULL,
  address               TEXT,
  city                  TEXT,
  state                 TEXT,
  pincode               TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, vendor_id, warehouse_code)
);

CREATE INDEX IF NOT EXISTS idx_vendor_warehouses_tenant ON vendor_warehouses(tenant_id);

-- =============================================================================
-- CHANNEL FULFILLMENT CENTERS - Amazon FC, Zepto Darkstore, etc.
-- =============================================================================
CREATE TABLE IF NOT EXISTS channel_fulfillment_centers (
  id                      BIGSERIAL PRIMARY KEY,
  channel                 TEXT NOT NULL,  -- amazon, zepto, flipkart, etc.
  fc_code                 TEXT NOT NULL,
  fc_name                 TEXT,
  fc_type                 TEXT,  -- FC, DARKSTORE, HUB, STORE
  city                    TEXT,
  state                   TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel, fc_code)
);

CREATE INDEX IF NOT EXISTS idx_fc_channel ON channel_fulfillment_centers(channel);

-- =============================================================================
-- WAREHOUSE → FC MAPPING - Which warehouse serves which FC
-- =============================================================================
CREATE TABLE IF NOT EXISTS warehouse_fc_mappings (
  id                  BIGSERIAL PRIMARY KEY,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id           BIGINT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  warehouse_id        BIGINT NOT NULL REFERENCES vendor_warehouses(id) ON DELETE CASCADE,
  channel             TEXT NOT NULL,
  fc_code             TEXT NOT NULL,
  priority            INTEGER DEFAULT 1,  -- For multi-warehouse scenarios
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, vendor_id, channel, fc_code, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_wh_fc_mapping_lookup 
  ON warehouse_fc_mappings(tenant_id, vendor_id, channel, fc_code);

-- =============================================================================
-- CHANNEL ITEM MAPPINGS - ASIN/EAN/FSN → Vendor SKU
-- =============================================================================
CREATE TABLE IF NOT EXISTS channel_sku_mappings (
  id                  BIGSERIAL PRIMARY KEY,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id           BIGINT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_sku_id       BIGINT NOT NULL REFERENCES vendor_skus(id) ON DELETE CASCADE,
  channel             TEXT NOT NULL,
  identifier_type     TEXT NOT NULL,  -- ASIN, EAN, FSN, MERCHANT_SKU, etc.
  identifier_value    TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, vendor_id, channel, identifier_type, identifier_value)
);

CREATE INDEX IF NOT EXISTS idx_channel_sku_lookup 
  ON channel_sku_mappings(tenant_id, vendor_id, channel, identifier_type, identifier_value);

-- =============================================================================
-- INVENTORY - Current stock levels (per warehouse + SKU)
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventory (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id         BIGINT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  warehouse_id      BIGINT NOT NULL REFERENCES vendor_warehouses(id) ON DELETE CASCADE,
  sku_id            BIGINT NOT NULL REFERENCES vendor_skus(id) ON DELETE CASCADE,
  on_hand_qty       NUMERIC(18,3) NOT NULL DEFAULT 0 CHECK (on_hand_qty >= 0),
  reserved_qty      NUMERIC(18,3) NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  available_qty     NUMERIC(18,3) GENERATED ALWAYS AS (on_hand_qty - reserved_qty) STORED,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, warehouse_id, sku_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lookup ON inventory(tenant_id, vendor_id, sku_id);

-- =============================================================================
-- INVENTORY TRANSACTIONS - Audit trail
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id         BIGINT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  warehouse_id      BIGINT REFERENCES vendor_warehouses(id) ON DELETE SET NULL,
  sku_id            BIGINT REFERENCES vendor_skus(id) ON DELETE SET NULL,
  tx_type           TEXT NOT NULL,  -- UPLOAD, PO_RESERVE, PO_RELEASE, ADJUSTMENT
  qty_change        NUMERIC(18,3) NOT NULL,
  qty_type          TEXT NOT NULL,  -- ON_HAND, RESERVED
  reference_type    TEXT,  -- PURCHASE_ORDER, INVENTORY_UPLOAD
  reference_id      BIGINT,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_tx_tenant ON inventory_transactions(tenant_id, created_at DESC);

-- =============================================================================
-- PURCHASE ORDERS - Incoming orders from channels
-- =============================================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id                    BIGSERIAL PRIMARY KEY,
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id             BIGINT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  channel               TEXT NOT NULL,
  po_number             TEXT NOT NULL,
  po_date               TIMESTAMPTZ,
  fc_code               TEXT,
  delivery_window_start TIMESTAMPTZ,
  delivery_window_end   TIMESTAMPTZ,
  
  -- Status tracking
  status                TEXT NOT NULL DEFAULT 'RECEIVED' 
                        CHECK (status IN ('RECEIVED', 'VALIDATED', 'FAILED')),
  fulfillment_status    TEXT CHECK (fulfillment_status IN ('FULFILLED', 'PARTIAL', 'NONE')),
  validated_at          TIMESTAMPTZ,
  
  -- Cancellation
  is_cancelled          BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at          TIMESTAMPTZ,
  cancel_reason         TEXT,
  
  -- File tracking
  source_filename       TEXT,
  validation_report     TEXT,
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, vendor_id, channel, po_number)
);

CREATE INDEX IF NOT EXISTS idx_po_tenant ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(tenant_id, vendor_id, status, created_at DESC);

-- =============================================================================
-- PURCHASE ORDER LINES - Line items in each PO
-- =============================================================================
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id                  BIGSERIAL PRIMARY KEY,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  po_id               BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_number         INTEGER NOT NULL,
  
  -- What was ordered
  channel_identifier_type  TEXT,  -- ASIN, EAN, etc.
  channel_identifier_value TEXT,
  item_name           TEXT,
  ordered_qty         NUMERIC(18,3) NOT NULL CHECK (ordered_qty > 0),
  unit_price          NUMERIC(18,2),
  
  -- Resolution
  sku_id              BIGINT REFERENCES vendor_skus(id) ON DELETE SET NULL,
  sku_code            TEXT,  -- Denormalized for display
  
  -- Allocation results (after validation)
  available_qty       NUMERIC(18,3),
  allocated_qty       NUMERIC(18,3) DEFAULT 0,
  unallocated_qty     NUMERIC(18,3),
  line_status         TEXT CHECK (line_status IN ('FULFILLED', 'PARTIAL', 'NONE', 'SKU_NOT_FOUND')),
  status_reason       TEXT,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (po_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_po_lines_po ON purchase_order_lines(po_id);

-- =============================================================================
-- PO ALLOCATIONS - Reserved inventory per line
-- =============================================================================
CREATE TABLE IF NOT EXISTS po_allocations (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  po_line_id        BIGINT NOT NULL REFERENCES purchase_order_lines(id) ON DELETE CASCADE,
  warehouse_id      BIGINT NOT NULL REFERENCES vendor_warehouses(id) ON DELETE CASCADE,
  sku_id            BIGINT NOT NULL REFERENCES vendor_skus(id) ON DELETE CASCADE,
  allocated_qty     NUMERIC(18,3) NOT NULL CHECK (allocated_qty > 0),
  status            TEXT NOT NULL DEFAULT 'RESERVED' 
                    CHECK (status IN ('RESERVED', 'RELEASED', 'SHIPPED')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allocations_po_line ON po_allocations(po_line_id);
CREATE INDEX IF NOT EXISTS idx_allocations_status ON po_allocations(tenant_id, status);

-- =============================================================================
-- INVENTORY UPLOADS - Track bulk uploads
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventory_uploads (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id         BIGINT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  filename          TEXT,
  status            TEXT NOT NULL DEFAULT 'PENDING' 
                    CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED')),
  total_rows        INTEGER DEFAULT 0,
  processed_rows    INTEGER DEFAULT 0,
  error_rows        INTEGER DEFAULT 0,
  error_report      TEXT,
  uploaded_by       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inv_uploads_tenant ON inventory_uploads(tenant_id, created_at DESC);

COMMIT;

-- =============================================================================
-- SEED DEFAULT DATA
-- =============================================================================

-- Create default tenant
INSERT INTO tenants (id, tenant_code, tenant_name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'NOURISH', 'Nourish Platform')
ON CONFLICT DO NOTHING;

-- Create default vendor
INSERT INTO vendors (tenant_id, vendor_code, vendor_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'NY', 'Nourish You')
ON CONFLICT DO NOTHING;
