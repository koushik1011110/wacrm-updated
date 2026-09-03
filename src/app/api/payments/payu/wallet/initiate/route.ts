import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { createPayUPaymentDetails } from '@/lib/payments/payu';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { account_id, amount, firstname, email, phone } = body;

    const topupAmount = Number(amount);

    if (!account_id) {
      return NextResponse.json({ error: 'Missing account_id' }, { status: 400 });
    }

    if (isNaN(topupAmount) || topupAmount <= 0) {
      return NextResponse.json({ error: 'Enter a valid top-up amount in ₹' }, { status: 400 });
    }

    const db = supabaseAdmin();

    // Verify account exists and fetch its PayU credentials
    const { data: account, error: accErr } = await db
      .from('accounts')
      .select('id, name, payu_merchant_key, payu_merchant_salt, payu_env')
      .eq('id', account_id)
      .maybeSingle();

    if (accErr || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const txnid = `TOPUP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const productinfo = `TOPUP|${account_id}|${topupAmount}`;

    const payuDetails = createPayUPaymentDetails({
      txnid,
      amount: topupAmount,
      productinfo,
      firstname: firstname || 'Customer',
      email: email || 'customer@wacrm.com',
      phone: phone || '9876543210',
      merchantKey: account?.payu_merchant_key || undefined,
      merchantSalt: account?.payu_merchant_salt || undefined,
      payuEnv: account?.payu_env || undefined,
      accountId: account_id,
    });

    return NextResponse.json({
      success: true,
      txnid,
      amount: topupAmount,
      productinfo,
      payu: payuDetails,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Wallet top-up initiation failed' }, { status: 500 });
  }
}
