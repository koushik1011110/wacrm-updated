import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { engineSendText } from '@/lib/flows/meta-send';

function getSiteUrl(): string {
  let url = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (!url || url.includes('example.com')) {
    return 'http://localhost:3000';
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
}

/**
 * POST /api/payments/payu/callback
 * Handles PayU Payment Callback & Webhook POST responses.
 */
export async function POST(request: Request) {
  try {
    const db = supabaseAdmin();
    const siteUrl = getSiteUrl();

    // Read form body or json body
    let bodyData: Record<string, string> = {};
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        bodyData[key] = value.toString();
      });
    } else {
      bodyData = await request.json().catch(() => ({}));
    }

    console.log('[payu callback] Received PayU response payload:', bodyData);

    const txnid = bodyData.txnid || new URL(request.url).searchParams.get('txnid') || '';
    const status = (bodyData.status || bodyData.payu_status || '').toLowerCase();
    const mihpayid = bodyData.mihpayid || bodyData.payuMoneyId || `PAYU_${Date.now()}`;

    if (!txnid) {
      console.warn('[payu callback] txnid missing in callback');
      return NextResponse.redirect(`${siteUrl}/bookings?payment_error=missing_txnid`, { status: 303 });
    }

    // 1. Query by cashfree_order_id = txnid
    let { data: booking } = await db
      .from('bookings')
      .select('*')
      .eq('cashfree_order_id', txnid)
      .maybeSingle();

    // 2. If not found by cashfree_order_id, query by UUID if txnid is valid UUID
    if (!booking) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(txnid);
      if (isUuid) {
        const { data: bookingById } = await db
          .from('bookings')
          .select('*')
          .eq('id', txnid)
          .maybeSingle();
        booking = bookingById;
      }
    }

    // 3. Fallback: find latest pending_payment booking record
    if (!booking) {
      const { data: latestPending } = await db
        .from('bookings')
        .select('*')
        .eq('status', 'pending_payment')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      booking = latestPending;
    }

    if (!booking) {
      console.warn('[payu callback] Booking record not found for txnid:', txnid);
      return NextResponse.redirect(`${siteUrl}/bookings?payment_success=${encodeURIComponent(txnid)}`, { status: 303 });
    }

    const isSuccess =
      status === 'success' ||
      status === 'paid' ||
      status === 'completed' ||
      bodyData.unmappedstatus === 'captured';

    if (isSuccess) {
      // 1. Mark booking confirmed in database
      await db
        .from('bookings')
        .update({
          status: 'confirmed',
          payment_status: 'SUCCESS',
          cashfree_payment_id: String(mihpayid),
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      // 2. Clear active booking step on conversation
      if (booking.conversation_id) {
        await db
          .from('conversations')
          .update({ current_booking_id: null, booking_step: null })
          .eq('id', booking.conversation_id);
      }

      // 3. Send WhatsApp Booking Confirmation Message to Customer!
      try {
        let accountId = booking.account_id;
        let contactId = booking.contact_id;
        let conversationId = booking.conversation_id;

        // If contactId or conversationId missing, resolve via customer phone
        if ((!contactId || !conversationId) && booking.customer_phone) {
          const phoneClean = booking.customer_phone.replace(/\D/g, '').slice(-10);

          const { data: contact } = await db
            .from('contacts')
            .select('id')
            .eq('account_id', accountId)
            .ilike('phone', `%${phoneClean}%`)
            .limit(1)
            .maybeSingle();

          if (contact) {
            contactId = contact.id;
            const { data: conv } = await db
              .from('conversations')
              .select('id')
              .eq('account_id', accountId)
              .eq('contact_id', contact.id)
              .limit(1)
              .maybeSingle();

            if (conv) {
              conversationId = conv.id;
            }
          }
        }

        // Get system owner user_id from profiles
        const { data: profile } = await db
          .from('profiles')
          .select('user_id')
          .eq('account_id', accountId)
          .limit(1)
          .maybeSingle();

        const userId = profile?.user_id || 'system';

        if (accountId && contactId && conversationId) {
          const confirmationMessage =
            `🎉 *Payment Successful via PayU! Booking Confirmed!* 🎉\n\n` +
            `📋 *Booking Summary:*\n` +
            `• *PayU Txn ID:* ${txnid}\n` +
            `• *Name:* ${booking.customer_name || 'Customer'}\n` +
            `• *Phone:* ${booking.customer_phone || ''}\n` +
            `• *Date & Slot:* ${booking.booking_date || 'Confirmed'}\n` +
            `• *Advance Paid:* ₹${booking.advance_amount || 1}\n\n` +
            `Thank you for booking with us! We look forward to serving you. 😊`;

          console.log('[payu callback] Sending WhatsApp confirmation message to contact:', contactId);
          await engineSendText({
            accountId,
            userId,
            conversationId,
            contactId,
            text: confirmationMessage,
            isAiReply: true,
          });
          console.log('[payu callback] WhatsApp confirmation message successfully sent!');
        }
      } catch (sendErr: any) {
        console.error('[payu callback] Failed to send WhatsApp confirmation message:', sendErr);
      }
    }

    // Clean browser redirect to Bookings dashboard page
    return NextResponse.redirect(`${siteUrl}/bookings?payment_success=${encodeURIComponent(txnid)}`, { status: 303 });
  } catch (err: any) {
    console.error('[payu callback] Error processing PayU callback:', err);
    const siteUrl = getSiteUrl();
    return NextResponse.redirect(`${siteUrl}/bookings?error=callback_failed`, { status: 303 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const txnid = searchParams.get('txnid') || 'true';
  const siteUrl = getSiteUrl();
  return NextResponse.redirect(`${siteUrl}/bookings?payment_success=${encodeURIComponent(txnid)}`);
}
