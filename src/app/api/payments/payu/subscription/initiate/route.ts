import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { createPayUPaymentDetails } from '@/lib/payments/payu';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { account_id, user_id, firstname, email, phone, coupon_code } = body;

    if (!account_id) {
      return NextResponse.json({ error: 'Missing account_id' }, { status: 400 });
    }

    const db = supabaseAdmin();

    // 1. Fetch current monthly subscription price
    const { data: priceData } = await db
      .from('superadmin_billing_configs')
      .select('monthly_subscription_price_inr')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const basePrice = Number(priceData?.monthly_subscription_price_inr ?? 499.00);
    let finalPrice = basePrice;
    let appliedCoupon: any = null;

    // 2. Validate Coupon Code if provided
    if (coupon_code) {
      const codeClean = String(coupon_code).trim().toUpperCase();
      const { data: coupon } = await db
        .from('coupons')
        .select('*')
        .eq('code', codeClean)
        .eq('is_active', true)
        .maybeSingle();

      if (coupon) {
        const isNotExpired = !coupon.valid_until || new Date(coupon.valid_until) > new Date();
        const hasUsesLeft = coupon.max_uses === null || coupon.used_count < coupon.max_uses;

        if (isNotExpired && hasUsesLeft) {
          appliedCoupon = coupon;
          if (coupon.is_100_percent_free || coupon.discount_percent >= 100) {
            finalPrice = 0;
          } else {
            finalPrice = Math.max(0, basePrice * (1 - coupon.discount_percent / 100));
          }
        }
      }
    }

    // 3. Case A: 100% Free Access (via 100% free coupon)
    if (finalPrice <= 0) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Deactivate older active subscriptions
      await db
        .from('subscriptions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('account_id', account_id)
        .eq('status', 'active');

      // Create new active Pro subscription
      const { data: sub, error: subErr } = await db
        .from('subscriptions')
        .insert({
          account_id,
          plan_type: 'pro',
          status: 'active',
          starts_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          is_free_grant: true,
          applied_coupon_code: appliedCoupon?.code || 'FREE_COUPON',
          amount_paid_inr: 0,
        })
        .select()
        .single();

      if (subErr) {
        return NextResponse.json({ error: subErr.message || 'Failed to activate subscription' }, { status: 500 });
      }

      // Record coupon usage if coupon applied
      if (appliedCoupon) {
        await db.from('coupon_usages').insert({
          coupon_id: appliedCoupon.id,
          account_id,
          user_id: user_id || null,
        });

        await db
          .from('coupons')
          .update({ used_count: (appliedCoupon.used_count || 0) + 1 })
          .eq('id', appliedCoupon.id);
      }

      return NextResponse.json({
        is_free: true,
        success: true,
        message: 'Monthly subscription activated successfully via coupon code!',
        subscription: sub,
      });
    }

    // 4. Case B: Paid Subscription via PayU
    const txnid = `SUB_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const productinfo = `SUB|${account_id}|${appliedCoupon?.code || 'NONE'}`;

    const payuDetails = createPayUPaymentDetails({
      txnid,
      amount: finalPrice,
      productinfo,
      firstname: firstname || 'Customer',
      email: email || 'customer@wacrm.com',
      phone: phone || '9876543210',
    });

    return NextResponse.json({
      is_free: false,
      txnid,
      amount: finalPrice,
      productinfo,
      payu: payuDetails,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Subscription initiation failed' }, { status: 500 });
  }
}
