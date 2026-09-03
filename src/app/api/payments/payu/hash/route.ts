import { NextResponse } from 'next/server';
import { createPayUPaymentDetails } from '@/lib/payments/payu';
import { supabaseAdmin } from '@/lib/ai/admin-client';

/**
 * GET /api/payments/payu/hash
 * Generates signed PayU form data and SHA512 hash.
 * Uses the account's own PayU credentials (prod/test) when account_id is supplied.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const txnid = searchParams.get('txnid') || `BK_${Date.now()}`;
    const amount = Number(searchParams.get('amount') || 500);
    const firstname = searchParams.get('firstname') || 'Customer';
    const productinfo = searchParams.get('productinfo') || 'Advance Booking Fee';
    const accountId = searchParams.get('account_id') || '';

    // Load the account's saved PayU credentials so the checkout form
    // uses the correct environment (PROD vs TEST) and key/salt.
    let merchantKey: string | undefined;
    let merchantSalt: string | undefined;
    let payuEnv: string | undefined;
    if (accountId) {
      const db = supabaseAdmin();
      const { data: accPayu } = await db
        .from('accounts')
        .select('payu_merchant_key, payu_merchant_salt, payu_env')
        .eq('id', accountId)
        .maybeSingle();
      merchantKey = accPayu?.payu_merchant_key || undefined;
      merchantSalt = accPayu?.payu_merchant_salt || undefined;
      payuEnv = accPayu?.payu_env || undefined;
    }

    const payuDetails = createPayUPaymentDetails({
      txnid,
      amount,
      productinfo,
      firstname,
      email: 'customer@gmail.com',
      phone: '9876543210',
      merchantKey,
      merchantSalt,
      payuEnv,
      accountId: accountId || undefined,
    });

    return NextResponse.json({
      success: true,
      formData: payuDetails.formData,
      paymentLink: payuDetails.paymentLink,
    });
  } catch (err: any) {
    console.error('[payu hash api] Error generating PayU details:', err);
    return NextResponse.json({ error: err.message || 'Hash generation failed' }, { status: 500 });
  }
}
