-- Migration 021: Add timestamps to floors and ensure soft-deleted tables do not conflict with unique table_number constraint

ALTER TABLE floors ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE floors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- If any inactive tables exist with unmodified table_number, append _deleted_<id> so the number is freed
UPDATE restaurant_tables
SET table_number = table_number || '_deleted_' || SUBSTRING(id::text, 1, 8)
WHERE is_active = false AND table_number NOT LIKE '%_deleted_%';
