import { NextResponse } from 'next/server';
import { createPayUPaymentDetails } from '@/lib/payments/payu';

/**
 * GET /api/payments/payu/hash
 * Generates signed PayU form data and SHA512 hash.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const txnid = searchParams.get('txnid') || `BK_${Date.now()}`;
    const amount = Number(searchParams.get('amount') || 500);
    const firstname = searchParams.get('firstname') || 'Customer';
    const productinfo = searchParams.get('productinfo') || 'Advance Booking Fee';

    const payuDetails = createPayUPaymentDetails({
      txnid,
      amount,
      productinfo,
      firstname,
      email: 'customer@gmail.com',
      phone: '9876543210',
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
