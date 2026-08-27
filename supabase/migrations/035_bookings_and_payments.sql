-- ============================================================
-- 035_bookings_and_payments.sql — AI Booking Engine & Cashfree Payments
-- ============================================================

CREATE TYPE booking_status_enum AS ENUM (
  'pending_details',
  'pending_payment',
  'confirmed',
  'cancelled'
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  booking_date text,
  booking_time text,
  advance_amount numeric(10,2) NOT NULL DEFAULT 1.00,
  status booking_status_enum NOT NULL DEFAULT 'pending_details',
  cashfree_order_id text UNIQUE,
  cashfree_payment_id text,
  payment_status text NOT NULL DEFAULT 'pending',
  payment_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bookings_select ON bookings;
CREATE POLICY bookings_select ON bookings FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS bookings_insert ON bookings;
CREATE POLICY bookings_insert ON bookings FOR INSERT
  WITH CHECK (is_account_member(account_id));

DROP POLICY IF EXISTS bookings_update ON bookings;
CREATE POLICY bookings_update ON bookings FOR UPDATE
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS bookings_delete ON bookings;
CREATE POLICY bookings_delete ON bookings FOR DELETE
  USING (is_account_member(account_id));

-- Add booking tracking state to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS current_booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS booking_step text;
