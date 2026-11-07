-- Migration 018: Restructure FIFO purchases and inventory batches
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES purchase_invoices(id) ON DELETE SET NULL;
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS unit VARCHAR(50);
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255);
ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS batch_code VARCHAR(100);

-- Populate unit in inventory_batches from ingredients where null
UPDATE inventory_batches ib
SET unit = COALESCE(i.base_unit, i.unit, 'UNIT')
FROM ingredients i
WHERE ib.ingredient_id = i.id AND ib.unit IS NULL;

-- Populate purchase_id in inventory_batches from purchase_items
UPDATE inventory_batches ib
SET purchase_id = pi.purchase_id
FROM purchase_items pi
WHERE ib.purchase_item_id = pi.id AND ib.purchase_id IS NULL;

-- Populate supplier_name in inventory_batches from purchase_invoices and suppliers
UPDATE inventory_batches ib
SET supplier_name = s.name
FROM purchase_invoices pinv
JOIN suppliers s ON s.id = pinv.supplier_id
WHERE ib.purchase_id = pinv.id AND ib.supplier_name IS NULL;

-- Make invoice_number generation safe and indexes clean
CREATE INDEX IF NOT EXISTS idx_inventory_batches_purchase ON inventory_batches (purchase_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_active ON inventory_batches (branch_id, ingredient_id, status, quantity_remaining);

