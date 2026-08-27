import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/bookings
 * Fetches all bookings for the authenticated user's workspace account.
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

    // Resolve user's account_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'Account not found' }, { status: 400 });
    }

    const accountId = profile.account_id;

    // Fetch all bookings for this account
    const { data: bookings, error: bookingsErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (bookingsErr) {
      console.error('[bookings api] Error fetching bookings:', bookingsErr);
      return NextResponse.json({ error: bookingsErr.message }, { status: 500 });
    }

    const list = bookings || [];

    // Calculate metrics
    const totalCount = list.length;
    const confirmedCount = list.filter((b) => b.status === 'confirmed').length;
    const pendingPaymentCount = list.filter((b) => b.status === 'pending_payment').length;
    const totalAdvanceCollected = list
      .filter((b) => b.status === 'confirmed' || b.payment_status === 'SUCCESS')
      .reduce((sum, b) => sum + Number(b.advance_amount || 0), 0);

    return NextResponse.json({
      bookings: list,
      stats: {
        total: totalCount,
        confirmed: confirmedCount,
        pending_payment: pendingPaymentCount,
        total_advance: totalAdvanceCollected,
      },
    });
  } catch (err: any) {
    console.error('[bookings api] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * PATCH /api/bookings
 * Updates a booking's status or details.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Booking ID and status are required' }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, booking: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}
