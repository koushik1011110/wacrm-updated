import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { engineSendText } from '@/lib/flows/meta-send';

/**
 * POST /api/payments/cashfree/webhook
 * Handles Cashfree Payment Webhook callbacks & payment confirmation.
 */
export async function POST(request: Request) {
  try {
    const db = supabaseAdmin();

    // Read payload
    const body = await request.json().catch(() => ({}));
    console.log('[cashfree webhook] Received payload:', JSON.stringify(body));

    // Support Cashfree v3 payload formats: data.order.order_id or orderId or query param
    const data = body.data || body;
    const orderId =
      data.order?.order_id ||
      data.order_id ||
      data.orderId ||
      new URL(request.url).searchParams.get('order_id');

    const eventType = String(body.type || data.event || '').toUpperCase();
    const rawStatus = String(
      data.payment?.payment_status ||
      data.txStatus ||
      data.order_status ||
      eventType ||
      'SUCCESS'
    ).toUpperCase();

    const isSuccess =
      rawStatus.includes('SUCCESS') ||
      rawStatus.includes('PAID') ||
      eventType.includes('SUCCESS') ||
      eventType.includes('PAID');

    const paymentId = data.payment?.cf_payment_id || data.referenceId || data.payment_id || '';

    if (!orderId) {
      return NextResponse.json({ error: 'order_id missing in webhook' }, { status: 400 });
    }

    // Find booking matching cashfree_order_id
    const { data: booking, error: findErr } = await db
      .from('bookings')
      .select('*')
      .eq('cashfree_order_id', orderId)
      .maybeSingle();

    if (findErr || !booking) {
      console.warn('[cashfree webhook] Booking not found for orderId:', orderId);
      return NextResponse.json({ message: 'Booking not found' }, { status: 200 });
    }

    if (isSuccess) {
      // 1. Mark booking confirmed
      await db
        .from('bookings')
        .update({
          status: 'confirmed',
          payment_status: 'SUCCESS',
          cashfree_payment_id: String(paymentId),
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
          const serviceName = booking.service_name || 'Booking Appointment';
          const confirmationMessage =
            `🎉 *Payment Successful! Booking Confirmed!* 🎉\n\n` +
            `📋 *Booking Summary:*\n` +
            `• *Item / Service:* ${serviceName}\n` +
            `• *Reference ID:* ${orderId}\n` +
            `• *Name:* ${booking.customer_name || 'Customer'}\n` +
            `• *Phone:* ${booking.customer_phone || ''}\n` +
            `• *Date & Slot:* ${booking.booking_date || 'Confirmed'}\n` +
            `• *Advance Paid:* ₹${booking.advance_amount || 500}\n\n` +
            `Thank you for booking with us! We look forward to serving you. 😊`;

          console.log('[cashfree webhook] Dispatching WhatsApp confirmation to contact:', contactId);
          await engineSendText({
            accountId,
            userId,
            conversationId,
            contactId,
            text: confirmationMessage,
            isAiReply: true,
          });
          console.log('[cashfree webhook] WhatsApp confirmation message successfully sent!');
        } else {
          console.warn('[cashfree webhook] Missing contact/conversation info for notification:', {
            accountId,
            contactId,
            conversationId,
          });
        }
      } catch (sendErr: any) {
        console.error('[cashfree webhook] Failed to send WhatsApp confirmation message:', sendErr);
      }
    }

    return NextResponse.json({ success: true, order_id: orderId });
  } catch (err: any) {
    console.error('[cashfree webhook] Error processing callback:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  // Support Cashfree browser return_url redirect
  const searchParams = new URL(request.url).searchParams;
  const orderId = searchParams.get('order_id');
  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/inbox?booking_success=${orderId || 'true'}`
  );
}
