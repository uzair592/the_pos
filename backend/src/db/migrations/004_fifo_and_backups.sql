-- Migration 004_fifo_and_backups.sql
-- Base table definitions
CREATE TABLE IF NOT EXISTS inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  ingredient_id UUID NOT NULL,
  purchase_item_id UUID,
  quantity_received NUMERIC NOT NULL,
  quantity_remaining NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'EXHAUSTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_tenant ON inventory_batches (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_ingredient ON inventory_batches (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_status ON inventory_batches (status);

CREATE TABLE IF NOT EXISTS order_item_batch_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL,
  batch_id UUID NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oibc_order_item ON order_item_batch_consumptions (order_item_id);
CREATE INDEX IF NOT EXISTS idx_oibc_batch ON order_item_batch_consumptions (batch_id);

CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  file_path TEXT NOT NULL,
  checksum TEXT NOT NULL,
  version TEXT NOT NULL
);
