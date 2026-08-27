import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';

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
    const db = supabaseAdmin();

    // Fetch account details for default_booking_advance_amount and booking_time_slots using admin client
    const { data: account, error: accErr } = await db
      .from('accounts')
      .select('default_booking_advance_amount, booking_time_slots')
      .eq('id', accountId)
      .maybeSingle();

    if (accErr) {
      console.warn('[bookings api] Warning fetching account settings:', accErr);
    }

    const defaultAdvanceAmount = Number(account?.default_booking_advance_amount ?? 500.0);
    const timeSlots = account?.booking_time_slots || [
      '10:00 AM - Morning Slot',
      '02:00 PM - Afternoon Slot',
      '05:00 PM - Evening Slot',
      '08:00 PM - Night Slot',
    ];

    // Fetch all bookings for this account
    const { data: bookings, error: bookingsErr } = await db
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
      default_advance_amount: defaultAdvanceAmount,
      time_slots: timeSlots,
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
 * Updates a booking's status or workspace default advance booking amount / time slots.
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'Account not found' }, { status: 400 });
    }

    const accountId = profile.account_id;
    const db = supabaseAdmin();
    const body = await request.json().catch(() => ({}));

    // Action: Update default workspace advance booking fee
    if (body.action === 'update_default_advance') {
      const amount = Number(body.amount);
      if (isNaN(amount) || amount < 0) {
        return NextResponse.json({ error: 'Invalid advance amount' }, { status: 400 });
      }

      const { error: updErr } = await db
        .from('accounts')
        .update({ default_booking_advance_amount: amount })
        .eq('id', accountId);

      if (updErr) {
        console.error('[bookings api] Error updating default_booking_advance_amount:', updErr);
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, default_advance_amount: amount });
    }

    // Action: Update custom time slots array
    if (body.action === 'update_time_slots') {
      const slots = Array.isArray(body.slots) ? body.slots : [];
      let { error: updErr } = await db
        .from('accounts')
        .update({ booking_time_slots: slots })
        .eq('id', accountId);

      if (updErr) {
        console.error('[bookings api] Error updating booking_time_slots on accounts:', updErr);
        try {
          await db.rpc('exec_sql', {
            query: 'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS booking_time_slots jsonb;',
          });
          const retry = await db.from('accounts').update({ booking_time_slots: slots }).eq('id', accountId);
          updErr = retry.error;
        } catch {
          // Ignore RPC failure
        }
      }

      if (updErr) {
        return NextResponse.json(
          {
            error: `Database migration required: Please run this SQL in Supabase SQL Editor:\nALTER TABLE accounts ADD COLUMN IF NOT EXISTS booking_time_slots jsonb;`,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, time_slots: slots });
    }

    // Action: Update booking record status
    const { id, status } = body;
    if (!id || !status) {
      return NextResponse.json({ error: 'Booking ID and status are required' }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await db
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
