import { SupabaseClient } from '@supabase/supabase-js';
import { createPayUPaymentDetails } from '@/lib/payments/payu';

export interface BookingState {
  isBookingFlow: boolean;
  step?: 'name' | 'phone' | 'datetime' | 'payment';
  bookingId?: string;
  replyText?: string;
  paymentLink?: string;
  slotSections?: any[];
}

function generateDateSlotSections(configuredSlots?: string[]) {
  const slotsToUse =
    configuredSlots && configuredSlots.length > 0
      ? configuredSlots
      : ['Today 4:00 PM', 'Tomorrow 11:00 AM', 'Tomorrow 4:00 PM', 'Day After 11:00 AM', 'Day After 4:00 PM'];

  const rows = slotsToUse.slice(0, 10).map((slotText, idx) => {
    const cleanTitle = slotText.slice(0, 24);
    return {
      id: `slot_${idx + 1}`,
      title: cleanTitle,
      description: 'Available Time Slot',
    };
  });

  return [
    {
      title: 'Available Slots',
      rows,
    },
  ];
}

/**
 * Detects if the incoming message expresses an explicit booking / appointment reservation intent.
 * Ignores casual mentions of the word 'book'.
 */
export function isBookingIntent(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  const lower = text.toLowerCase().trim();

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
 * Name -> Phone -> Date & Time (Interactive List) -> PayU Payment Link
 */
export async function processBookingFlow(
  db: SupabaseClient,
  accountId: string,
  conversationId: string,
  contactId: string,
  customerMessage: string,
  configOwnerUserId: string
): Promise<BookingState> {
  const { data: conv } = await db
    .from('conversations')
    .select('id, current_booking_id, booking_step')
    .eq('id', conversationId)
    .single();

  let bookingId = conv?.current_booking_id;
  let currentStep = conv?.booking_step;

  if (!bookingId || !currentStep) {
    if (!isBookingIntent(customerMessage)) {
      return { isBookingFlow: false };
    }

    const { data: acc } = await db
      .from('accounts')
      .select('default_booking_advance_amount')
      .eq('id', accountId)
      .maybeSingle();

    const configuredAdvance = Number(acc?.default_booking_advance_amount ?? 500.0);

    const { data: newBooking, error: createErr } = await db
      .from('bookings')
      .insert({
        account_id: accountId,
        contact_id: contactId,
        conversation_id: conversationId,
        status: 'pending_details',
        advance_amount: configuredAdvance,
      })
      .select('id')
      .single();

    if (createErr || !newBooking) {
      console.error('[booking] Failed to create booking record:', createErr);
      return { isBookingFlow: false };
    }

    bookingId = newBooking.id;
    currentStep = 'name';

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

    // Fetch custom time slots for this account
    const { data: acc } = await db
      .from('accounts')
      .select('booking_time_slots')
      .eq('id', accountId)
      .maybeSingle();

    const customSlots = Array.isArray(acc?.booking_time_slots) ? acc.booking_time_slots : undefined;

    return {
      isBookingFlow: true,
      step: 'datetime',
      bookingId,
      replyText: 'Great! Please select your preferred **Date & Time Slot** from the list below:',
      slotSections: generateDateSlotSections(customSlots),
    };
  }

  if (currentStep === 'datetime') {
    let dateTimeText = customerMessage.trim();

    // Fetch custom time slots to map slot_1, slot_2... to exact slot text
    const { data: accConfig } = await db
      .from('accounts')
      .select('payu_merchant_key, payu_merchant_salt, payu_env, booking_time_slots')
      .eq('id', accountId)
      .maybeSingle();

    const customSlots: string[] = Array.isArray(accConfig?.booking_time_slots)
      ? accConfig.booking_time_slots
      : ['Today 4:00 PM', 'Tomorrow 11:00 AM', 'Tomorrow 4:00 PM', 'Day After 11:00 AM', 'Day After 4:00 PM'];

    if (dateTimeText.startsWith('slot_')) {
      const idx = parseInt(dateTimeText.replace('slot_', ''), 10) - 1;
      if (customSlots[idx]) {
        dateTimeText = customSlots[idx];
      }
    }

    const { data: booking } = await db
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      return { isBookingFlow: false };
    }

    const txnid = `BK_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(-4)}`;
    const advanceAmount = Number(booking.advance_amount || 1);

    let paymentLink = '';
    try {
      const payuOrder = createPayUPaymentDetails({
        txnid,
        amount: advanceAmount,
        productinfo: 'Advance Booking Fee',
        firstname: booking.customer_name || 'Customer',
        phone: booking.customer_phone || '9876543210',
        email: 'customer@gmail.com',
        merchantKey: accConfig?.payu_merchant_key || undefined,
        merchantSalt: accConfig?.payu_merchant_salt || undefined,
        payuEnv: accConfig?.payu_env || undefined,
      });
      paymentLink = payuOrder.paymentLink;
    } catch (err: any) {
      console.error('[booking] PayU payment link generation failed:', err);
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      paymentLink = `${siteUrl}/payu-checkout?txnid=${txnid}&amount=${advanceAmount}`;
    }

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
      `To confirm and complete your booking, please pay the advance amount using the PayU Payment Link below:`;

    return {
      isBookingFlow: true,
      step: 'payment',
      bookingId,
      replyText,
      paymentLink,
    };
  }

  if (currentStep === 'payment') {
    const lowerMsg = customerMessage.toLowerCase().trim();

    // Check if the message is explicitly asking for payment/link details
    const isPaymentQuery =
      lowerMsg.includes('pay') ||
      lowerMsg.includes('payment') ||
      lowerMsg.includes('link') ||
      lowerMsg.includes('upi') ||
      lowerMsg.includes('qr') ||
      lowerMsg.includes('gpay') ||
      lowerMsg.includes('phonepe') ||
      lowerMsg.includes('card') ||
      lowerMsg.includes('paise') ||
      lowerMsg.includes('send link') ||
      lowerMsg.includes('dobara send');

    // If customer asks a general question (address, price, services, etc.),
    // allow AI auto-reply to answer naturally without nagging for payment!
    if (!isPaymentQuery) {
      return { isBookingFlow: false };
    }

    const { data: booking } = await db
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (booking?.status === 'confirmed') {
      await db
        .from('conversations')
        .update({ current_booking_id: null, booking_step: null })
        .eq('id', conversationId);
      return { isBookingFlow: false };
    }

    let paymentLink = booking?.payment_link || '';

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
        `Please complete payment via PayU to finalize your slot:`,
      paymentLink,
    };
  }

  return { isBookingFlow: false };
}
