-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schema migrations tracker
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 1. PLATFORM LEVEL (NO TENANT ID)
-- ==========================================

-- Platform Super Administrators
CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  monthly_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  annual_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'PKR',
  trial_days INT DEFAULT 14,
  grace_period_days INT DEFAULT 3,
  entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tenants / Restaurants
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  subdomain VARCHAR(100) UNIQUE,
  owner_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Pakistan',
  currency VARCHAR(10) DEFAULT 'PKR',
  time_zone VARCHAR(100) DEFAULT 'Asia/Karachi',
  business_type VARCHAR(50) DEFAULT 'CAFE',
  logo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_onboarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tenant Subscriptions
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(50) NOT NULL DEFAULT 'TRIAL',
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  grace_period_ends_at TIMESTAMP WITH TIME ZONE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  suspension_reason TEXT,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Subscription Payments (Manual & Gateway records)
CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES tenant_subscriptions(id),
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'PKR',
  payment_method VARCHAR(50) NOT NULL,
  transaction_reference VARCHAR(255) NOT NULL,
  payment_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
  notes TEXT,
  recorded_by_admin_id UUID NOT NULL REFERENCES platform_admins(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 2. TENANT-OWNED TABLES (ROW LEVEL SECURITY)
-- ==========================================

-- Branches
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  is_main_branch BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tenant_branch_code UNIQUE (tenant_id, code)
);

-- Restaurant Settings
CREATE TABLE IF NOT EXISTS restaurant_settings (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  currency VARCHAR(10) DEFAULT 'PKR',
  currency_symbol VARCHAR(10) DEFAULT 'Rs.',
  time_zone VARCHAR(100) DEFAULT 'Asia/Karachi',
  tax_rate_percent NUMERIC(5, 2) DEFAULT 16.00,
  tax_registration_number VARCHAR(100),
  is_tax_inclusive BOOLEAN DEFAULT FALSE,
  service_charge_percent NUMERIC(5, 2) DEFAULT 0.00,
  stock_deduction_trigger VARCHAR(50) DEFAULT 'ON_ORDER_COMPLETED',
  allow_negative_inventory BOOLEAN DEFAULT FALSE,
  order_number_prefix VARCHAR(20) DEFAULT 'ORD-',
  kot_number_prefix VARCHAR(20) DEFAULT 'KOT-',
  receipt_settings JSONB NOT NULL DEFAULT '{"paperWidth": "80mm", "showLogo": true, "showTaxBreakdown": true, "showCashierName": true, "bilingualUrduEnglish": true}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users (Staff & Admins)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  custom_permissions JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tenant_user_email UNIQUE (tenant_id, email)
);

-- Registered Devices
CREATE TABLE IF NOT EXISTS registered_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  device_fingerprint VARCHAR(255) NOT NULL,
  device_name VARCHAR(255) NOT NULL,
  device_type VARCHAR(50) DEFAULT 'POS_TERMINAL',
  ip_address VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tenant_device UNIQUE (tenant_id, device_fingerprint)
);

-- Floors
CREATE TABLE IF NOT EXISTS floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

-- Tables
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  table_number VARCHAR(50) NOT NULL,
  capacity INT DEFAULT 4,
  status VARCHAR(50) DEFAULT 'AVAILABLE',
  current_order_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  CONSTRAINT uq_branch_table_number UNIQUE (branch_id, table_number)
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  name_urdu VARCHAR(255),
  description TEXT,
  sort_order INT DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Modifier Groups
CREATE TABLE IF NOT EXISTS modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  name_urdu VARCHAR(255),
  min_select INT DEFAULT 0,
  max_select INT DEFAULT 1,
  is_required BOOLEAN DEFAULT FALSE,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  name_urdu VARCHAR(255),
  description TEXT,
  sku VARCHAR(100) NOT NULL,
  barcode VARCHAR(100),
  base_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  station VARCHAR(50) NOT NULL DEFAULT 'KITCHEN',
  image_url TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  track_inventory BOOLEAN DEFAULT TRUE,
  dine_in_price NUMERIC(12, 2),
  takeaway_price NUMERIC(12, 2),
  delivery_price NUMERIC(12, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tenant_product_sku UNIQUE (tenant_id, sku)
);

-- Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  name_urdu VARCHAR(100),
  sku VARCHAR(100),
  price NUMERIC(12, 2) NOT NULL,
  cost_price NUMERIC(12, 2) DEFAULT 0.00,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE
);

-- Product Modifiers Junction
CREATE TABLE IF NOT EXISTS product_modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  CONSTRAINT uq_product_modifier_group UNIQUE (product_id, modifier_group_id)
);

-- Ingredients
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  name_urdu VARCHAR(255),
  sku VARCHAR(100) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  cost_per_unit NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
  min_stock_alert NUMERIC(12, 2) NOT NULL DEFAULT 5.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tenant_ingredient_sku UNIQUE (tenant_id, sku)
);

-- Branch Stock
CREATE TABLE IF NOT EXISTS branch_stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  current_stock NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
  cost_per_unit NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_branch_ingredient UNIQUE (branch_id, ingredient_id)
);

-- Recipes
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  yield_count NUMERIC(10, 2) DEFAULT 1.00,
  total_cost NUMERIC(12, 4) DEFAULT 0.0000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Recipe Ingredients
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity NUMERIC(12, 4) NOT NULL,
  unit VARCHAR(50) NOT NULL
);

-- Stock Movements (Audit Ledger)
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL,
  quantity NUMERIC(12, 4) NOT NULL,
  stock_before NUMERIC(12, 4) NOT NULL,
  stock_after NUMERIC(12, 4) NOT NULL,
  unit_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
  total_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
  reference_type VARCHAR(50),
  reference_id UUID,
  reason TEXT,
  recorded_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  tax_number VARCHAR(100),
  balance_payable NUMERIC(12, 2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Invoices
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'DRAFT',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  balance_payable NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  received_at TIMESTAMP WITH TIME ZONE,
  recorded_by_user_id UUID NOT NULL REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tenant_purchase_invoice UNIQUE (tenant_id, supplier_id, invoice_number)
);

-- Purchase Items
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  unit VARCHAR(50) NOT NULL,
  quantity NUMERIC(12, 4) NOT NULL,
  unit_price NUMERIC(12, 4) NOT NULL,
  total_price NUMERIC(12, 2) NOT NULL
);

-- Register Shifts
CREATE TABLE IF NOT EXISTS register_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  register_name VARCHAR(100) DEFAULT 'Main Register',
  cashier_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'OPEN',
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP WITH TIME ZONE,
  opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_cash_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_cash_refunds NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_cash_in NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_cash_out NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  expected_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  actual_cash NUMERIC(12, 2),
  cash_variance NUMERIC(12, 2),
  closing_notes TEXT
);

-- Cash Movements
CREATE TABLE IF NOT EXISTS cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES register_shifts(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  reason TEXT NOT NULL,
  recorded_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  credit_limit NUMERIC(12, 2) DEFAULT 0.00,
  outstanding_balance NUMERIC(12, 2) DEFAULT 0.00,
  loyalty_points INT DEFAULT 0,
  total_orders INT DEFAULT 0,
  total_spent NUMERIC(12, 2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tenant_customer_phone UNIQUE (tenant_id, phone)
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  order_number VARCHAR(100) NOT NULL,
  order_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  payment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  table_number VARCHAR(50),
  floor_name VARCHAR(100),
  cover_count INT DEFAULT 1,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  delivery_address TEXT,
  delivery_fee NUMERIC(12, 2) DEFAULT 0.00,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  item_discounts_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  bill_discount_percent NUMERIC(5, 2) DEFAULT 0.00,
  bill_discount_amount NUMERIC(12, 2) DEFAULT 0.00,
  total_discount NUMERIC(12, 2) DEFAULT 0.00,
  tax_percent NUMERIC(5, 2) DEFAULT 0.00,
  tax_amount NUMERIC(12, 2) DEFAULT 0.00,
  service_charge_percent NUMERIC(5, 2) DEFAULT 0.00,
  service_charge_amount NUMERIC(12, 2) DEFAULT 0.00,
  grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  change_given NUMERIC(12, 2) DEFAULT 0.00,
  balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  cashier_id UUID NOT NULL REFERENCES users(id),
  cashier_name VARCHAR(255),
  waiter_id UUID REFERENCES users(id),
  waiter_name VARCHAR(255),
  shift_id UUID REFERENCES register_shifts(id),
  order_notes TEXT,
  cancel_reason TEXT,
  cancelled_by_user_id UUID REFERENCES users(id),
  idempotency_key VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT uq_tenant_order_number UNIQUE (tenant_id, order_number)
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name VARCHAR(255) NOT NULL,
  variant_id UUID REFERENCES product_variants(id),
  variant_name VARCHAR(100),
  station VARCHAR(50) NOT NULL DEFAULT 'KITCHEN',
  quantity INT NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL,
  cost_price NUMERIC(12, 2) DEFAULT 0.00,
  modifiers JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  item_discount NUMERIC(12, 2) DEFAULT 0.00,
  tax_amount NUMERIC(12, 2) DEFAULT 0.00,
  total_price NUMERIC(12, 2) NOT NULL
);

-- Order Payments
CREATE TABLE IF NOT EXISTS order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  method VARCHAR(50) NOT NULL,
  reference VARCHAR(255),
  change_amount NUMERIC(12, 2) DEFAULT 0.00,
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  recorded_by_user_id UUID NOT NULL REFERENCES users(id)
);

-- Order Refunds
CREATE TABLE IF NOT EXISTS order_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  order_number VARCHAR(100) NOT NULL,
  refund_number VARCHAR(100) NOT NULL,
  total_refund_amount NUMERIC(12, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  reason TEXT NOT NULL,
  authorized_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tenant_refund_number UNIQUE (tenant_id, refund_number)
);

-- Refund Items
CREATE TABLE IF NOT EXISTS refund_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  refund_id UUID NOT NULL REFERENCES order_refunds(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL,
  refund_amount NUMERIC(12, 2) NOT NULL,
  restock_stock BOOLEAN DEFAULT TRUE
);

-- Kitchen Order Tickets (KOT)
CREATE TABLE IF NOT EXISTS kitchen_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  kot_number VARCHAR(100) NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_number VARCHAR(100) NOT NULL,
  order_type VARCHAR(50) NOT NULL,
  table_number VARCHAR(50),
  server_name VARCHAR(255),
  station VARCHAR(50) NOT NULL DEFAULT 'KITCHEN',
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP WITH TIME ZONE,
  preparing_at TIMESTAMP WITH TIME ZONE,
  ready_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT uq_tenant_kot_number UNIQUE (tenant_id, kot_number)
);

-- Kitchen Ticket Items
CREATE TABLE IF NOT EXISTS kitchen_ticket_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kot_id UUID NOT NULL REFERENCES kitchen_tickets(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name VARCHAR(255) NOT NULL,
  variant_name VARCHAR(100),
  quantity INT NOT NULL,
  modifiers_summary TEXT,
  notes TEXT,
  station VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
);

-- Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  receipt_url TEXT,
  recorded_by_user_id UUID NOT NULL REFERENCES users(id),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  actor_id UUID NOT NULL,
  actor_role VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- In-App Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 3. ROW LEVEL SECURITY (RLS) FOR ALL TENANT-OWNED TABLES
-- ==========================================================

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
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I FOR ALL USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid OR current_setting(''app.is_super_admin'', true) = ''true'') WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid OR current_setting(''app.is_super_admin'', true) = ''true'');', tbl);
  END LOOP;
END $$;

-- Indexes for performance & tenant scoping
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id, category_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_tenant ON ingredients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branch_stocks_tenant ON branch_stocks(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id, branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_tenant ON kitchen_tickets(tenant_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant ON register_shifts(tenant_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id, branch_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON stock_movements(tenant_id, branch_id, ingredient_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, created_at);
