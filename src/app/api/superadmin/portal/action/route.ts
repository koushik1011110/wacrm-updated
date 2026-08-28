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

    if (action === 'set_subscription_price') {
      const price = Number(body.price);
      if (isNaN(price) || price < 0) {
        return NextResponse.json({ error: 'Invalid subscription price' }, { status: 400 });
      }

      const { data: existing } = await db
        .from('superadmin_billing_configs')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        await db
          .from('superadmin_billing_configs')
          .update({ monthly_subscription_price_inr: price, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await db
          .from('superadmin_billing_configs')
          .insert({ monthly_subscription_price_inr: price });
      }

      return NextResponse.json({ success: true, price });
    }

    if (action === 'create_coupon') {
      const code = String(body.code || '').trim().toUpperCase();
      const discountPercent = Number(body.discount_percent ?? 100);
      const is100Free = body.is_100_percent_free ?? (discountPercent === 100);
      const maxUses = body.max_uses ? Number(body.max_uses) : null;
      const validUntil = body.valid_until ? new Date(body.valid_until).toISOString() : null;

      if (!code) {
        return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 });
      }

      const { data: inserted, error: insertErr } = await db
        .from('coupons')
        .insert({
          code,
          discount_percent: discountPercent,
          is_100_percent_free: is100Free,
          max_uses: maxUses,
          valid_until: validUntil,
          is_active: true,
        })
        .select()
        .single();

      if (insertErr) {
        return NextResponse.json({ error: insertErr.message || 'Coupon code already exists' }, { status: 400 });
      }

      return NextResponse.json({ success: true, coupon: inserted });
    }

    if (action === 'toggle_coupon') {
      const couponId = body.coupon_id;
      const isActive = Boolean(body.is_active);

      if (!couponId) {
        return NextResponse.json({ error: 'Missing coupon_id' }, { status: 400 });
      }

      await db
        .from('coupons')
        .update({ is_active: isActive })
        .eq('id', couponId);

      return NextResponse.json({ success: true, coupon_id: couponId, is_active: isActive });
    }

    if (action === 'delete_coupon') {
      const couponId = body.coupon_id;
      if (!couponId) {
        return NextResponse.json({ error: 'Missing coupon_id' }, { status: 400 });
      }

      await db
        .from('coupons')
        .delete()
        .eq('id', couponId);

      return NextResponse.json({ success: true, coupon_id: couponId });
    }

    if (action === 'grant_free_subscription') {
      const accountId = body.account_id;
      const days = Number(body.days || 30);

      if (!accountId) {
        return NextResponse.json({ error: 'Missing account_id' }, { status: 400 });
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      // Deactivate any existing active subscriptions first
      await db
        .from('subscriptions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('account_id', accountId)
        .eq('status', 'active');

      const { data: newSub } = await db
        .from('subscriptions')
        .insert({
          account_id: accountId,
          plan_type: 'pro',
          status: 'active',
          starts_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          is_free_grant: true,
          applied_coupon_code: body.coupon_code || 'SUPERADMIN_GRANT',
          amount_paid_inr: 0,
        })
        .select()
        .single();

      return NextResponse.json({ success: true, subscription: newSub });
    }

    if (action === 'revoke_subscription') {
      const accountId = body.account_id;
      if (!accountId) {
        return NextResponse.json({ error: 'Missing account_id' }, { status: 400 });
      }

      await db
        .from('subscriptions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('account_id', accountId)
        .eq('status', 'active');

      return NextResponse.json({ success: true, account_id: accountId });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
