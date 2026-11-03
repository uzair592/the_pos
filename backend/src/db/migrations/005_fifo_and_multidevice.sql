-- Migration 005_fifo_and_multidevice.sql
-- Ensure inventory_batches has all required columns and constraints
CREATE TABLE IF NOT EXISTS inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  purchase_item_id UUID,
  quantity_received NUMERIC(12, 4) NOT NULL,
  quantity_remaining NUMERIC(12, 4) NOT NULL,
  unit_cost NUMERIC(12, 4) NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXHAUSTED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_tenant ON inventory_batches (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_branch_ing ON inventory_batches (branch_id, ingredient_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_received ON inventory_batches (received_at ASC);

-- Ensure order_item_batch_consumptions has all necessary foreign references
CREATE TABLE IF NOT EXISTS order_item_batch_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  quantity NUMERIC(12, 4) NOT NULL,
  unit_cost NUMERIC(12, 4) NOT NULL,
  total_cost NUMERIC(12, 4) NOT NULL,
  reference_type VARCHAR(50) NOT NULL DEFAULT 'ORDER',
  reference_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Safely add missing columns if order_item_batch_consumptions existed earlier
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_item_batch_consumptions' AND column_name = 'tenant_id') THEN
    ALTER TABLE order_item_batch_consumptions ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_item_batch_consumptions' AND column_name = 'branch_id') THEN
    ALTER TABLE order_item_batch_consumptions ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_item_batch_consumptions' AND column_name = 'order_id') THEN
    ALTER TABLE order_item_batch_consumptions ADD COLUMN order_id UUID REFERENCES orders(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_item_batch_consumptions' AND column_name = 'ingredient_id') THEN
    ALTER TABLE order_item_batch_consumptions ADD COLUMN ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_item_batch_consumptions' AND column_name = 'reference_type') THEN
    ALTER TABLE order_item_batch_consumptions ADD COLUMN reference_type VARCHAR(50) NOT NULL DEFAULT 'ORDER';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_item_batch_consumptions' AND column_name = 'reference_id') THEN
    ALTER TABLE order_item_batch_consumptions ADD COLUMN reference_id UUID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_oibc_tenant ON order_item_batch_consumptions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_oibc_order ON order_item_batch_consumptions (order_id);
CREATE INDEX IF NOT EXISTS idx_oibc_reference ON order_item_batch_consumptions (reference_type, reference_id);

-- Add COGS column to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cogs NUMERIC(12, 4) DEFAULT 0.0000;

-- Add token_version to users for session revocation on credential changes
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 1;

-- Backups tracking table
CREATE TABLE IF NOT EXISTS backup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  backup_type VARCHAR(50) NOT NULL DEFAULT 'TENANT',
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  checksum VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  triggered_by_user_id UUID,
  triggered_by_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backup_history_tenant ON backup_history (tenant_id);

-- Multi-Device Sync Events table
CREATE TABLE IF NOT EXISTS sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_events_lookup ON sync_events (tenant_id, created_at DESC);

-- Enable RLS for newly created tables
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_batches_tenant_policy ON inventory_batches;
CREATE POLICY inventory_batches_tenant_policy ON inventory_batches
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE order_item_batch_consumptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS oibc_tenant_policy ON order_item_batch_consumptions;
CREATE POLICY oibc_tenant_policy ON order_item_batch_consumptions
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS backup_history_tenant_policy ON backup_history;
CREATE POLICY backup_history_tenant_policy ON backup_history
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sync_events_tenant_policy ON sync_events;
CREATE POLICY sync_events_tenant_policy ON sync_events
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

