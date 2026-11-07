-- ============================================================================
-- Migration 014: Add timestamps to restaurant_tables
-- ============================================================================

ALTER TABLE restaurant_tables
  ADD COLUMN IF NOT EXISTS shape VARCHAR(20) DEFAULT 'RECTANGLE',
  ADD COLUMN IF NOT EXISTS pos_x INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pos_y INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_waiter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_waiter_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

