-- ============================================================================
-- 010_OUTBOX.SQL - Outbox Pattern for Event Sourcing & Analytics
-- ============================================================================
-- Captures all entity changes for:
-- 1. Event-driven architecture (publish to message queues)
-- 2. Analytics and reporting
-- 3. AI/ML analysis of business patterns
-- 4. Audit trail and compliance
-- ============================================================================

-- ============================================================================
-- OUTBOX TABLE (Event Store)
-- ============================================================================

CREATE TABLE IF NOT EXISTS outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Event identification
    event_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,  -- e.g., 'product.created', 'bundle.updated'
    
    -- Aggregate/Entity info
    aggregate_type VARCHAR(50) NOT NULL,  -- e.g., 'product', 'bundle', 'production_order'
    aggregate_id UUID NOT NULL,           -- The entity ID
    tenant_id UUID NOT NULL,
    
    -- Event data (full payload for AI analysis)
    payload JSONB NOT NULL,              -- The entity data at time of event
    old_payload JSONB,                   -- Previous state (for updates)
    changes JSONB,                       -- What changed (for updates)
    
    -- Metadata
    operation VARCHAR(10) NOT NULL,      -- INSERT, UPDATE, DELETE
    version INT NOT NULL DEFAULT 1,      -- For optimistic locking
    
    -- Context (who/what triggered the event)
    user_id UUID,
    user_name VARCHAR(100),
    source VARCHAR(50) DEFAULT 'api',    -- api, import, system, trigger
    correlation_id UUID,                 -- For tracing related events
    
    -- Processing status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, processing, processed, failed
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- For ordering events
    sequence_number BIGSERIAL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate ON outbox(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_outbox_tenant ON outbox(tenant_id);
CREATE INDEX IF NOT EXISTS idx_outbox_event_type ON outbox(event_type);
CREATE INDEX IF NOT EXISTS idx_outbox_created ON outbox(created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_sequence ON outbox(sequence_number);

-- Full-text search on payload for AI analysis
CREATE INDEX IF NOT EXISTS idx_outbox_payload_gin ON outbox USING gin(payload jsonb_path_ops);


-- ============================================================================
-- OUTBOX ARCHIVE (for processed events - analytics/AI)
-- ============================================================================

CREATE TABLE IF NOT EXISTS outbox_archive (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    payload JSONB NOT NULL,
    old_payload JSONB,
    changes JSONB,
    operation VARCHAR(10) NOT NULL,
    version INT NOT NULL,
    user_id UUID,
    user_name VARCHAR(100),
    source VARCHAR(50),
    correlation_id UUID,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    sequence_number BIGINT,
    
    -- Analytics metadata
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partitioning by month for better performance
-- Note: In production, consider using table partitioning
CREATE INDEX IF NOT EXISTS idx_outbox_archive_created ON outbox_archive(created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_archive_type ON outbox_archive(aggregate_type, event_type);
CREATE INDEX IF NOT EXISTS idx_outbox_archive_tenant ON outbox_archive(tenant_id, created_at);


-- ============================================================================
-- HELPER FUNCTION: Create outbox event
-- ============================================================================

CREATE OR REPLACE FUNCTION create_outbox_event(
    p_tenant_id UUID,
    p_aggregate_type VARCHAR(50),
    p_aggregate_id UUID,
    p_operation VARCHAR(10),
    p_payload JSONB,
    p_old_payload JSONB DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_user_name VARCHAR(100) DEFAULT NULL,
    p_source VARCHAR(50) DEFAULT 'api',
    p_correlation_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
    v_event_type VARCHAR(100);
    v_changes JSONB;
BEGIN
    v_event_id := uuid_generate_v4();
    v_event_type := p_aggregate_type || '.' || LOWER(p_operation);
    
    -- Calculate changes for updates
    IF p_operation = 'UPDATE' AND p_old_payload IS NOT NULL THEN
        SELECT jsonb_object_agg(key, value)
        INTO v_changes
        FROM jsonb_each(p_payload) AS new_data(key, value)
        WHERE NOT EXISTS (
            SELECT 1 FROM jsonb_each(p_old_payload) AS old_data
            WHERE old_data.key = new_data.key AND old_data.value = new_data.value
        );
    END IF;
    
    INSERT INTO outbox (
        event_id, event_type, aggregate_type, aggregate_id, tenant_id,
        payload, old_payload, changes, operation,
        user_id, user_name, source, correlation_id
    ) VALUES (
        v_event_id, v_event_type, p_aggregate_type, p_aggregate_id, p_tenant_id,
        p_payload, p_old_payload, v_changes, p_operation,
        p_user_id, p_user_name, p_source, p_correlation_id
    );
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- TRIGGER FUNCTION: Automatic outbox for products
-- ============================================================================

CREATE OR REPLACE FUNCTION products_outbox_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_payload JSONB;
    v_old_payload JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_payload := to_jsonb(NEW);
        PERFORM create_outbox_event(
            NEW.tenant_id, 'product', NEW.id, 'INSERT', v_payload,
            NULL, NULL, NULL, 'trigger', NULL
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        v_payload := to_jsonb(NEW);
        v_old_payload := to_jsonb(OLD);
        PERFORM create_outbox_event(
            NEW.tenant_id, 'product', NEW.id, 'UPDATE', v_payload,
            v_old_payload, NULL, NULL, 'trigger', NULL
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_old_payload := to_jsonb(OLD);
        PERFORM create_outbox_event(
            OLD.tenant_id, 'product', OLD.id, 'DELETE', v_old_payload,
            NULL, NULL, NULL, 'trigger', NULL
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for products
DROP TRIGGER IF EXISTS trg_products_outbox ON products;
CREATE TRIGGER trg_products_outbox
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW
    EXECUTE FUNCTION products_outbox_trigger();


-- ============================================================================
-- TRIGGER FUNCTION: Automatic outbox for product_bundles
-- ============================================================================

CREATE OR REPLACE FUNCTION bundles_outbox_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_payload JSONB;
    v_old_payload JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_payload := to_jsonb(NEW);
        PERFORM create_outbox_event(
            NEW.tenant_id, 'bundle', NEW.id, 'INSERT', v_payload,
            NULL, NULL, NULL, 'trigger', NULL
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        v_payload := to_jsonb(NEW);
        v_old_payload := to_jsonb(OLD);
        PERFORM create_outbox_event(
            NEW.tenant_id, 'bundle', NEW.id, 'UPDATE', v_payload,
            v_old_payload, NULL, NULL, 'trigger', NULL
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_old_payload := to_jsonb(OLD);
        PERFORM create_outbox_event(
            OLD.tenant_id, 'bundle', OLD.id, 'DELETE', v_old_payload,
            NULL, NULL, NULL, 'trigger', NULL
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bundles_outbox ON product_bundles;
CREATE TRIGGER trg_bundles_outbox
    AFTER INSERT OR UPDATE OR DELETE ON product_bundles
    FOR EACH ROW
    EXECUTE FUNCTION bundles_outbox_trigger();


-- ============================================================================
-- TRIGGER FUNCTION: Automatic outbox for production_orders
-- ============================================================================

CREATE OR REPLACE FUNCTION production_orders_outbox_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_payload JSONB;
    v_old_payload JSONB;
    v_event_type VARCHAR(100);
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_payload := to_jsonb(NEW);
        PERFORM create_outbox_event(
            NEW.tenant_id, 'production_order', NEW.id, 'INSERT', v_payload,
            NULL, NULL, NULL, 'trigger', NULL
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        v_payload := to_jsonb(NEW);
        v_old_payload := to_jsonb(OLD);
        
        -- Special event types for status changes
        IF OLD.status != NEW.status THEN
            v_event_type := 'production_order.status_changed';
            INSERT INTO outbox (
                event_id, event_type, aggregate_type, aggregate_id, tenant_id,
                payload, old_payload, changes, operation, source
            ) VALUES (
                uuid_generate_v4(), v_event_type, 'production_order', NEW.id, NEW.tenant_id,
                v_payload, v_old_payload,
                jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
                'UPDATE', 'trigger'
            );
        ELSE
            PERFORM create_outbox_event(
                NEW.tenant_id, 'production_order', NEW.id, 'UPDATE', v_payload,
                v_old_payload, NULL, NULL, 'trigger', NULL
            );
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_old_payload := to_jsonb(OLD);
        PERFORM create_outbox_event(
            OLD.tenant_id, 'production_order', OLD.id, 'DELETE', v_old_payload,
            NULL, NULL, NULL, 'trigger', NULL
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_production_orders_outbox ON production_orders;
CREATE TRIGGER trg_production_orders_outbox
    AFTER INSERT OR UPDATE OR DELETE ON production_orders
    FOR EACH ROW
    EXECUTE FUNCTION production_orders_outbox_trigger();


-- ============================================================================
-- TRIGGER FUNCTION: Automatic outbox for parties
-- ============================================================================

CREATE OR REPLACE FUNCTION parties_outbox_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_payload JSONB;
    v_old_payload JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_payload := to_jsonb(NEW);
        PERFORM create_outbox_event(
            NEW.tenant_id, 'party', NEW.id, 'INSERT', v_payload,
            NULL, NULL, NULL, 'trigger', NULL
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        v_payload := to_jsonb(NEW);
        v_old_payload := to_jsonb(OLD);
        PERFORM create_outbox_event(
            NEW.tenant_id, 'party', NEW.id, 'UPDATE', v_payload,
            v_old_payload, NULL, NULL, 'trigger', NULL
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_old_payload := to_jsonb(OLD);
        PERFORM create_outbox_event(
            OLD.tenant_id, 'party', OLD.id, 'DELETE', v_old_payload,
            NULL, NULL, NULL, 'trigger', NULL
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_parties_outbox ON parties;
CREATE TRIGGER trg_parties_outbox
    AFTER INSERT OR UPDATE OR DELETE ON parties
    FOR EACH ROW
    EXECUTE FUNCTION parties_outbox_trigger();


-- ============================================================================
-- TRIGGER FUNCTION: Automatic outbox for categories
-- ============================================================================

CREATE OR REPLACE FUNCTION categories_outbox_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_payload JSONB;
    v_old_payload JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_payload := to_jsonb(NEW);
        PERFORM create_outbox_event(
            NEW.tenant_id, 'category', NEW.id, 'INSERT', v_payload,
            NULL, NULL, NULL, 'trigger', NULL
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        v_payload := to_jsonb(NEW);
        v_old_payload := to_jsonb(OLD);
        PERFORM create_outbox_event(
            NEW.tenant_id, 'category', NEW.id, 'UPDATE', v_payload,
            v_old_payload, NULL, NULL, 'trigger', NULL
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_old_payload := to_jsonb(OLD);
        PERFORM create_outbox_event(
            OLD.tenant_id, 'category', OLD.id, 'DELETE', v_old_payload,
            NULL, NULL, NULL, 'trigger', NULL
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_categories_outbox ON categories;
CREATE TRIGGER trg_categories_outbox
    AFTER INSERT OR UPDATE OR DELETE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION categories_outbox_trigger();


-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- Recent events view
CREATE OR REPLACE VIEW recent_events AS
    SELECT 
        id, event_type, aggregate_type, aggregate_id,
        operation, payload, changes,
        user_name, source, created_at
    FROM outbox
    ORDER BY created_at DESC
    LIMIT 100;

-- Event summary by type (for dashboards)
CREATE OR REPLACE VIEW event_summary AS
    SELECT 
        tenant_id,
        aggregate_type,
        event_type,
        operation,
        COUNT(*) as event_count,
        DATE_TRUNC('hour', created_at) as hour
    FROM outbox
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY tenant_id, aggregate_type, event_type, operation, DATE_TRUNC('hour', created_at)
    ORDER BY hour DESC;

-- Pending events for processing
CREATE OR REPLACE VIEW pending_events AS
    SELECT * FROM outbox
    WHERE status = 'pending'
    ORDER BY sequence_number;


-- ============================================================================
-- FUNCTION: Archive processed events
-- ============================================================================

CREATE OR REPLACE FUNCTION archive_processed_events(p_days_old INT DEFAULT 7)
RETURNS INT AS $$
DECLARE
    v_archived INT;
BEGIN
    WITH moved AS (
        DELETE FROM outbox
        WHERE status = 'processed'
        AND created_at < NOW() - (p_days_old || ' days')::INTERVAL
        RETURNING *
    )
    INSERT INTO outbox_archive (
        id, event_id, event_type, aggregate_type, aggregate_id, tenant_id,
        payload, old_payload, changes, operation, version,
        user_id, user_name, source, correlation_id,
        processed_at, created_at, sequence_number
    )
    SELECT 
        id, event_id, event_type, aggregate_type, aggregate_id, tenant_id,
        payload, old_payload, changes, operation, version,
        user_id, user_name, source, correlation_id,
        processed_at, created_at, sequence_number
    FROM moved;
    
    GET DIAGNOSTICS v_archived = ROW_COUNT;
    RETURN v_archived;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Mark events as processed
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_events_processed(p_event_ids UUID[])
RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE outbox
    SET status = 'processed', processed_at = NOW()
    WHERE event_id = ANY(p_event_ids)
    AND status = 'pending';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- END OF OUTBOX SCHEMA
-- ============================================================================

