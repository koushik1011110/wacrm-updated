import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

/**
 * GET /api/superadmin/billing (admin/owner)
 * Returns token price rate setting and account wallet balances.
 *
 * POST /api/superadmin/billing (admin/owner)
 * Body: { action: 'set_rate', rate: 0.15 } OR { action: 'add_balance', account_id: '...', amount: 100 }
 */
export async function GET() {
  try {
    const { supabase } = await requireRole('admin');

    const { data: config } = await supabase
      .from('superadmin_billing_configs')
      .select('token_rate_per_1k_inr')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name, wallet_balance_inr, created_at')
      .order('name', { ascending: true });

    return NextResponse.json({
      token_rate_per_1k_inr: Number(config?.token_rate_per_1k_inr ?? 0.15),
      accounts: accounts || [],
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountRole } = await requireRole('admin');
    const body = await request.json().catch(() => ({}));

    if (body.action === 'set_rate') {
      const rate = Number(body.rate);
      if (isNaN(rate) || rate < 0) {
        return NextResponse.json({ error: 'Invalid rate value' }, { status: 400 });
      }

      // Check if config row exists
      const { data: existing } = await supabase
        .from('superadmin_billing_configs')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('superadmin_billing_configs')
          .update({ token_rate_per_1k_inr: rate, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('superadmin_billing_configs')
          .insert({ token_rate_per_1k_inr: rate });
      }

      return NextResponse.json({ success: true, token_rate_per_1k_inr: rate });
    }

    if (body.action === 'add_balance') {
      const accountId = body.account_id;
      const amount = Number(body.amount);

      if (!accountId || isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Invalid account ID or balance amount' }, { status: 400 });
      }

      const { data: updatedBalance, error } = await supabase.rpc('add_account_balance', {
        p_account_id: accountId,
        p_amount_inr: amount,
      });

      if (error) {
        // Fallback direct update if RPC is missing
        const { data: acc } = await supabase
          .from('accounts')
          .select('wallet_balance_inr')
          .eq('id', accountId)
          .single();
        const newBal = Number(acc?.wallet_balance_inr || 0) + amount;
        await supabase
          .from('accounts')
          .update({ wallet_balance_inr: newBal })
          .eq('id', accountId);
      }

      return NextResponse.json({ success: true, account_id: accountId, added: amount });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
