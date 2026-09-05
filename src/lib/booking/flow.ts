import { SupabaseClient } from '@supabase/supabase-js';
import { createPayUPaymentDetails } from '@/lib/payments/payu';

export interface BookingCategory {
  id: string;
  account_id?: string;
  name: string;
  category_type: 'service' | 'rental';
  advance_amount: number;
  keywords: string[];
  description?: string | null;
  time_slots?: string[] | null;
  is_active?: boolean;
}

export interface InteractiveListSection {
  title: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

export interface BookingInteractiveList {
  headerText?: string;
  bodyText: string;
  buttonLabel: string;
  footerText?: string;
  sections: InteractiveListSection[];
}

export interface BookingState {
  isBookingFlow: boolean;
  step?: 'category' | 'rental_product' | 'name' | 'phone' | 'datetime' | 'payment';
  bookingId?: string;
  replyText?: string;
  paymentLink?: string;
  advanceAmount?: number;
  interactiveList?: BookingInteractiveList;
  slotSections?: InteractiveListSection[];
}

export const DEFAULT_BOOKING_CATEGORIES: BookingCategory[] = [
  {
    id: 'default_studio',
    name: 'Studio Booking',
    category_type: 'service',
    advance_amount: 500.0,
    keywords: ['studio', 'studio booking', 'photoshoot', 'video shoot', 'recording', 'stage', 'shoot'],
    description: 'Photo & Video Production Studio Space',
    time_slots: ['10:00 AM - Morning Slot', '02:00 PM - Afternoon Slot', '05:00 PM - Evening Slot', '08:00 PM - Night Slot'],
    is_active: true,
  },
  {
    id: 'default_camera',
    name: 'Camera Booking',
    category_type: 'rental',
    advance_amount: 1000.0,
    keywords: ['camera', 'camera booking', 'camera rental', 'gear', 'lens', 'dslr', 'sony', 'canon', 'equipment'],
    description: 'Professional Camera & DSLR Gear Rental',
    time_slots: ['Full Day (10 AM - 8 PM)', 'Half Day (4 Hours)', '24 Hours Rental', '2 Days Rental', '3+ Days Rental'],
    is_active: true,
  },
  {
    id: 'default_lens_lighting',
    name: 'Lens & Lighting Kit',
    category_type: 'rental',
    advance_amount: 500.0,
    keywords: ['lens', 'lighting', 'light', 'kit', 'accessories', 'tripod', 'flash'],
    description: 'Prime / Zoom Lenses & Continuous Studio Lights',
    time_slots: ['Full Day (10 AM - 8 PM)', 'Half Day (4 Hours)', '24 Hours Rental', '2 Days Rental'],
    is_active: true,
  },
  {
    id: 'default_drone',
    name: 'Drone Rental',
    category_type: 'rental',
    advance_amount: 1500.0,
    keywords: ['drone', 'dji', 'aerial', 'drone booking', 'drone rental'],
    description: '4K Aerial Drone with Controller & Batteries',
    time_slots: ['Full Day (10 AM - 8 PM)', 'Half Day (4 Hours)', '24 Hours Rental'],
    is_active: true,
  },
];

/**
 * Generates interactive WhatsApp slot sections
 */
function generateDateSlotSections(configuredSlots?: string[]): InteractiveListSection[] {
  const slotsToUse =
    configuredSlots && configuredSlots.length > 0
      ? configuredSlots
      : ['Today 4:00 PM', 'Tomorrow 11:00 AM', 'Tomorrow 4:00 PM', 'Day After 11:00 AM', 'Day After 4:00 PM'];

  const rows = slotsToUse.slice(0, 10).map((slotText, idx) => {
    const cleanTitle = slotText.slice(0, 24);
    return {
      id: `slot_${idx + 1}`,
      title: cleanTitle,
      description: 'Select this slot',
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
 * Matches customer message against a specific item/category (not generic "booking" / "rental")
 */
export function findMatchingItem(text: string, categories: BookingCategory[]): BookingCategory | null {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase().trim();

  // If text is purely generic, do not match single item directly
  const isPureGeneric =
    lower === 'booking' ||
    lower === 'book' ||
    lower === 'appointment' ||
    lower === 'slot' ||
    lower === 'reserve' ||
    lower === 'rental' ||
    lower === 'rent' ||
    lower === 'rental booking';

  if (isPureGeneric) return null;

  for (const cat of categories) {
    if (cat.is_active === false) continue;

    // Exact category name match
    const nameLower = cat.name.toLowerCase().trim();
    if (lower.includes(nameLower)) return cat;

    // Keywords match
    if (Array.isArray(cat.keywords)) {
      for (const kw of cat.keywords) {
        const cleanKw = String(kw).toLowerCase().trim();
        if (cleanKw && cleanKw.length > 2 && lower.includes(cleanKw)) {
          // Avoid matching plain "rental" or "booking" as a specific product keyword
          if (cleanKw === 'rental' || cleanKw === 'booking' || cleanKw === 'book' || cleanKw === 'rent') {
            continue;
          }
          return cat;
        }
      }
    }
  }

  return null;
}

/**
 * Matches an item from WhatsApp interactive list click or text selection
 */
export function matchFromListReply(idOrText: string, categories: BookingCategory[]): BookingCategory | null {
  if (!idOrText || typeof idOrText !== 'string') return null;
  const lower = idOrText.toLowerCase().trim();

  // 1. Check direct ID match (e.g. cat_svc_<id>, prod_<id>, or category.id)
  for (const cat of categories) {
    if (
      lower === cat.id.toLowerCase() ||
      lower === `cat_svc_${cat.id}`.toLowerCase() ||
      lower === `prod_${cat.id}`.toLowerCase()
    ) {
      return cat;
    }
  }

  // 2. Check title / name match
  for (const cat of categories) {
    if (lower.includes(cat.name.toLowerCase().trim()) || cat.name.toLowerCase().trim().includes(lower)) {
      return cat;
    }
  }

  // 3. Check numeric index (1, 2, 3...)
  const num = parseInt(lower.replace(/\D/g, ''), 10);
  if (!isNaN(num) && num >= 1 && num <= categories.length) {
    return categories[num - 1];
  }

  // 4. Keyword match
  return findMatchingItem(idOrText, categories);
}

/**
 * Detects if the incoming message expresses a booking intent
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

  // Common quick triggers
  if (
    lower === 'booking' ||
    lower === 'book' ||
    lower === 'appointment' ||
    lower === 'reserve' ||
    lower === 'rental' ||
    lower === 'rent' ||
    lower === 'studio' ||
    lower === 'camera' ||
    lower === 'slot' ||
    lower.includes('booking') ||
    lower.includes('appointment') ||
    lower.includes('slot') ||
    lower.includes('rental')
  ) {
    return true;
  }

  const bookingPatterns = [
    /\b(want|like|need|can i|please)\s+(to\s+)?(book|reserve|schedule|rent)\b/i,
    /\b(book|booking|reserve|reservation|appointment|slot|rent|rental)\s+(a\s+)?(table|room|slot|appointment|service|seat|visit|studio|camera|lens|gear|product|drone|equipment)\b/i,
    /\b(booking|appointment|reservation|rental|rent)\s+(chahiye|karni hai|karna hai|kar do|karo|karna|available)\b/i,
    /\b(book\s+my\s+slot|slot\s+booking|take\s+an\s+appointment|studio\s+booking|camera\s+booking|camera\s+rental)\b/i,
    /\b(i\s+want\s+an\s+appointment|book\s+a\s+time|schedule\s+a\s+meeting)\b/i,
    /^(booking|book|appointment|rent|rental|rental booking|studio booking|camera booking)$/i,
  ];

  return bookingPatterns.some((pattern) => pattern.test(lower));
}

/**
 * Helper to fetch active categories for an account
 */
async function getAccountCategories(db: SupabaseClient, accountId: string): Promise<BookingCategory[]> {
  try {
    const { data, error } = await db
      .from('booking_categories')
      .select('*')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      return data as BookingCategory[];
    }
  } catch (err) {
    console.warn('[booking flow] Warning fetching categories from db:', err);
  }

  return DEFAULT_BOOKING_CATEGORIES;
}

/**
 * Builds the top-level Category Selection Interactive WhatsApp List
 */
function buildCategoryInteractiveList(categories: BookingCategory[]): BookingInteractiveList {
  const services = categories.filter((c) => c.category_type === 'service');
  const rentalProducts = categories.filter((c) => c.category_type === 'rental');

  const rows: Array<{ id: string; title: string; description?: string }> = [];

  // 1. Add individual service categories (e.g. Studio Booking)
  for (const s of services) {
    rows.push({
      id: `cat_svc_${s.id}`,
      title: s.name.slice(0, 24),
      description: `Advance: ₹${Number(s.advance_amount).toFixed(0)} • Service Space`.slice(0, 72),
    });
  }

  // 2. Add Rental Booking option
  if (rentalProducts.length > 0) {
    rows.push({
      id: 'cat_rental_main',
      title: 'Rental Booking',
      description: `${rentalProducts.length} Rental Products Available`.slice(0, 72),
    });
  } else {
    // If no rental products specifically, but some other category
    rows.push({
      id: 'cat_rental_main',
      title: 'Rental Booking',
      description: 'Rental Products Available'.slice(0, 72),
    });
  }

  return {
    headerText: '📅 Booking & Reservations',
    bodyText: 'Welcome! Please select what you would like to book from the menu below:',
    buttonLabel: 'Select Category',
    footerText: 'Choose an option to continue',
    sections: [
      {
        title: 'Booking Categories',
        rows: rows.slice(0, 10),
      },
    ],
  };
}

/**
 * Builds the Rental Products Selection Interactive WhatsApp List
 */
function buildRentalProductsInteractiveList(rentalProducts: BookingCategory[]): BookingInteractiveList {
  const rows = rentalProducts.slice(0, 10).map((prod) => {
    const cleanTitle = prod.name.slice(0, 24);
    const desc = `Advance: ₹${Number(prod.advance_amount).toFixed(0)}${
      prod.description ? ` • ${prod.description}` : ''
    }`.slice(0, 72);

    return {
      id: `prod_${prod.id}`,
      title: cleanTitle,
      description: desc,
    };
  });

  return {
    headerText: '📦 Rental Products',
    bodyText: 'Please select which rental product you would like to book:',
    buttonLabel: 'Select Product',
    footerText: 'Choose an option to continue',
    sections: [
      {
        title: 'Rental Products',
        rows,
      },
    ],
  };
}

/**
 * Handles the multi-category and rental product booking state machine:
 * Top Category List -> Rental Product List (if rental) -> Name -> Phone -> Date & Slot -> PayU Link
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

  const categories = await getAccountCategories(db, accountId);
  const rentalProducts = categories.filter((c) => c.category_type === 'rental');
  const services = categories.filter((c) => c.category_type === 'service');

  const lowerMsg = customerMessage.toLowerCase().trim();

  const isExplicitReset =
    lowerMsg === 'restart' ||
    lowerMsg === 'reset' ||
    lowerMsg === 'cancel' ||
    lowerMsg === 'new booking';

  if (isExplicitReset) {
    bookingId = null;
    currentStep = null;
  } else if (bookingId) {
    // If previous booking was already completed/confirmed/cancelled, start fresh
    const { data: existingBooking } = await db
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .maybeSingle();

    if (existingBooking && ['confirmed', 'completed', 'cancelled'].includes(existingBooking.status)) {
      bookingId = null;
      currentStep = null;
    }
  }

  const directItem = findMatchingItem(customerMessage, categories);

  // STEP 0: NO ACTIVE FLOW -> CHECK INTENT OR DIRECT ITEM MATCH
  if (!bookingId || !currentStep) {
    const hasBookingIntent = isBookingIntent(customerMessage);

    if (!directItem && !hasBookingIntent) {
      return { isBookingFlow: false };
    }

    // 0A. Direct Specific Item Match (e.g. "Studio Booking" or "Camera Booking" directly)
    if (directItem) {
      const advanceAmount = Number(directItem.advance_amount || 500.0);
      const isDefault = directItem.id.startsWith('default_');

      const { data: newBooking, error: createErr } = await db
        .from('bookings')
        .insert({
          account_id: accountId,
          contact_id: contactId,
          conversation_id: conversationId,
          status: 'pending_details',
          advance_amount: advanceAmount,
          service_name: directItem.name,
          category_type: directItem.category_type,
          category_id: isDefault ? null : directItem.id,
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

      const typeBadge = directItem.category_type === 'rental' ? '📦 Rental Product' : '🎙️ Service / Studio';

      return {
        isBookingFlow: true,
        step: 'name',
        bookingId,
        advanceAmount,
        replyText:
          `Great! Let's get your ${directItem.name} booked! 📅\n` +
          `• Type: ${typeBadge}\n` +
          `• Advance Booking Fee: ₹${advanceAmount.toFixed(2)}\n\n` +
          `To get started, please tell me your Full Name:`,
      };
    }

    // 0B. Direct "Rental Booking" query (user specifically asked for rental gear)
    const isExplicitRentalQuery =
      lowerMsg === 'rental' ||
      lowerMsg === 'rent' ||
      lowerMsg === 'rental booking' ||
      lowerMsg.includes('rental product') ||
      lowerMsg.includes('rent par chahiye');

    if (isExplicitRentalQuery && rentalProducts.length > 0) {
      const { data: newBooking, error: createErr } = await db
        .from('bookings')
        .insert({
          account_id: accountId,
          contact_id: contactId,
          conversation_id: conversationId,
          status: 'pending_details',
          category_type: 'rental',
        })
        .select('id')
        .single();

      if (createErr || !newBooking) {
        return { isBookingFlow: false };
      }

      bookingId = newBooking.id;
      currentStep = 'rental_product';

      await db
        .from('conversations')
        .update({ current_booking_id: bookingId, booking_step: 'rental_product' })
        .eq('id', conversationId);

      const interactiveList = buildRentalProductsInteractiveList(rentalProducts);

      return {
        isBookingFlow: true,
        step: 'rental_product',
        bookingId,
        interactiveList,
        replyText:
          `📦 Rental Products Available:\n\n` +
          rentalProducts
            .map((p, i) => `${i + 1}️⃣ ${p.name} (Advance: ₹${Number(p.advance_amount).toFixed(0)})`)
            .join('\n') +
          `\n\nPlease select your rental item from the list button:`,
      };
    }

    // 0C. Generic "Booking" query -> Send Top Category Interactive List
    const { data: newBooking, error: createErr } = await db
      .from('bookings')
      .insert({
        account_id: accountId,
        contact_id: contactId,
        conversation_id: conversationId,
        status: 'pending_details',
      })
      .select('id')
      .single();

    if (createErr || !newBooking) {
      console.error('[booking] Failed to create booking record:', createErr);
      return { isBookingFlow: false };
    }

    bookingId = newBooking.id;
    currentStep = 'category';

    await db
      .from('conversations')
      .update({ current_booking_id: bookingId, booking_step: 'category' })
      .eq('id', conversationId);

    const interactiveList = buildCategoryInteractiveList(categories);

    return {
      isBookingFlow: true,
      step: 'category',
      bookingId,
      interactiveList,
      replyText:
        `Sure, I would be happy to help you with your booking! 📅\n\n` +
        `Please choose what you would like to book:\n` +
        `1️⃣ Studio Booking\n` +
        `2️⃣ Rental Booking (Camera & Gear)\n\n` +
        `Please tap the list button below to choose:`,
    };
  }

  // STEP 1: CATEGORY SELECTION (Studio Booking vs Rental Booking)
  if (currentStep === 'category') {
    const isRentalSelected =
      lowerMsg === 'cat_rental_main' ||
      lowerMsg === 'rental booking' ||
      lowerMsg === 'rental' ||
      lowerMsg === 'rent' ||
      lowerMsg === '2' ||
      lowerMsg.includes('rental');

    // 1A. Customer selected "Rental Booking" -> Show Rental Products List!
    if (isRentalSelected && rentalProducts.length > 0) {
      await db
        .from('conversations')
        .update({ booking_step: 'rental_product' })
        .eq('id', conversationId);

      const interactiveList = buildRentalProductsInteractiveList(rentalProducts);

      return {
        isBookingFlow: true,
        step: 'rental_product',
        bookingId,
        interactiveList,
        replyText:
          `📦 Rental Products Available:\n\n` +
          rentalProducts
            .map((p, i) => `${i + 1}️⃣ ${p.name} (Advance: ₹${Number(p.advance_amount).toFixed(0)})`)
            .join('\n') +
          `\n\nPlease select which product you want to rent from the button list:`,
      };
    }

    // 1B. Customer selected a Service (e.g. Studio Booking)
    const matchedService = matchFromListReply(customerMessage, services);

    if (matchedService) {
      const advanceAmount = Number(matchedService.advance_amount || 500.0);
      const isDefault = matchedService.id.startsWith('default_');

      await db
        .from('bookings')
        .update({
          service_name: matchedService.name,
          category_type: 'service',
          category_id: isDefault ? null : matchedService.id,
          advance_amount: advanceAmount,
        })
        .eq('id', bookingId);

      await db
        .from('conversations')
        .update({ booking_step: 'name' })
        .eq('id', conversationId);

      return {
        isBookingFlow: true,
        step: 'name',
        bookingId,
        advanceAmount,
        replyText:
          `Great! You selected: ${matchedService.name} 🎙️\n` +
          `• Advance Booking Fee: ₹${advanceAmount.toFixed(2)}\n\n` +
          `To get started, please tell me your Full Name:`,
      };
    }

    // 1C. Customer directly clicked/typed a specific rental product while on category step
    const matchedDirectRental = matchFromListReply(customerMessage, rentalProducts);
    if (matchedDirectRental) {
      const advanceAmount = Number(matchedDirectRental.advance_amount || 1000.0);
      const isDefault = matchedDirectRental.id.startsWith('default_');

      await db
        .from('bookings')
        .update({
          service_name: matchedDirectRental.name,
          category_type: 'rental',
          category_id: isDefault ? null : matchedDirectRental.id,
          advance_amount: advanceAmount,
        })
        .eq('id', bookingId);

      await db
        .from('conversations')
        .update({ booking_step: 'name' })
        .eq('id', conversationId);

      return {
        isBookingFlow: true,
        step: 'name',
        bookingId,
        advanceAmount,
        replyText:
          `Selected: ${matchedDirectRental.name} (📦 Rental Product)! 📅\n` +
          `• Advance Booking Fee: ₹${advanceAmount.toFixed(2)}\n\n` +
          `To get started, please tell me your Full Name:`,
      };
    }

    // Invalid category selection -> re-send category list
    const interactiveList = buildCategoryInteractiveList(categories);
    return {
      isBookingFlow: true,
      step: 'category',
      bookingId,
      interactiveList,
      replyText: 'Please select a booking option from the list below:',
    };
  }

  // STEP 2: RENTAL PRODUCT SELECTION (Camera, Lens, Drone, etc.)
  if (currentStep === 'rental_product') {
    const matchedProduct = matchFromListReply(customerMessage, rentalProducts);

    if (matchedProduct) {
      const advanceAmount = Number(matchedProduct.advance_amount || 1000.0);
      const isDefault = matchedProduct.id.startsWith('default_');

      await db
        .from('bookings')
        .update({
          service_name: matchedProduct.name,
          category_type: 'rental',
          category_id: isDefault ? null : matchedProduct.id,
          advance_amount: advanceAmount,
        })
        .eq('id', bookingId);

      await db
        .from('conversations')
        .update({ booking_step: 'name' })
        .eq('id', conversationId);

      return {
        isBookingFlow: true,
        step: 'name',
        bookingId,
        advanceAmount,
        replyText:
          `Selected: ${matchedProduct.name} (📦 Rental Product)! 📅\n` +
          `• Advance Booking Fee: ₹${advanceAmount.toFixed(2)}\n\n` +
          `To get started, please tell me your Full Name:`,
      };
    }

    // Invalid product selection -> re-send rental products list
    const interactiveList = buildRentalProductsInteractiveList(rentalProducts);
    return {
      isBookingFlow: true,
      step: 'rental_product',
      bookingId,
      interactiveList,
      replyText: 'Please select a valid rental product from the list below:',
    };
  }

  // STEP 3: NAME
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
      replyText: `Thank you, ${customerName}! 😊\n\nPlease enter your 10-digit Mobile Phone Number for booking updates:`,
    };
  }

  // STEP 4: PHONE
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

    // Fetch booking to check if category has custom slots
    const { data: currentBooking } = await db
      .from('bookings')
      .select('service_name, category_id, category_type')
      .eq('id', bookingId)
      .maybeSingle();

    let customSlots: string[] | undefined = undefined;

    if (currentBooking?.category_id) {
      const { data: catRecord } = await db
        .from('booking_categories')
        .select('time_slots')
        .eq('id', currentBooking.category_id)
        .maybeSingle();

      if (Array.isArray(catRecord?.time_slots) && catRecord.time_slots.length > 0) {
        customSlots = catRecord.time_slots;
      }
    }

    if (!customSlots) {
      const { data: acc } = await db
        .from('accounts')
        .select('booking_time_slots')
        .eq('id', accountId)
        .maybeSingle();

      if (Array.isArray(acc?.booking_time_slots) && acc.booking_time_slots.length > 0) {
        customSlots = acc.booking_time_slots;
      }
    }

    const isRental = currentBooking?.category_type === 'rental';
    const slotPrompt = isRental
      ? 'Great! Please select your preferred Rental Duration / Slot from the list below:'
      : 'Great! Please select your preferred Date & Time Slot from the list below:';

    return {
      isBookingFlow: true,
      step: 'datetime',
      bookingId,
      replyText: slotPrompt,
      slotSections: generateDateSlotSections(customSlots),
    };
  }

  // STEP 5: DATETIME & PAYMENT LINK GENERATION
  if (currentStep === 'datetime') {
    let dateTimeText = customerMessage.trim();

    const { data: booking } = await db
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      return { isBookingFlow: false };
    }

    const { data: accConfig } = await db
      .from('accounts')
      .select('payu_merchant_key, payu_merchant_salt, payu_env, booking_time_slots')
      .eq('id', accountId)
      .maybeSingle();

    let customSlots: string[] = Array.isArray(accConfig?.booking_time_slots)
      ? accConfig.booking_time_slots
      : ['Today 4:00 PM', 'Tomorrow 11:00 AM', 'Tomorrow 4:00 PM', 'Day After 11:00 AM', 'Day After 4:00 PM'];

    if (booking.category_id) {
      const { data: catRecord } = await db
        .from('booking_categories')
        .select('time_slots')
        .eq('id', booking.category_id)
        .maybeSingle();

      if (Array.isArray(catRecord?.time_slots) && catRecord.time_slots.length > 0) {
        customSlots = catRecord.time_slots;
      }
    }

    if (dateTimeText.startsWith('slot_')) {
      const idx = parseInt(dateTimeText.replace('slot_', ''), 10) - 1;
      if (customSlots[idx]) {
        dateTimeText = customSlots[idx];
      }
    }

    const txnid = `BK_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(-4)}`;
    const advanceAmount = Number(booking.advance_amount || 500.0);
    const serviceName = booking.service_name || 'Booking';

    let paymentLink = '';
    try {
      const payuOrder = createPayUPaymentDetails({
        txnid,
        amount: advanceAmount,
        productinfo: `${serviceName} Advance Fee`,
        firstname: booking.customer_name || 'Customer',
        phone: booking.customer_phone || '9876543210',
        email: 'customer@gmail.com',
        merchantKey: accConfig?.payu_merchant_key || undefined,
        merchantSalt: accConfig?.payu_merchant_salt || undefined,
        payuEnv: accConfig?.payu_env || undefined,
        accountId,
      });
      paymentLink = payuOrder.paymentLink;
    } catch (err: any) {
      console.error('[booking] PayU payment link generation failed:', err);
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      paymentLink = `${siteUrl}/payu-checkout?txnid=${txnid}&amount=${advanceAmount}&account_id=${accountId}`;
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
      `📦 Item / Service: ${serviceName}\n` +
      `👤 Name: ${booking.customer_name}\n` +
      `📞 Phone: ${booking.customer_phone}\n` +
      `📅 Slot / Duration: ${dateTimeText}\n` +
      `💳 Advance Fee: ₹${advanceAmount.toFixed(2)}\n\n` +
      `To confirm and secure your booking, please pay the advance amount using the PayU Payment Link below:`;

    return {
      isBookingFlow: true,
      step: 'payment',
      bookingId,
      advanceAmount,
      replyText,
      paymentLink,
    };
  }

  // STEP 6: PAYMENT REMINDER / QUERY
  if (currentStep === 'payment') {
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
    const advanceAmount = Number(booking?.advance_amount || 500.0);
    const serviceName = booking?.service_name || 'Booking';

    if (!paymentLink || paymentLink.includes('cashfree') || paymentLink.includes('order/#')) {
      const txnid = `BK_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(-4)}`;
      try {
        const payuOrder = createPayUPaymentDetails({
          txnid,
          amount: advanceAmount,
          productinfo: `${serviceName} Advance Fee`,
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
      advanceAmount,
      replyText:
        `Your booking for ${serviceName} is pending advance payment of ₹${advanceAmount.toFixed(2)}.\n\n` +
        `Please complete payment via PayU to confirm:`,
      paymentLink,
    };
  }

  return { isBookingFlow: false };
}
