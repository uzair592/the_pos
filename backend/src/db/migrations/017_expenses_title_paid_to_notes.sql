-- Add title, paid_to, and notes to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_to VARCHAR(255);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT;

-- Seed title from description for any existing records
UPDATE expenses SET title = description WHERE title IS NULL AND description IS NOT NULL;

