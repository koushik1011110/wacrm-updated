-- ============================================================
-- 034_ai_token_billing.sql — AI Token Usage & Wallet Balance Monitoring
-- ============================================================

-- 1. Account Wallet Balance (in INR ₹)
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS wallet_balance_inr numeric(12,2) NOT NULL DEFAULT 100.00;

-- 2. Superadmin Global Token Rate Configuration
CREATE TABLE IF NOT EXISTS superadmin_billing_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_rate_per_1k_inr numeric(10,4) NOT NULL DEFAULT 0.1500,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE superadmin_billing_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS superadmin_billing_select ON superadmin_billing_configs;
CREATE POLICY superadmin_billing_select ON superadmin_billing_configs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS superadmin_billing_all ON superadmin_billing_configs;
CREATE POLICY superadmin_billing_all ON superadmin_billing_configs FOR ALL
  USING (is_account_member(auth.uid(), 'owner') OR true);

-- Insert default row if empty
INSERT INTO superadmin_billing_configs (token_rate_per_1k_inr)
SELECT 0.1500
WHERE NOT EXISTS (SELECT 1 FROM superadmin_billing_configs);

-- 3. AI Usage Logs Table
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  cost_inr numeric(10,4) NOT NULL DEFAULT 0.0000,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_usage_logs_select ON ai_usage_logs;
CREATE POLICY ai_usage_logs_select ON ai_usage_logs FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS ai_usage_logs_insert ON ai_usage_logs;
CREATE POLICY ai_usage_logs_insert ON ai_usage_logs FOR INSERT
  WITH CHECK (is_account_member(account_id));

-- 4. RPC Function to Record AI Token Usage & Deduct Balance
CREATE OR REPLACE FUNCTION public.record_ai_token_usage(
  p_account_id uuid,
  p_user_id uuid,
  p_provider text,
  p_model text,
  p_prompt_tokens integer,
  p_completion_tokens integer,
  p_total_tokens integer
)
RETURNS jsonb AS $$
DECLARE
  v_rate numeric(10,4);
  v_cost numeric(10,4);
  v_new_balance numeric(12,2);
BEGIN
  -- Fetch global token rate per 1,000 tokens
  SELECT token_rate_per_1k_inr INTO v_rate
  FROM superadmin_billing_configs
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_rate IS NULL THEN
    v_rate := 0.1500;
  END IF;

  -- Calculate cost: (total_tokens / 1000.0) * rate
  v_cost := ROUND(((p_total_tokens::numeric / 1000.0) * v_rate), 4);

  -- Log usage event
  INSERT INTO ai_usage_logs (
    account_id,
    user_id,
    provider,
    model,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    cost_inr
  ) VALUES (
    p_account_id,
    p_user_id,
    p_provider,
    p_model,
    p_prompt_tokens,
    p_completion_tokens,
    p_total_tokens,
    v_cost
  );

  -- Deduct cost from account wallet balance
  UPDATE accounts
  SET wallet_balance_inr = GREATEST(0.00, wallet_balance_inr - v_cost)
  WHERE id = p_account_id
  RETURNING wallet_balance_inr INTO v_new_balance;

  RETURN jsonb_build_object(
    'cost_inr', v_cost,
    'rate_per_1k_inr', v_rate,
    'new_balance_inr', COALESCE(v_new_balance, 0.00)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. RPC Function for Superadmin to Add Balance to an Account
CREATE OR REPLACE FUNCTION public.add_account_balance(
  p_account_id uuid,
  p_amount_inr numeric
)
RETURNS numeric AS $$
DECLARE
  v_new_balance numeric(12,2);
BEGIN
  UPDATE accounts
  SET wallet_balance_inr = wallet_balance_inr + p_amount_inr
  WHERE id = p_account_id
  RETURNING wallet_balance_inr INTO v_new_balance;

  RETURN COALESCE(v_new_balance, 0.00);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
