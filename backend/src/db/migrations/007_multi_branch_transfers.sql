-- =====================================================
-- Migration 007: Multi-Branch Transfers & Device Management
-- =====================================================

-- 1. Inter-Branch Stock Transfers Table
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transfer_number VARCHAR(100) NOT NULL,
  from_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  to_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity NUMERIC(12, 3) NOT NULL,
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, DISPATCHED, RECEIVED, CANCELLED
  notes TEXT,
  requested_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  dispatched_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  received_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  dispatched_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tenant_transfer_number UNIQUE (tenant_id, transfer_number)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_tenant ON stock_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_branch ON stock_transfers(tenant_id, from_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_branch ON stock_transfers(tenant_id, to_branch_id);

-- Enable RLS on stock_transfers
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_stock_transfers ON stock_transfers
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_super_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_super_admin', true) = 'true'
  );

GRANT ALL ON stock_transfers TO CURRENT_USER;

-- 2. Enhance registered_devices with workspace and employee tracking
ALTER TABLE registered_devices 
  ADD COLUMN IF NOT EXISTS default_workspace VARCHAR(50) DEFAULT 'POS',
  ADD COLUMN IF NOT EXISTS last_user_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_user_email VARCHAR(255);
