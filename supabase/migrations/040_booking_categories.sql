-- ============================================================
-- 040_booking_categories.sql — Dynamic Booking Categories & Rental Products
-- ============================================================

-- 1. Create booking_categories table (supports both Services like Studio and Rental Products like Cameras)
CREATE TABLE IF NOT EXISTS booking_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  category_type text NOT NULL DEFAULT 'service', -- 'service' (e.g. Studio) or 'rental' (e.g. Camera / Gear)
  advance_amount numeric(10,2) NOT NULL DEFAULT 500.00,
  keywords text[] NOT NULL DEFAULT '{}',
  description text,
  time_slots jsonb DEFAULT NULL, -- custom time slots / durations specific to this category
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_categories_account ON booking_categories(account_id);
CREATE INDEX IF NOT EXISTS idx_booking_categories_active ON booking_categories(is_active);

ALTER TABLE booking_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_categories_select ON booking_categories;
CREATE POLICY booking_categories_select ON booking_categories FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS booking_categories_insert ON booking_categories;
CREATE POLICY booking_categories_insert ON booking_categories FOR INSERT
  WITH CHECK (is_account_member(account_id));

DROP POLICY IF EXISTS booking_categories_update ON booking_categories;
CREATE POLICY booking_categories_update ON booking_categories FOR UPDATE
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS booking_categories_delete ON booking_categories;
CREATE POLICY booking_categories_delete ON booking_categories FOR DELETE
  USING (is_account_member(account_id));

-- 2. Add category reference columns to bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES booking_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_name text,
  ADD COLUMN IF NOT EXISTS category_type text;
