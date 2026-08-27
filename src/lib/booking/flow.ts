import { SupabaseClient } from '@supabase/supabase-js';
import { createPayUPaymentDetails } from '@/lib/payments/payu';

export interface BookingState {
  isBookingFlow: boolean;
  step?: 'name' | 'phone' | 'datetime' | 'payment';
  bookingId?: string;
  replyText?: string;
  paymentLink?: string;
}

/**
 * Detects if the incoming message expresses an explicit booking / appointment reservation intent.
 * Ignores casual uses of the word 'book' in normal text.
 */
export function isBookingIntent(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  const lower = text.toLowerCase().trim();

  // Negative patterns (casual mentions)
  if (
    lower.includes('reading a book') ||
    lower.includes('good book') ||
    lower.includes('textbook') ||
    lower.includes('face book') ||
    lower.includes('comic book') ||
    lower.includes('notebook')
  ) {
    return false;
  }

  // Explicit booking patterns
  const bookingPatterns = [
    /\b(want|like|need|can i|please)\s+(to\s+)?(book|reserve|schedule)\b/i,
    /\b(book|booking|reserve|reservation|appointment|slot)\s+(a\s+)?(table|room|slot|appointment|service|seat|visit)\b/i,
    /\b(booking|appointment|reservation)\s+(chahiye|karni hai|karna hai|kar do|karo|karna|available)\b/i,
    /\b(book\s+my\s+slot|slot\s+booking|take\s+an\s+appointment)\b/i,
    /\b(i\s+want\s+an\s+appointment|book\s+a\s+time|schedule\s+a\s+meeting)\b/i,
    /^(booking|book|appointment)$/i,
  ];

  return bookingPatterns.some((pattern) => pattern.test(lower));
}

/**
 * Handles the step-by-step Booking Flow state machine:
 * Name -> Phone -> Date & Time -> PayU Payment Link
 */
export async function processBookingFlow(
  db: SupabaseClient,
  accountId: string,
  conversationId: string,
  contactId: string,
  customerMessage: string,
  configOwnerUserId: string
): Promise<BookingState> {
  // Fetch conversation to check existing booking state
  const { data: conv } = await db
    .from('conversations')
    .select('id, current_booking_id, booking_step')
    .eq('id', conversationId)
    .single();

  let bookingId = conv?.current_booking_id;
  let currentStep = conv?.booking_step;

  // 1. If not currently in a booking flow, check if message is a booking intent
  if (!bookingId || !currentStep) {
    if (!isBookingIntent(customerMessage)) {
      return { isBookingFlow: false };
    }

    // Start new booking
    const { data: newBooking, error: createErr } = await db
      .from('bookings')
      .insert({
        account_id: accountId,
        contact_id: contactId,
        conversation_id: conversationId,
        status: 'pending_details',
        advance_amount: 1.0,
      })
      .select('id')
      .single();

    if (createErr || !newBooking) {
      console.error('[booking] Failed to create booking record:', createErr);
      return { isBookingFlow: false };
    }

    bookingId = newBooking.id;
    currentStep = 'name';

    // Update conversation with active booking step
    await db
      .from('conversations')
      .update({ current_booking_id: bookingId, booking_step: 'name' })
      .eq('id', conversationId);

    return {
      isBookingFlow: true,
      step: 'name',
      bookingId,
      replyText:
        'Sure, I would be happy to help you with your booking! 📅\n\nTo get started, please tell me your **Full Name**:',
    };
  }

  // 2. State Machine Steps
  if (currentStep === 'name') {
    const customerName = customerMessage.trim();

    await db
      .from('bookings')
      .update({ customer_name: customerName })
      .eq('id', bookingId);

    await db
      .from('conversations')
      .update({ booking_step: 'phone' })
      .eq('id', conversationId);

    return {
      isBookingFlow: true,
      step: 'phone',
      bookingId,
      replyText: `Thank you, ${customerName}! 😊\n\nPlease enter your **10-digit Mobile Phone Number** for booking updates:`,
    };
  }

  if (currentStep === 'phone') {
    const customerPhone = customerMessage.trim();

    await db
      .from('bookings')
      .update({ customer_phone: customerPhone })
      .eq('id', bookingId);

    await db
      .from('conversations')
      .update({ booking_step: 'datetime' })
      .eq('id', conversationId);

    return {
      isBookingFlow: true,
      step: 'datetime',
      bookingId,
      replyText:
        'Great! Now please share your preferred **Date and Time** for the booking (e.g. *Tomorrow at 4:00 PM* or *29th Aug, 11:30 AM*):',
    };
  }

  if (currentStep === 'datetime') {
    const dateTimeText = customerMessage.trim();

    // Fetch booking details so far
    const { data: booking } = await db
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      return { isBookingFlow: false };
    }

    // Unique Transaction / Order ID per attempt
    const txnid = `BK_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(-4)}`;
    const advanceAmount = Number(booking.advance_amount || 1);

    let paymentLink = '';
    try {
      // Create PayU Payment Details & Hosted Checkout Link
      const payuOrder = createPayUPaymentDetails({
        txnid,
        amount: advanceAmount,
        productinfo: 'Advance Booking Fee',
        firstname: booking.customer_name || 'Customer',
        phone: booking.customer_phone || '9876543210',
        email: 'customer@gmail.com',
      });
      paymentLink = payuOrder.paymentLink;
    } catch (err: any) {
      console.error('[booking] PayU payment link generation failed:', err);
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      paymentLink = `${siteUrl}/payu-checkout?txnid=${txnid}&amount=${advanceAmount}`;
    }

    // Update booking with payment info & txnid
    await db
      .from('bookings')
      .update({
        booking_date: dateTimeText,
        booking_time: dateTimeText,
        cashfree_order_id: txnid,
        payment_link: paymentLink,
        status: 'pending_payment',
      })
      .eq('id', bookingId);

    await db
      .from('conversations')
      .update({ booking_step: 'payment' })
      .eq('id', conversationId);

    const replyText =
      `Awesome! Here are your booking details:\n\n` +
      `👤 **Name:** ${booking.customer_name}\n` +
      `📞 **Phone:** ${booking.customer_phone}\n` +
      `📅 **Slot:** ${dateTimeText}\n` +
      `💳 **Advance Fee:** ₹${advanceAmount}\n\n` +
      `To confirm and complete your booking, please pay the advance amount using the PayU Payment Link below:\n` +
      `👉 ${paymentLink}\n\n` +
      `Once payment is complete, your booking will be confirmed automatically! 🎉`;

    return {
      isBookingFlow: true,
      step: 'payment',
      bookingId,
      replyText,
      paymentLink,
    };
  }

  // If already at payment step and customer sends message before paying
  if (currentStep === 'payment') {
    const { data: booking } = await db
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (booking?.status === 'confirmed') {
      // Reset booking flow on conversation
      await db
        .from('conversations')
        .update({ current_booking_id: null, booking_step: null })
        .eq('id', conversationId);
      return { isBookingFlow: false };
    }

    let paymentLink = booking?.payment_link || '';

    // If existing paymentLink is missing, broken, or contains old Cashfree link, regenerate with PayU
    if (!paymentLink || paymentLink.includes('cashfree') || paymentLink.includes('order/#')) {
      const txnid = `BK_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(-4)}`;
      try {
        const payuOrder = createPayUPaymentDetails({
          txnid,
          amount: Number(booking?.advance_amount || 1),
          productinfo: 'Advance Booking Fee',
          firstname: booking?.customer_name || 'Customer',
          phone: booking?.customer_phone || '9876543210',
          email: 'customer@gmail.com',
        });
        paymentLink = payuOrder.paymentLink;
        await db
          .from('bookings')
          .update({ cashfree_order_id: txnid, payment_link: paymentLink })
          .eq('id', bookingId);
      } catch (err) {
        console.error('[booking] Failed to regenerate PayU payment link:', err);
      }
    }

    return {
      isBookingFlow: true,
      step: 'payment',
      bookingId,
      replyText:
        `Your booking is pending advance payment (₹${booking?.advance_amount || 1}).\n\n` +
        `Please complete payment via PayU to finalize your slot:\n👉 ${paymentLink}`,
    };
  }

  return { isBookingFlow: false };
}
