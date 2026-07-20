import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { encrypt } from '@/lib/whatsapp/encryption'
import { verifyPhoneNumber, subscribeWabaToApp } from '@/lib/whatsapp/meta-api'

let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.account_id) return null
  return data.account_id as string
}

async function logOnboarding(
  accountId: string,
  userId: string | null,
  stage: string,
  status: 'success' | 'failure' | 'info',
  metaErrorCode: number | null,
  errorMessage: string | null,
  wabaId: string | null,
  phoneNumberId: string | null
) {
  try {
    const admin = supabaseAdmin()
    await admin.from('whatsapp_onboarding_logs').insert({
      account_id: accountId,
      user_id: userId,
      stage,
      status,
      meta_error_code: metaErrorCode,
      error_message: errorMessage ? errorMessage.slice(0, 1000) : null,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
    })
  } catch (err) {
    console.error('Failed to write onboarding log:', err)
  }
}

export async function POST(request: Request) {
  let tempAccountId: string | null = null
  let tempUserId: string | null = null
  let tempWabaId: string | null = null
  let tempPhoneId: string | null = null

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    tempUserId = user.id
    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 }
      )
    }
    tempAccountId = accountId

    const body = await request.json()
    const { code, waba_id, phone_number_id } = body
    tempWabaId = waba_id
    tempPhoneId = phone_number_id

    if (!code || !waba_id || !phone_number_id) {
      await logOnboarding(
        accountId,
        user.id,
        'request_received',
        'failure',
        null,
        'Missing code, waba_id, or phone_number_id in request.',
        waba_id || null,
        phone_number_id || null
      )
      return NextResponse.json(
        { error: 'code, waba_id, and phone_number_id are required' },
        { status: 400 }
      )
    }

    await logOnboarding(
      accountId,
      user.id,
      'code_received',
      'info',
      null,
      'Received authorization code from Meta SDK.',
      waba_id,
      phone_number_id
    )

    // 1. Exchange code for access token
    const appId = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET
    const apiVersion = process.env.META_GRAPH_API_VERSION || 'v21.0'

    if (!appId || !appSecret) {
      await logOnboarding(
        accountId,
        user.id,
        'token_exchange',
        'failure',
        null,
        'Meta App ID or Secret is not configured in server environment.',
        waba_id,
        phone_number_id
      )
      return NextResponse.json(
        { error: 'Meta App configuration missing on the server.' },
        { status: 500 }
      )
    }

    const oauthUrl = `https://graph.facebook.com/${apiVersion}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}&redirect_uri=${process.env.META_OAUTH_REDIRECT_URL || ''}`

    let tokenData
    try {
      const oauthRes = await fetch(oauthUrl)
      tokenData = await oauthRes.json()
      if (!oauthRes.ok || !tokenData.access_token) {
        throw new Error(tokenData.error?.message || `OAuth HTTP ${oauthRes.status}`)
      }
    } catch (err: any) {
      console.error('Meta OAuth exchange failed:', err)
      await logOnboarding(
        accountId,
        user.id,
        'token_exchange',
        'failure',
        tokenData?.error?.code || null,
        err.message || 'OAuth exchange failed',
        waba_id,
        phone_number_id
      )
      return NextResponse.json(
        { error: `OAuth exchange failed: ${err.message}` },
        { status: 400 }
      )
    }

    const accessToken = tokenData.access_token
    await logOnboarding(
      accountId,
      user.id,
      'token_exchanged',
      'success',
      null,
      'Exchanged code for access token successfully.',
      waba_id,
      phone_number_id
    )

    // 2. Reject if another account has already claimed this phone_number_id.
    const { data: claimed, error: claimedError } = await supabaseAdmin()
      .from('whatsapp_config')
      .select('account_id')
      .eq('phone_number_id', phone_number_id)
      .neq('account_id', accountId)
      .maybeSingle()

    if (claimedError) {
      console.error('Error checking phone_number_id ownership:', claimedError)
      return NextResponse.json({ error: 'Database check failed' }, { status: 500 })
    }

    if (claimed) {
      await logOnboarding(
        accountId,
        user.id,
        'ownership_validation',
        'failure',
        null,
        'Phone number is already connected to another CRM tenant.',
        waba_id,
        phone_number_id
      )
      return NextResponse.json(
        {
          error:
            'This WhatsApp phone number is already linked to another account on this instance. Each phone number can only be connected to one tenant.',
        },
        { status: 409 }
      )
    }

    // 3. Fetch phone info
    let phoneInfo
    try {
      phoneInfo = await verifyPhoneNumber({
        phoneNumberId: phone_number_id,
        accessToken,
      })
    } catch (err: any) {
      console.error('Phone verification failed:', err)
      await logOnboarding(
        accountId,
        user.id,
        'phone_verification',
        'failure',
        null,
        `Failed to fetch phone number details: ${err.message}`,
        waba_id,
        phone_number_id
      )
      return NextResponse.json(
        { error: `Failed to verify phone number: ${err.message}` },
        { status: 400 }
      )
    }

    // 4. Subscribe the WABA to this app
    try {
      await subscribeWabaToApp({
        wabaId: waba_id,
        accessToken,
      })
      await logOnboarding(
        accountId,
        user.id,
        'webhook_subscribed',
        'success',
        null,
        'Subscribed Meta app to WABA webhooks successfully.',
        waba_id,
        phone_number_id
      )
    } catch (err: any) {
      console.warn('WABA webhook subscription failed (non-fatal):', err.message)
      await logOnboarding(
        accountId,
        user.id,
        'webhook_subscribed',
        'failure',
        null,
        `WABA webhook subscription failed: ${err.message}`,
        waba_id,
        phone_number_id
      )
    }

    // 5. Test permissions by querying WABA templates (proves message permissions)
    let permissionsTested = false
    try {
      const testRes = await fetch(
        `https://graph.facebook.com/${apiVersion}/${waba_id}/message_templates?limit=1`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (testRes.ok) {
        permissionsTested = true
      } else {
        const testErr = await testRes.json()
        console.warn('Permission test warning:', testErr)
      }
    } catch (err) {
      console.warn('Permission test failed:', err)
    }

    // 6. Encrypt token and save
    const encryptedAccessToken = encrypt(accessToken)

    // Check if configuration exists
    const { data: existing } = await supabase
      .from('whatsapp_config')
      .select('id')
      .eq('account_id', accountId)
      .maybeSingle()

    const configRow = {
      phone_number_id,
      waba_id,
      meta_business_id: null, // Meta Business Portfolio ID (set to null, can be updated later if needed)
      display_phone_number: phoneInfo.display_phone_number,
      verified_name: phoneInfo.verified_name || null,
      access_token: encryptedAccessToken,
      token_type: 'bearer',
      token_created_at: new Date().toISOString(),
      graph_api_version: apiVersion,
      connection_method: 'embedded',
      status: 'connected',
      phone_number_status: phoneInfo.status || 'active',
      quality_rating: phoneInfo.quality_rating || null,
      webhook_subscription_status: 'subscribed',
      last_verification_at: new Date().toISOString(),
      last_meta_api_error: null,
      reconnection_required: false,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('whatsapp_config')
        .update(configRow)
        .eq('account_id', accountId)

      if (updateError) {
        throw new Error(`Failed to update config: ${updateError.message}`)
      }
    } else {
      const { error: insertError } = await supabase
        .from('whatsapp_config')
        .insert({
          account_id: accountId,
          user_id: user.id,
          ...configRow,
        })

      if (insertError) {
        throw new Error(`Failed to insert config: ${insertError.message}`)
      }
    }

    await logOnboarding(
      accountId,
      user.id,
      'completed',
      'success',
      null,
      'WhatsApp Embedded Signup onboarding completed successfully.',
      waba_id,
      phone_number_id
    )

    return NextResponse.json({
      success: true,
      phone_info: phoneInfo,
      permissions_tested: permissionsTested,
    })
  } catch (error: any) {
    console.error('Error in WhatsApp config OAuth callback:', error)
    if (tempAccountId) {
      await logOnboarding(
        tempAccountId,
        tempUserId,
        'completed',
        'failure',
        null,
        error.message || 'Internal server error during callback.',
        tempWabaId,
        tempPhoneId
      )
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
