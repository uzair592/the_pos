-- Enable Row Level Security for tenant-owned tables
-- This migration adds RLS policies to enforce tenant isolation at the database level.
-- It assumes the application sets the following PostgreSQL session variables per request:
--   app.current_tenant_id (UUID) – the tenant context
--   app.is_super_admin (boolean string 'true'/'false') – super admin flag
-- Policies allow access when the row's tenant_id matches the session tenant_id or when the
-- super admin flag is true. Insert/Update operations are restricted to the current tenant.

-- Helper function to create policies for a table with tenant_id column
-- (This is executed in psql, not as a PL/pgSQL function; we repeat per table.)

-- List of tenant-owned tables (each includes a tenant_id column):
-- branches, restaurant_settings, users, registered_devices, floors, restaurant_tables,
-- categories, modifier_groups, products, product_variants, product_modifier_groups,
-- ingredients, branch_stocks, recipes, recipe_ingredients, stock_movements, suppliers,
-- purchase_invoices, purchase_items, register_shifts

-- 1. branches
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches FORCE ROW LEVEL SECURITY;
CREATE POLICY branches_tenant_isolation ON branches
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY branches_super_admin ON branches
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY branches_insert_check ON branches
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 2. restaurant_settings (has tenant_id as primary key)
ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY restaurant_settings_tenant_isolation ON restaurant_settings
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY restaurant_settings_super_admin ON restaurant_settings
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY restaurant_settings_insert_check ON restaurant_settings
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 3. users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY users_super_admin ON users
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY users_insert_check ON users
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 4. registered_devices
ALTER TABLE registered_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE registered_devices FORCE ROW LEVEL SECURITY;
CREATE POLICY registered_devices_tenant_isolation ON registered_devices
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY registered_devices_super_admin ON registered_devices
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY registered_devices_insert_check ON registered_devices
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 5. floors
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors FORCE ROW LEVEL SECURITY;
CREATE POLICY floors_tenant_isolation ON floors
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY floors_super_admin ON floors
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY floors_insert_check ON floors
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 6. restaurant_tables
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables FORCE ROW LEVEL SECURITY;
CREATE POLICY restaurant_tables_tenant_isolation ON restaurant_tables
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY restaurant_tables_super_admin ON restaurant_tables
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY restaurant_tables_insert_check ON restaurant_tables
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 7. categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
CREATE POLICY categories_tenant_isolation ON categories
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY categories_super_admin ON categories
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY categories_insert_check ON categories
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 8. modifier_groups
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY modifier_groups_tenant_isolation ON modifier_groups
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY modifier_groups_super_admin ON modifier_groups
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY modifier_groups_insert_check ON modifier_groups
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 9. products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
CREATE POLICY products_tenant_isolation ON products
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY products_super_admin ON products
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY products_insert_check ON products
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 10. product_variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants FORCE ROW LEVEL SECURITY;
CREATE POLICY product_variants_tenant_isolation ON product_variants
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY product_variants_super_admin ON product_variants
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY product_variants_insert_check ON product_variants
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 11. product_modifier_groups
ALTER TABLE product_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_modifier_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY product_modifier_groups_tenant_isolation ON product_modifier_groups
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY product_modifier_groups_super_admin ON product_modifier_groups
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY product_modifier_groups_insert_check ON product_modifier_groups
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 12. ingredients
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients FORCE ROW LEVEL SECURITY;
CREATE POLICY ingredients_tenant_isolation ON ingredients
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY ingredients_super_admin ON ingredients
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY ingredients_insert_check ON ingredients
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 13. branch_stocks
ALTER TABLE branch_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_stocks FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_stocks_tenant_isolation ON branch_stocks
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY branch_stocks_super_admin ON branch_stocks
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY branch_stocks_insert_check ON branch_stocks
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 14. recipes
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes FORCE ROW LEVEL SECURITY;
CREATE POLICY recipes_tenant_isolation ON recipes
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY recipes_super_admin ON recipes
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY recipes_insert_check ON recipes
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 15. recipe_ingredients
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients FORCE ROW LEVEL SECURITY;
CREATE POLICY recipe_ingredients_tenant_isolation ON recipe_ingredients
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY recipe_ingredients_super_admin ON recipe_ingredients
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY recipe_ingredients_insert_check ON recipe_ingredients
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 16. stock_movements
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY stock_movements_tenant_isolation ON stock_movements
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY stock_movements_super_admin ON stock_movements
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY stock_movements_insert_check ON stock_movements
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 17. suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;
CREATE POLICY suppliers_tenant_isolation ON suppliers
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY suppliers_super_admin ON suppliers
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY suppliers_insert_check ON suppliers
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 18. purchase_invoices
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY purchase_invoices_tenant_isolation ON purchase_invoices
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY purchase_invoices_super_admin ON purchase_invoices
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY purchase_invoices_insert_check ON purchase_invoices
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 19. purchase_items
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items FORCE ROW LEVEL SECURITY;
CREATE POLICY purchase_items_tenant_isolation ON purchase_items
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY purchase_items_super_admin ON purchase_items
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY purchase_items_insert_check ON purchase_items
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 20. register_shifts
ALTER TABLE register_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE register_shifts FORCE ROW LEVEL SECURITY;
CREATE POLICY register_shifts_tenant_isolation ON register_shifts
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY register_shifts_super_admin ON register_shifts
  USING (current_setting('app.is_super_admin') = 'true');
CREATE POLICY register_shifts_insert_check ON register_shifts
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Note: Global platform tables (platform_admins, subscription_plans, tenants, tenant_subscriptions,
-- subscription_payments, schema_migrations) are left untouched; they are accessed via super admin
-- privileged role which bypasses RLS where appropriate.

-- End of migration
