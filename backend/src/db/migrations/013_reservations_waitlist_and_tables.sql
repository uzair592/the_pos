-- ============================================================================
-- Migration 013: Reservations, Waitlist, and Floor & Table Management Enhancements
-- ============================================================================

-- 1. Table shape, coordinates, and waiter assignment in restaurant_tables
ALTER TABLE restaurant_tables
  ADD COLUMN IF NOT EXISTS shape VARCHAR(20) DEFAULT 'RECTANGLE',
  ADD COLUMN IF NOT EXISTS pos_x INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pos_y INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_waiter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_waiter_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- 2. Reservations Table
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  customer_email VARCHAR(150),
  guest_count INT NOT NULL DEFAULT 2,
  table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  reservation_date DATE NOT NULL,
  reservation_time VARCHAR(20) NOT NULL,
  duration_minutes INT DEFAULT 90,
  status VARCHAR(50) NOT NULL DEFAULT 'CONFIRMED',
  special_requests TEXT,
  converted_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reservations_tenant_branch ON reservations(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date_time ON reservations(tenant_id, branch_id, reservation_date, reservation_time);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_table ON reservations(table_id);

-- 3. Waitlist Table
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  guest_count INT NOT NULL DEFAULT 2,
  queue_number INT NOT NULL,
  estimated_wait_minutes INT DEFAULT 15,
  status VARCHAR(50) NOT NULL DEFAULT 'WAITING',
  assigned_table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  notified_at TIMESTAMPTZ,
  seated_at TIMESTAMPTZ,
  notes TEXT,
  converted_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_waitlist_tenant_branch ON waitlist(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(tenant_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_queue ON waitlist(tenant_id, branch_id, queue_number);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reservations_tenant_isolation ON reservations;
CREATE POLICY reservations_tenant_isolation ON reservations
  FOR ALL
  TO public
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS waitlist_tenant_isolation ON waitlist;
CREATE POLICY waitlist_tenant_isolation ON waitlist
  FOR ALL
  TO public
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
