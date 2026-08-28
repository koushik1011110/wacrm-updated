import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || '').trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ error: 'Please enter a coupon code' }, { status: 400 });
    }

    const db = supabaseAdmin();

    // 1. Fetch coupon details
    const { data: coupon, error } = await db
      .from('coupons')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (error || !coupon) {
      return NextResponse.json({ error: 'Invalid coupon code' }, { status: 404 });
    }

    if (!coupon.is_active) {
      return NextResponse.json({ error: 'This coupon is no longer active' }, { status: 400 });
    }

    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
      return NextResponse.json({ error: 'This coupon has expired' }, { status: 400 });
    }

    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      return NextResponse.json({ error: 'This coupon has reached maximum usage limit' }, { status: 400 });
    }

    // 2. Fetch current monthly subscription price
    const { data: priceData } = await db
      .from('superadmin_billing_configs')
      .select('monthly_subscription_price_inr')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const originalPrice = Number(priceData?.monthly_subscription_price_inr ?? 499.00);
    let finalPrice = originalPrice;

    if (coupon.is_100_percent_free || coupon.discount_percent >= 100) {
      finalPrice = 0;
    } else if (coupon.discount_percent > 0) {
      finalPrice = Math.max(0, originalPrice * (1 - coupon.discount_percent / 100));
    }

    return NextResponse.json({
      valid: true,
      code: coupon.code,
      discount_percent: coupon.discount_percent,
      is_100_percent_free: coupon.is_100_percent_free || finalPrice === 0,
      original_price_inr: originalPrice,
      final_price_inr: Number(finalPrice.toFixed(2)),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to validate coupon' }, { status: 500 });
  }
}
