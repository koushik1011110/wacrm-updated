-- Migration to add Meta Embedded Signup details and onboarding logging.
-- Idempotent, safe to run multiple times.

-- Add new fields to whatsapp_config
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS meta_business_id TEXT,
  ADD COLUMN IF NOT EXISTS display_phone_number TEXT,
  ADD COLUMN IF NOT EXISTS verified_name TEXT,
  ADD COLUMN IF NOT EXISTS token_type TEXT,
  ADD COLUMN IF NOT EXISTS token_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS graph_api_version TEXT,
  ADD COLUMN IF NOT EXISTS connection_method TEXT CHECK (connection_method IN ('embedded', 'manual')) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS phone_number_status TEXT,
  ADD COLUMN IF NOT EXISTS quality_rating TEXT,
  ADD COLUMN IF NOT EXISTS webhook_subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS last_verification_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_meta_api_error TEXT,
  ADD COLUMN IF NOT EXISTS reconnection_required BOOLEAN DEFAULT FALSE;

-- Create indices for performance on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_connection_method ON whatsapp_config(connection_method);
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_status ON whatsapp_config(status);

-- Create onboarding logs table
CREATE TABLE IF NOT EXISTS whatsapp_onboarding_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'info')),
  meta_error_code INTEGER,
  error_message TEXT,
  waba_id TEXT,
  phone_number_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on onboarding logs
ALTER TABLE whatsapp_onboarding_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS whatsapp_onboarding_logs_select ON whatsapp_onboarding_logs;
DROP POLICY IF EXISTS whatsapp_onboarding_logs_insert ON whatsapp_onboarding_logs;

-- Policies mirroring whatsapp_config
CREATE POLICY whatsapp_onboarding_logs_select ON whatsapp_onboarding_logs
  FOR SELECT USING (is_account_member(account_id));

CREATE POLICY whatsapp_onboarding_logs_insert ON whatsapp_onboarding_logs
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
