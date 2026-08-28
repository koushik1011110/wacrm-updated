import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: Request) {
  try {
    const db = supabaseAdmin();
    const cookieStore = await cookies();

    // Authenticate user via Supabase SSR client or custom auth header
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    const { searchParams } = new URL(request.url);
    let accountId = searchParams.get('account_id');

    if (!accountId && user) {
      const { data: profile } = await db
        .from('profiles')
        .select('account_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.account_id) {
        accountId = profile.account_id;
      }
    }

    if (!accountId) {
      return NextResponse.json({
        is_pro: false,
        subscription: null,
        monthly_price_inr: 499.00,
      });
    }

    // Fetch active subscription
    const { data: activeSub } = await db
      .from('subscriptions')
      .select('*')
      .eq('account_id', accountId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch monthly subscription pricing
    const { data: priceData } = await db
      .from('superadmin_billing_configs')
      .select('monthly_subscription_price_inr')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const monthlyPrice = Number(priceData?.monthly_subscription_price_inr ?? 499.00);

    return NextResponse.json({
      account_id: accountId,
      is_pro: Boolean(activeSub),
      subscription: activeSub || null,
      monthly_price_inr: monthlyPrice,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to check subscription status' }, { status: 500 });
  }
}
