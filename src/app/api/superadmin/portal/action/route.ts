import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get('superadmin_session');
  if (session?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = supabaseAdmin();
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    if (action === 'set_token_rate') {
      const rate = Number(body.rate);
      if (isNaN(rate) || rate < 0) {
        return NextResponse.json({ error: 'Invalid token rate' }, { status: 400 });
      }

      const { data: existing } = await db
        .from('superadmin_billing_configs')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        await db
          .from('superadmin_billing_configs')
          .update({ token_rate_per_1k_inr: rate, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await db
          .from('superadmin_billing_configs')
          .insert({ token_rate_per_1k_inr: rate });
      }

      return NextResponse.json({ success: true, rate });
    }

    if (action === 'set_balance') {
      const accountId = body.account_id;
      const newBalance = Number(body.balance);

      if (!accountId || isNaN(newBalance) || newBalance < 0) {
        return NextResponse.json({ error: 'Invalid account or balance value' }, { status: 400 });
      }

      await db
        .from('accounts')
        .update({ wallet_balance_inr: newBalance })
        .eq('id', accountId);

      return NextResponse.json({ success: true, account_id: accountId, balance: newBalance });
    }

    if (action === 'add_balance') {
      const accountId = body.account_id;
      const amount = Number(body.amount);

      if (!accountId || isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Invalid account or amount' }, { status: 400 });
      }

      const { data: acc } = await db
        .from('accounts')
        .select('wallet_balance_inr')
        .eq('id', accountId)
        .single();

      const current = Number(acc?.wallet_balance_inr || 0);
      const updated = current + amount;

      await db
        .from('accounts')
        .update({ wallet_balance_inr: updated })
        .eq('id', accountId);

      return NextResponse.json({ success: true, account_id: accountId, balance: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
