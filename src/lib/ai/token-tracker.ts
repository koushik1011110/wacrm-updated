import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Robust utility to track AI token usage and deduct balance from account wallet.
 */
export async function trackAiTokenUsage(
  supabase: SupabaseClient,
  accountId: string,
  userId: string | null,
  provider: string,
  model: string,
  inputText: string,
  outputText: string
) {
  try {
    if (!accountId) return;

    // Calculate prompt and completion tokens (standard 1 token ≈ 4 characters rule)
    const promptTokens = Math.max(1, Math.ceil((inputText || '').length / 4));
    const completionTokens = Math.max(1, Math.ceil((outputText || '').length / 4));
    const totalTokens = promptTokens + completionTokens;

    // Fetch token rate
    const { data: rateData } = await supabase
      .from('superadmin_billing_configs')
      .select('token_rate_per_1k_inr')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const rate = Number(rateData?.token_rate_per_1k_inr ?? 0.15);
    const costInr = Number(((totalTokens / 1000.0) * rate).toFixed(4));

    // Execute RPC to log usage and deduct balance atomically
    const { error: rpcError } = await supabase.rpc('record_ai_token_usage', {
      p_account_id: accountId,
      p_user_id: userId,
      p_provider: provider,
      p_model: model,
      p_prompt_tokens: promptTokens,
      p_completion_tokens: completionTokens,
      p_total_tokens: totalTokens,
    });

    if (rpcError) {
      console.warn('[token-tracker] RPC fallback:', rpcError.message);
      // Fallback: direct table insert & balance update
      await supabase.from('ai_usage_logs').insert({
        account_id: accountId,
        user_id: userId,
        provider,
        model,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        cost_inr: costInr,
      });

      const { data: acc } = await supabase
        .from('accounts')
        .select('wallet_balance_inr')
        .eq('id', accountId)
        .maybeSingle();

      if (acc) {
        const curBal = Number(acc.wallet_balance_inr ?? 100);
        await supabase
          .from('accounts')
          .update({ wallet_balance_inr: Math.max(0, curBal - costInr) })
          .eq('id', accountId);
      }
    }
  } catch (err) {
    console.error('[token-tracker] Error tracking token usage:', err);
  }
}
