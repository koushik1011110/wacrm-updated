import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/ai/admin-client';

export interface BookingCategory {
  id: string;
  account_id: string;
  name: string;
  category_type: 'service' | 'rental';
  advance_amount: number;
  keywords: string[];
  description?: string;
  time_slots?: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/bookings/categories
 * Returns all booking categories / rental products for the authenticated user's workspace account.
 */
export async function GET() {
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

    const { data: categories, error } = await db
      .from('booking_categories')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[booking categories] Error fetching categories, returning empty list:', error.message);
      return NextResponse.json({ categories: [] });
    }

    return NextResponse.json({ categories: categories || [] });
  } catch (err: any) {
    console.error('[booking categories] Unexpected GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * POST /api/bookings/categories
 * Creates a new booking category or rental product.
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

    const accountId = profile.account_id;
    const db = supabaseAdmin();
    const body = await request.json().catch(() => ({}));

    const {
      name,
      category_type = 'service',
      advance_amount = 500,
      keywords = [],
      description = '',
      time_slots = null,
      is_active = true,
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Category / Product name is required' }, { status: 400 });
    }

    const cleanKeywords = Array.isArray(keywords)
      ? keywords.map((k: string) => String(k).trim().toLowerCase()).filter(Boolean)
      : typeof keywords === 'string'
      ? keywords
          .split(',')
          .map((k: string) => k.trim().toLowerCase())
          .filter(Boolean)
      : [];

    const numAdvance = parseFloat(String(advance_amount));
    if (isNaN(numAdvance) || numAdvance < 0) {
      return NextResponse.json({ error: 'Valid advance amount is required' }, { status: 400 });
    }

    const { data: created, error } = await db
      .from('booking_categories')
      .insert({
        account_id: accountId,
        name: name.trim(),
        category_type: category_type === 'rental' ? 'rental' : 'service',
        advance_amount: numAdvance,
        keywords: cleanKeywords,
        description: description ? description.trim() : null,
        time_slots: Array.isArray(time_slots) ? time_slots : null,
        is_active: Boolean(is_active),
      })
      .select()
      .single();

    if (error) {
      console.error('[booking categories] Error inserting category:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, category: created }, { status: 201 });
  } catch (err: any) {
    console.error('[booking categories] Unexpected POST error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * PATCH /api/bookings/categories
 * Updates an existing category by ID.
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

    const { id, name, category_type, advance_amount, keywords, description, time_slots, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updatePayload.name = String(name).trim();
    if (category_type !== undefined)
      updatePayload.category_type = category_type === 'rental' ? 'rental' : 'service';
    if (advance_amount !== undefined) {
      const num = parseFloat(String(advance_amount));
      if (!isNaN(num) && num >= 0) updatePayload.advance_amount = num;
    }
    if (keywords !== undefined) {
      updatePayload.keywords = Array.isArray(keywords)
        ? keywords.map((k: string) => String(k).trim().toLowerCase()).filter(Boolean)
        : typeof keywords === 'string'
        ? keywords
            .split(',')
            .map((k: string) => k.trim().toLowerCase())
            .filter(Boolean)
        : [];
    }
    if (description !== undefined) updatePayload.description = description ? String(description).trim() : null;
    if (time_slots !== undefined) {
      updatePayload.time_slots = Array.isArray(time_slots) ? time_slots : null;
    }
    if (is_active !== undefined) updatePayload.is_active = Boolean(is_active);

    const { data: updated, error } = await db
      .from('booking_categories')
      .update(updatePayload)
      .eq('id', id)
      .eq('account_id', accountId)
      .select()
      .single();

    if (error) {
      console.error('[booking categories] Error updating category:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, category: updated });
  } catch (err: any) {
    console.error('[booking categories] Unexpected PATCH error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * DELETE /api/bookings/categories
 * Deletes a category by ID.
 */
export async function DELETE(request: Request) {
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
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const { error } = await db
      .from('booking_categories')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) {
      console.error('[booking categories] Error deleting category:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[booking categories] Unexpected DELETE error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
