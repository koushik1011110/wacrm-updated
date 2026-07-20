import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import { verifyPhoneNumber } from '@/lib/whatsapp/meta-api'

export async function POST() {
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
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const accountId = profile.account_id

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()

    if (configError || !config) {
      return NextResponse.json({ error: 'No WhatsApp configuration found' }, { status: 404 })
    }

    let accessToken: string
    try {
      accessToken = decrypt(config.access_token)
    } catch (err) {
      return NextResponse.json({ error: 'Failed to decrypt access token' }, { status: 400 })
    }

    try {
      const phoneInfo = await verifyPhoneNumber({
        phoneNumberId: config.phone_number_id,
        accessToken,
      })

      const updatedFields = {
        display_phone_number: phoneInfo.display_phone_number,
        verified_name: phoneInfo.verified_name || config.verified_name || null,
        phone_number_status: phoneInfo.status || 'active',
        quality_rating: phoneInfo.quality_rating || null,
        status: 'connected',
        last_verification_at: new Date().toISOString(),
        last_meta_api_error: null,
        updated_at: new Date().toISOString(),
      }

      await supabase
        .from('whatsapp_config')
        .update(updatedFields)
        .eq('account_id', accountId)

      return NextResponse.json({
        success: true,
        phone_info: phoneInfo,
      })
    } catch (err: any) {
      const errMsg = err.message || 'Meta API request failed'
      await supabase
        .from('whatsapp_config')
        .update({
          last_meta_api_error: errMsg,
          last_verification_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('account_id', accountId)

      return NextResponse.json({
        success: false,
        error: errMsg,
      }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Error in WhatsApp connection refresh route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
