import { NextResponse } from 'next/server'
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'

export interface WelcomeMenuButton {
  id: string
  title: string
  action: 'booking' | 'ai_inquiry' | 'talk_to_team' | 'custom_reply'
  reply_text?: string
  assigned_agent_id?: string | null
}

export interface WelcomeMenuConfig {
  enabled: boolean
  header_text: string
  body_text: string
  footer_text: string
  buttons: WelcomeMenuButton[]
}

const DEFAULT_WELCOME_CONFIG: WelcomeMenuConfig = {
  enabled: false,
  header_text: '',
  body_text: 'Namaste! 🙏 Welcome. How can we help you today? Please choose an option below:',
  footer_text: 'Please select an option below',
  buttons: [
    {
      id: 'intent_opt_1',
      title: 'Booking / Services',
      action: 'booking',
      reply_text: '',
    },
    {
      id: 'intent_opt_2',
      title: 'General Inquiry',
      action: 'ai_inquiry',
      reply_text: 'Please let us know your query, how can we help you today?',
    },
    {
      id: 'intent_opt_3',
      title: 'Talk to Team',
      action: 'talk_to_team',
      reply_text: 'Ji bilkul! 🙏 Aapki chat humari support team ko forward kar di gayi hai. Humare team member aapse jald hi direct baat karenge. Dhanyawad!',
    },
  ],
}

/**
 * GET /api/ai/welcome-menu
 * Any member can view the welcome menu configuration.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const { data: row, error } = await supabase
      .from('automations')
      .select('id, is_active, trigger_config')
      .eq('account_id', accountId)
      .eq('trigger_type', 'welcome_intent_menu')
      .maybeSingle()

    if (error) {
      console.error('[welcome-menu GET] error:', error)
      return NextResponse.json({ error: 'Failed to load welcome menu' }, { status: 500 })
    }

    if (!row) {
      return NextResponse.json({
        config: { ...DEFAULT_WELCOME_CONFIG },
      })
    }

    const cfg = (row.trigger_config as any) || {}
    const config: WelcomeMenuConfig = {
      enabled: Boolean(row.is_active),
      header_text: cfg.header_text ?? '',
      body_text: cfg.body_text ?? DEFAULT_WELCOME_CONFIG.body_text,
      footer_text: cfg.footer_text ?? DEFAULT_WELCOME_CONFIG.footer_text,
      buttons: Array.isArray(cfg.buttons) && cfg.buttons.length > 0 ? cfg.buttons : DEFAULT_WELCOME_CONFIG.buttons,
    }

    return NextResponse.json({ config })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/ai/welcome-menu (admin+)
 * Save or update welcome menu configuration.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const enabled = Boolean(body.enabled)
    const header_text = typeof body.header_text === 'string' ? body.header_text.slice(0, 60).trim() : ''
    const body_text = typeof body.body_text === 'string' ? body.body_text.slice(0, 1024).trim() : ''
    const footer_text = typeof body.footer_text === 'string' ? body.footer_text.slice(0, 60).trim() : ''

    const rawButtons = Array.isArray(body.buttons) ? body.buttons.slice(0, 3) : []
    const buttons: WelcomeMenuButton[] = rawButtons.map((b: any, idx: number) => {
      const title = typeof b.title === 'string' ? b.title.slice(0, 20).trim() : `Option ${idx + 1}`
      const action = ['booking', 'ai_inquiry', 'talk_to_team', 'custom_reply'].includes(b.action)
        ? b.action
        : 'ai_inquiry'
      const id = typeof b.id === 'string' && b.id ? b.id : `intent_btn_${idx + 1}`
      const reply_text = typeof b.reply_text === 'string' ? b.reply_text.trim() : ''
      const assigned_agent_id =
        typeof b.assigned_agent_id === 'string' && b.assigned_agent_id.trim()
          ? b.assigned_agent_id.trim()
          : null
      return { id, title, action, reply_text, assigned_agent_id }
    })

    if (enabled && buttons.length === 0) {
      return NextResponse.json({ error: 'At least 1 button is required when welcome menu is enabled' }, { status: 400 })
    }

    const trigger_config = {
      header_text,
      body_text: body_text || DEFAULT_WELCOME_CONFIG.body_text,
      footer_text: footer_text || DEFAULT_WELCOME_CONFIG.footer_text,
      buttons,
    }

    const { data: existing } = await supabase
      .from('automations')
      .select('id')
      .eq('account_id', accountId)
      .eq('trigger_type', 'welcome_intent_menu')
      .maybeSingle()

    if (existing) {
      const { error: updErr } = await supabase
        .from('automations')
        .update({
          is_active: enabled,
          trigger_config,
        })
        .eq('id', existing.id)

      if (updErr) {
        console.error('[welcome-menu POST] update error:', updErr)
        return NextResponse.json({ error: 'Failed to update welcome menu' }, { status: 500 })
      }
    } else {
      const { error: insErr } = await supabase.from('automations').insert({
        account_id: accountId,
        user_id: userId,
        name: 'Welcome Intent Qualification Menu',
        trigger_type: 'welcome_intent_menu',
        is_active: enabled,
        trigger_config,
      })

      if (insErr) {
        console.error('[welcome-menu POST] insert error:', insErr)
        return NextResponse.json({ error: 'Failed to create welcome menu' }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      config: {
        enabled,
        ...trigger_config,
      },
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
