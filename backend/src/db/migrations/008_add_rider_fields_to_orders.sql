-- Migration: 008_add_rider_fields_to_orders.sql
-- Description: Add rider name and rider phone to orders table for delivery tracking

ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_phone VARCHAR(50);
