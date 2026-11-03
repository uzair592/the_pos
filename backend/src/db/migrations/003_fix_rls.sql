-- 003_fix_rls.sql
-- Corrective migration to enforce strict tenant isolation.
-- Removes any super‑admin bypass, adds explicit tenant‑only policies,
-- ensures FORCE ROW LEVEL SECURITY, and provides FAIL‑CLOSED behavior.
-- This migration is safe to apply on existing databases; it only
-- replaces the previously created policies.

DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'branches',
    'restaurant_settings',
    'users',
    'registered_devices',
    'floors',
    'restaurant_tables',
    'categories',
    'modifier_groups',
    'products',
    'product_variants',
    'product_modifier_groups',
    'ingredients',
    'branch_stocks',
    'recipes',
    'recipe_ingredients',
    'stock_movements',
    'suppliers',
    'purchase_invoices',
    'purchase_items',
    'register_shifts',
    'cash_movements',
    'customers',
    'orders',
    'order_items',
    'order_payments',
    'order_refunds',
    'refund_items',
    'kitchen_tickets',
    'kitchen_ticket_items',
    'expense_categories',
    'expenses',
    'audit_logs',
    'notifications'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    -- Enable RLS and force it
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);

    -- Drop any existing tenant policy (including the one created in migration 002)
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);

    -- Build policy expression. For tables where tenant_id can be NULL (audit_logs, notifications),
    -- we allow rows with NULL tenant_id as platform‑wide records.
    IF tbl IN ('audit_logs', 'notifications') THEN
      EXECUTE format(
        $fmt$
        CREATE POLICY tenant_isolation_policy ON %I
          FOR ALL
          USING (
            tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
          )
          WITH CHECK (
            tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
          );
        $fmt$, tbl);
    ELSE
      EXECUTE format(
        $fmt$
        CREATE POLICY tenant_isolation_policy ON %I
          FOR ALL
          USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
          WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
        $fmt$, tbl);
    END IF;
  END LOOP;
END $$;

-- Indexes are already present from migration 001; we do not modify them here.

-- End of migration 003_fix_rls.sql
