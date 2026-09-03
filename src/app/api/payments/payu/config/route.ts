import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/payments/payu/config
 * Reads the authenticated workspace account's PayU credentials.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'Account not found' }, { status: 400 });
    }

    const { data: account } = await supabase
      .from('accounts')
      .select('payu_merchant_key, payu_merchant_salt, payu_env')
      .eq('id', profile.account_id)
      .single();

    const merchantKey = account?.payu_merchant_key || process.env.PAYU_MERCHANT_KEY || '';
    const merchantSalt = account?.payu_merchant_salt || process.env.PAYU_MERCHANT_SALT || '';
    const payuEnv = account?.payu_env || process.env.PAYU_ENV || 'TEST';

    // Mask salt for security UI presentation
    const maskedSalt = merchantSalt
      ? merchantSalt.slice(0, 4) + '••••••••' + merchantSalt.slice(-4)
      : '';

    return NextResponse.json({
      merchant_key: merchantKey,
      merchant_salt: '', // never prefill the masked salt into the editable field
      env: payuEnv,
      is_custom: Boolean(account?.payu_merchant_key && account?.payu_merchant_salt),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching config' }, { status: 500 });
  }
}

/**
 * POST /api/payments/payu/config
 * Updates the authenticated workspace account's PayU credentials.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'Account not found' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { merchant_key, merchant_salt, env } = body;

    if (!merchant_key || !merchant_salt) {
      return NextResponse.json({ error: 'Merchant Key and Merchant Salt are required' }, { status: 400 });
    }

    // Guard against the masked-salt round-trip bug: the UI never sends the
    // real salt back, so if the value contains the mask bullet (•) it is the
    // display placeholder, not a valid salt.
    if (String(merchant_salt).includes('•')) {
      return NextResponse.json({ error: 'Please enter the full Merchant Salt from your PayU dashboard (the field was showing a masked value)' }, { status: 400 });
    }

    const payuEnv = (env || 'TEST').toUpperCase() === 'PROD' ? 'PROD' : 'TEST';

    const { error: updateErr } = await supabase
      .from('accounts')
      .update({
        payu_merchant_key: merchant_key.trim(),
        payu_merchant_salt: merchant_salt.trim(),
        payu_env: payuEnv,
      })
      .eq('id', profile.account_id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'PayU credentials saved successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Save failed' }, { status: 500 });
  }
}
