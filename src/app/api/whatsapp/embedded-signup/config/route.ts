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

    return NextResponse.json({
      appId: process.env.META_APP_ID || '',
      configId: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '',
      apiVersion: process.env.META_GRAPH_API_VERSION || 'v21.0',
    })
  } catch (error) {
    console.error('Error in embedded-signup config route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
