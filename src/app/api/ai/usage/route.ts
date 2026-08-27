import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

/**
 * GET /api/ai/usage (agent+)
 * Returns token usage metrics, cost incurred (in ₹), account wallet balance, and recent logs.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('agent');

    // 1. Get current account balance
    const { data: accountData } = await supabase
      .from('accounts')
      .select('wallet_balance_inr')
      .eq('id', accountId)
      .maybeSingle();

    const walletBalanceInr = Number(accountData?.wallet_balance_inr ?? 100.0);

    // 2. Get global token rate from superadmin billing config
    const { data: configData } = await supabase
      .from('superadmin_billing_configs')
      .select('token_rate_per_1k_inr')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const tokenRatePer1kInr = Number(configData?.token_rate_per_1k_inr ?? 0.15);

    // 3. Get all logs for sum calculation & top 50 recent logs
    const { data: allLogs } = await supabase
      .from('ai_usage_logs')
      .select('total_tokens, cost_inr')
      .eq('account_id', accountId);

    const safeAllLogs = allLogs || [];
    const totalTokens = safeAllLogs.reduce((sum, log) => sum + (log.total_tokens || 0), 0);
    const totalCostInr = safeAllLogs.reduce((sum, log) => sum + Number(log.cost_inr || 0), 0);

    const { data: recentLogs } = await supabase
      .from('ai_usage_logs')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      wallet_balance_inr: walletBalanceInr,
      token_rate_per_1k_inr: tokenRatePer1kInr,
      total_tokens: totalTokens,
      total_cost_inr: Number(totalCostInr.toFixed(4)),
      recent_logs: recentLogs || [],
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
