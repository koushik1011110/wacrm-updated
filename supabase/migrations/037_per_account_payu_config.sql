-- Add per-account PayU Payment Gateway credentials columns to accounts table
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS payu_merchant_key text,
  ADD COLUMN IF NOT EXISTS payu_merchant_salt text,
  ADD COLUMN IF NOT EXISTS payu_env text DEFAULT 'TEST';
