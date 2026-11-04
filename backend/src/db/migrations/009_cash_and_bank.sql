-- =====================================================
-- Migration 009: Cash & Bank Accounts and Fund Transfers
-- =====================================================

-- 1. Bank Accounts Table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(100),
  iban VARCHAR(100),
  branch_code VARCHAR(50),
  opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant ON bank_accounts(tenant_id);

-- Enable RLS on bank_accounts
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_bank_accounts ON bank_accounts
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_super_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_super_admin', true) = 'true'
  );

GRANT ALL ON bank_accounts TO CURRENT_USER;

-- 2. Cash and Bank Fund Transfers Table
CREATE TABLE IF NOT EXISTS cash_bank_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transfer_type VARCHAR(50) NOT NULL, -- CASH_TO_BANK, BANK_TO_CASH, BANK_TO_BANK
  from_bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  to_bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  amount NUMERIC(14, 2) NOT NULL,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number VARCHAR(255),
  notes TEXT,
  recorded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cash_bank_transfers_tenant ON cash_bank_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_bank_transfers_date ON cash_bank_transfers(tenant_id, transfer_date);

-- Enable RLS on cash_bank_transfers
ALTER TABLE cash_bank_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cash_bank_transfers ON cash_bank_transfers
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_super_admin', true) = 'true'
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.is_super_admin', true) = 'true'
  );

GRANT ALL ON cash_bank_transfers TO CURRENT_USER;

-- 3. Add bank_account_id to order_payments
ALTER TABLE order_payments ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_order_payments_bank ON order_payments(tenant_id, bank_account_id);

-- 4. Add bank_account_id to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_bank ON expenses(tenant_id, bank_account_id);
