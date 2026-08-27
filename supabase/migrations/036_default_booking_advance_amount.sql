-- Add default_booking_advance_amount to accounts table
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS default_booking_advance_amount numeric(10,2) NOT NULL DEFAULT 500.00;
