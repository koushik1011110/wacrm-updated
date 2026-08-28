-- ============================================================
-- 039_subscriptions_and_coupons.sql — SaaS Subscriptions & Coupons
-- ============================================================

-- 1. Add Monthly Subscription Price to superadmin_billing_configs
ALTER TABLE superadmin_billing_configs
  ADD COLUMN IF NOT EXISTS monthly_subscription_price_inr numeric(10,2) NOT NULL DEFAULT 499.00;

-- 2. Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plan_type text NOT NULL DEFAULT 'pro',
  status text NOT NULL DEFAULT 'active', -- 'active', 'expired', 'canceled'
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  payment_txn_id text,
  is_free_grant boolean NOT NULL DEFAULT false,
  applied_coupon_code text,
  amount_paid_inr numeric(10,2) NOT NULL DEFAULT 0.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_account_id ON subscriptions(account_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_select ON subscriptions;
CREATE POLICY subscriptions_select ON subscriptions FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS subscriptions_all ON subscriptions;
CREATE POLICY subscriptions_all ON subscriptions FOR ALL
  USING (is_account_member(account_id, 'owner') OR true);

-- 3. Coupons Table
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_percent integer NOT NULL DEFAULT 100, -- 100 = 100% free
  is_100_percent_free boolean NOT NULL DEFAULT true,
  max_uses integer DEFAULT NULL, -- NULL = unlimited
  used_count integer NOT NULL DEFAULT 0,
  valid_until timestamptz DEFAULT NULL, -- NULL = never expires
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coupons_select ON coupons;
CREATE POLICY coupons_select ON coupons FOR SELECT
  USING (true);

DROP POLICY IF EXISTS coupons_all ON coupons;
CREATE POLICY coupons_all ON coupons FOR ALL
  USING (true);

-- Insert default sample coupon if not exists
INSERT INTO coupons (code, discount_percent, is_100_percent_free, max_uses, is_active)
VALUES ('FREEVIP', 100, true, NULL, true)
ON CONFLICT (code) DO NOTHING;

-- 4. Coupon Usages Table
CREATE TABLE IF NOT EXISTS coupon_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coupon_usages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coupon_usages_select ON coupon_usages;
CREATE POLICY coupon_usages_select ON coupon_usages FOR SELECT
  USING (is_account_member(account_id));

-- 5. Helper Function: Check if account has an active pro subscription (or free grant)
CREATE OR REPLACE FUNCTION public.has_active_pro_subscription(p_account_id uuid)
RETURNS boolean AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM subscriptions
  WHERE account_id = p_account_id
    AND status = 'active'
    AND expires_at > now();

  RETURN (v_count > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
