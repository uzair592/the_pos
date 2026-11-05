-- Migration 011_recipe_costing_and_profitability.sql
-- Recipe Costing, Food Cost Analysis, and Menu Item Profitability Module

-- 1. Add packaging and additional direct cost columns to products and product_variants
ALTER TABLE products ADD COLUMN IF NOT EXISTS packaging_cost NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE products ADD COLUMN IF NOT EXISTS additional_cost NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE products ADD COLUMN IF NOT EXISTS target_food_cost_percentage NUMERIC(5, 2) DEFAULT 30.00;

ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS packaging_cost NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS additional_cost NUMERIC(12, 2) DEFAULT 0.00;

-- 2. Add packaging and additional cost columns to recipes
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS packaging_cost NUMERIC(12, 4) DEFAULT 0.0000;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS additional_cost NUMERIC(12, 4) DEFAULT 0.0000;

-- 3. Create ingredient_cost_history table for auditing price changes and cost trends
CREATE TABLE IF NOT EXISTS ingredient_cost_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  previous_purchase_cost NUMERIC(12, 4) DEFAULT 0.0000,
  new_purchase_cost NUMERIC(12, 4) NOT NULL,
  previous_cost_per_unit NUMERIC(14, 4) DEFAULT 0.0000,
  new_cost_per_unit NUMERIC(14, 4) NOT NULL,
  source_type VARCHAR(50) NOT NULL DEFAULT 'PURCHASE_INVOICE', -- 'PURCHASE_INVOICE', 'MANUAL_UPDATE', 'STOCK_ADJUSTMENT', 'INITIAL_SETUP'
  source_id UUID,
  supplier_name VARCHAR(255),
  recorded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ingredient_cost_history_ing ON ingredient_cost_history (tenant_id, ingredient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingredient_cost_history_branch ON ingredient_cost_history (branch_id);

-- Seed initial cost history baseline from existing active ingredients
INSERT INTO ingredient_cost_history (
  tenant_id, ingredient_id, previous_purchase_cost, new_purchase_cost,
  previous_cost_per_unit, new_cost_per_unit, source_type, notes, created_at
)
SELECT
  tenant_id,
  id,
  COALESCE(purchase_cost, cost_per_unit, 0),
  COALESCE(purchase_cost, cost_per_unit, 0),
  COALESCE(cost_per_unit, 0),
  COALESCE(cost_per_unit, 0),
  'INITIAL_SETUP',
  'Baseline inventory cost recorded upon module initialization',
  created_at
FROM ingredients
WHERE is_active = true
ON CONFLICT DO NOTHING;
