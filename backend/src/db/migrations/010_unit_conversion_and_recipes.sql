-- Migration 010_unit_conversion_and_recipes.sql
-- Automatic Unit Conversion & Recipe-Based Inventory Management

-- 1. Enhance ingredients table with category, base_unit, purchase_unit, conversion_factor, and purchase_cost
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'General';
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS base_unit VARCHAR(50);
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS purchase_unit VARCHAR(50);
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS conversion_factor NUMERIC(14, 4) DEFAULT 1.0000;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC(12, 4) DEFAULT 0.0000;

-- Populate base_unit, purchase_unit, and purchase_cost for existing records
UPDATE ingredients
SET base_unit = COALESCE(base_unit, unit, 'G'),
    purchase_unit = COALESCE(purchase_unit, unit, 'KG'),
    conversion_factor = COALESCE(conversion_factor, 1.0000),
    purchase_cost = CASE
      WHEN purchase_cost IS NOT NULL AND purchase_cost > 0 THEN purchase_cost
      WHEN conversion_factor > 1 THEN cost_per_unit * conversion_factor
      ELSE cost_per_unit
    END
WHERE base_unit IS NULL OR purchase_unit IS NULL;

-- Ensure default non-null constraint on base_unit and purchase_unit
ALTER TABLE ingredients ALTER COLUMN base_unit SET DEFAULT 'G';
ALTER TABLE ingredients ALTER COLUMN purchase_unit SET DEFAULT 'KG';
ALTER TABLE ingredients ALTER COLUMN conversion_factor SET DEFAULT 1.0000;

-- 2. Enhance recipe_ingredients with entered_quantity and recipe_unit
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS entered_quantity NUMERIC(12, 4);
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS recipe_unit VARCHAR(50);
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 4) DEFAULT 0.0000;
ALTER TABLE recipe_ingredients ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12, 4) DEFAULT 0.0000;

-- Backfill entered_quantity and recipe_unit from quantity and unit if null
UPDATE recipe_ingredients
SET entered_quantity = COALESCE(entered_quantity, quantity),
    recipe_unit = COALESCE(recipe_unit, unit)
WHERE entered_quantity IS NULL OR recipe_unit IS NULL;

-- 3. Enhance purchase_items with purchase_unit, conversion_factor, base_quantity, and base_unit_cost
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS purchase_unit VARCHAR(50);
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS conversion_factor NUMERIC(14, 4) DEFAULT 1.0000;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS base_quantity NUMERIC(12, 4);
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS base_unit_cost NUMERIC(14, 4);

UPDATE purchase_items
SET purchase_unit = COALESCE(purchase_unit, unit),
    conversion_factor = COALESCE(conversion_factor, 1.0000),
    base_quantity = COALESCE(base_quantity, quantity),
    base_unit_cost = COALESCE(base_unit_cost, unit_price)
WHERE purchase_unit IS NULL OR base_quantity IS NULL;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients (tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_ingredients_base_unit ON ingredients (base_unit);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients (recipe_id);
