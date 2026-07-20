import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || (profile.account_role !== 'owner' && profile.account_role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      META_APP_ID: process.env.META_APP_ID || '',
      META_APP_SECRET_SET: !!process.env.META_APP_SECRET,
      META_EMBEDDED_SIGNUP_CONFIG_ID: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '',
      META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION || 'v21.0',
      META_WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN || '',
      META_OAUTH_REDIRECT_URL: process.env.META_OAUTH_REDIRECT_URL || '',
      META_WEBHOOK_CALLBACK_URL: process.env.META_WEBHOOK_CALLBACK_URL || '',
      META_ALLOWED_DOMAIN: process.env.META_ALLOWED_DOMAIN || '',
      META_BUSINESS_PORTFOLIO_ID: process.env.META_BUSINESS_PORTFOLIO_ID || '',
      META_SOLUTION_ID: process.env.META_SOLUTION_ID || '',
    })
  } catch (error) {
    console.error('Error in superadmin config route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
