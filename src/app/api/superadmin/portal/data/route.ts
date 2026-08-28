import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('superadmin_session');
  if (session?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = supabaseAdmin();

    // 1. Total users count
    const { count: totalUsers } = await db
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // 2. Accounts list with user counts and wallet balance
    const { data: accounts } = await db
      .from('accounts')
      .select('id, name, wallet_balance_inr, created_at')
      .order('created_at', { ascending: false });

    // Get profiles for count per account
    const { data: profiles } = await db
      .from('profiles')
      .select('account_id');

    const profileCountMap: Record<string, number> = {};
    (profiles || []).forEach((p) => {
      if (p.account_id) {
        profileCountMap[p.account_id] = (profileCountMap[p.account_id] || 0) + 1;
      }
    });

    // 3. AI Usage stats
    const { data: logs } = await db
      .from('ai_usage_logs')
      .select('total_tokens, cost_inr');

    const totalTokensUsed = (logs || []).reduce((sum, l) => sum + (l.total_tokens || 0), 0);
    const totalCostInr = (logs || []).reduce((sum, l) => sum + Number(l.cost_inr || 0), 0);

    // 4. Token Rate & Subscription Pricing Configs
    const { data: rateData } = await db
      .from('superadmin_billing_configs')
      .select('token_rate_per_1k_inr, monthly_subscription_price_inr')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const tokenRatePer1kInr = Number(rateData?.token_rate_per_1k_inr ?? 0.15);
    const monthlySubscriptionPriceInr = Number(rateData?.monthly_subscription_price_inr ?? 499.00);

    // 5. Active Subscriptions map per account
    const { data: subscriptions } = await db
      .from('subscriptions')
      .select('account_id, plan_type, status, expires_at, is_free_grant, applied_coupon_code')
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString());

    const subMap: Record<string, any> = {};
    (subscriptions || []).forEach((sub) => {
      subMap[sub.account_id] = sub;
    });

    // 6. Coupons list
    const { data: coupons } = await db
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    const formattedAccounts = (accounts || []).map((acc) => {
      const activeSub = subMap[acc.id];
      return {
        id: acc.id,
        name: acc.name,
        wallet_balance_inr: Number(acc.wallet_balance_inr ?? 100.0),
        user_count: profileCountMap[acc.id] || 0,
        created_at: acc.created_at,
        subscription: activeSub
          ? {
              status: activeSub.status,
              expires_at: activeSub.expires_at,
              is_free_grant: activeSub.is_free_grant,
              applied_coupon_code: activeSub.applied_coupon_code,
            }
          : null,
      };
    });

    return NextResponse.json({
      total_users: totalUsers || 0,
      total_accounts: accounts?.length || 0,
      total_tokens_used: totalTokensUsed,
      total_cost_inr: Number(totalCostInr.toFixed(4)),
      token_rate_per_1k_inr: tokenRatePer1kInr,
      monthly_subscription_price_inr: monthlySubscriptionPriceInr,
      coupons: coupons || [],
      accounts: formattedAccounts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load portal data' }, { status: 500 });
  }
}
