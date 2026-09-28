import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AiConfig } from './types'

// Shared, hoisted mock state so the module mocks can close over it.
const h = vi.hoisted(() => ({
  loadAiConfig: vi.fn(),
  buildConversationContext: vi.fn(),
  retrieveKnowledge: vi.fn(),
  generateReply: vi.fn(),
  engineSendText: vi.fn(),
  engineSendInteractiveButtons: vi.fn(),
  engineSendInteractiveList: vi.fn(),
  engineSendCtaUrl: vi.fn(),
  state: {
    conv: null as Record<string, unknown> | null,
    autoResponders: [] as { id: string }[],
    claim: true as boolean,
    updatePayload: null as Record<string, unknown> | null,
    rpcCalls: [] as { name: string; args: unknown }[],
    sentTodayCount: 0,
    customerMsgCount: 0,
    messageText: 'hi',
    welcomeMenuAutomation: null as Record<string, unknown> | null,
  },
}))

vi.mock('./config', () => ({ loadAiConfig: h.loadAiConfig }))
vi.mock('./context', () => ({ buildConversationContext: h.buildConversationContext }))
vi.mock('./knowledge', () => ({ retrieveKnowledge: h.retrieveKnowledge }))
vi.mock('./generate', () => ({ generateReply: h.generateReply }))
vi.mock('@/lib/flows/meta-send', () => ({
  engineSendText: h.engineSendText,
  engineSendInteractiveButtons: h.engineSendInteractiveButtons,
  engineSendInteractiveList: h.engineSendInteractiveList,
  engineSendCtaUrl: h.engineSendCtaUrl,
}))
vi.mock('./admin-client', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'automations') {
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          limit: () =>
            Promise.resolve({ data: h.state.autoResponders, error: null }),
          maybeSingle: () =>
            Promise.resolve({ data: h.state.welcomeMenuAutomation ?? null, error: null }),
        }
        return chain
      }
      if (table === 'messages') {
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          order: () => chain,
          limit: () => chain,
          gte: () =>
            Promise.resolve({ count: h.state.sentTodayCount, error: null }),
          single: () =>
            Promise.resolve({
              data: {
                id: 'msg-1',
                content_text: h.state.messageText ?? 'hi',
                message_id: 'wamid-1',
              },
              error: null,
            }),
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: 'msg-1',
                content_text: h.state.messageText ?? 'hi',
                message_id: 'wamid-1',
              },
              error: null,
            }),
          then: (resolve: any) =>
            resolve({
              count: h.state.customerMsgCount ?? 0,
              data: [],
              error: null,
            }),
        }
        return chain
      }
      if (table === 'contacts') {
        const chain = {
          select: () => chain,
          eq: () => chain,
          single: () =>
            Promise.resolve({ data: { id: 'contact-1', phone: '+123456' }, error: null }),
        }
        return chain
      }
      if (table === 'conversations') {
        const chain = {
          select: () => chain,
          eq: () => chain,
          single: () =>
            Promise.resolve({ data: h.state.conv, error: null }),
          update: (payload: Record<string, unknown>) => {
            h.state.updatePayload = payload
            return { eq: () => Promise.resolve({ error: null }) }
          },
        }
        return chain
      }
      // fallback
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        insert: () => chain,
        upsert: () => chain,
        delete: () => chain,
        update: (payload: Record<string, unknown>) => {
          h.state.updatePayload = payload
          return chain
        },
        single: () =>
          Promise.resolve({ data: h.state.conv, error: null }),
        maybeSingle: () =>
          Promise.resolve({ data: h.state.conv, error: null }),
        then: (resolve: any) =>
          resolve({ data: [], error: null }),
      }
      return chain
    },
    rpc: (name: string, args: unknown) => {
      if (name === 'claim_ai_reply_slot') {
        h.state.rpcCalls.push({ name, args })
        return Promise.resolve({ data: h.state.claim, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    },
  }),
}))

import { dispatchInboundToAiReply } from './auto-reply'

const ARGS = {
  accountId: 'acct-1',
  conversationId: 'conv-1',
  contactId: 'contact-1',
  configOwnerUserId: 'user-1',
  incomingMessageId: 'msg-1',
}

function aiConfig(overrides: Partial<AiConfig> = {}): AiConfig {
  return {
    provider: 'openai',
    model: 'gpt-test',
    apiKey: 'sk-test',
    systemPrompt: null,
    isActive: true,
    autoReplyEnabled: true,
    autoReplyMaxPerConversation: 3,
    dailyMessageLimit: 50,
    embeddingsApiKey: null,
    ...overrides,
  }
}

beforeEach(() => {
  h.state.conv = {
    id: 'conv-1',
    assigned_agent_id: null,
    ai_autoreply_disabled: false,
    ai_reply_count: 0,
    status: 'open',
    last_message_at: new Date().toISOString(),
  }
  h.state.autoResponders = []
  h.state.claim = true
  h.state.updatePayload = null
  h.state.rpcCalls = []
  h.state.sentTodayCount = 0
  h.state.customerMsgCount = 0
  h.state.messageText = 'hi'
  h.state.welcomeMenuAutomation = null
  h.loadAiConfig.mockResolvedValue(aiConfig())
  h.buildConversationContext.mockResolvedValue([{ role: 'user', content: 'hi' }])
  h.retrieveKnowledge.mockResolvedValue([])
  h.generateReply.mockResolvedValue({ text: 'Hello!', handoff: false })
  h.engineSendText.mockResolvedValue({ whatsapp_message_id: 'm1' })
})

describe('dispatchInboundToAiReply — eligibility gates', () => {
  it('claims a slot and sends on the happy path', async () => {
    await dispatchInboundToAiReply(ARGS)
    expect(h.state.rpcCalls).toEqual([
      {
        name: 'claim_ai_reply_slot',
        args: { conversation_id: 'conv-1', max_replies: 3 },
      },
    ])
    expect(h.engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-1', text: 'Hello!' }),
    )
  })

  it('grounds the reply in retrieved knowledge', async () => {
    h.retrieveKnowledge.mockResolvedValue(['Returns accepted within 30 days.'])
    await dispatchInboundToAiReply(ARGS)
    expect(h.retrieveKnowledge).toHaveBeenCalled()
    const systemPrompt = h.generateReply.mock.calls[0][0].systemPrompt as string
    expect(systemPrompt).toContain('Returns accepted within 30 days.')
  })

  it('stands down when an active message-level automation exists', async () => {
    h.state.autoResponders = [{ id: 'auto-1' }]
    await dispatchInboundToAiReply(ARGS)
    expect(h.generateReply).not.toHaveBeenCalled()
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('does not send when the atomic slot claim loses the race', async () => {
    h.state.claim = false
    await dispatchInboundToAiReply(ARGS)
    // It still attempts the claim, but the send is skipped.
    expect(h.state.rpcCalls).toHaveLength(1)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when AI is off / not configured', async () => {
    h.loadAiConfig.mockResolvedValue(null)
    await dispatchInboundToAiReply(ARGS)
    expect(h.generateReply).not.toHaveBeenCalled()
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when auto-reply is disabled for the account', async () => {
    h.loadAiConfig.mockResolvedValue(aiConfig({ autoReplyEnabled: false }))
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when a human agent is assigned', async () => {
    h.state.conv = {
      assigned_agent_id: 'agent-9',
      ai_autoreply_disabled: false,
      ai_reply_count: 0,
    }
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when auto-reply was disabled on this conversation', async () => {
    h.state.conv = {
      assigned_agent_id: 'agent-1',
      ai_autoreply_disabled: true,
      ai_reply_count: 0,
    }
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when the per-conversation cap is reached', async () => {
    h.state.conv = {
      assigned_agent_id: null,
      ai_autoreply_disabled: false,
      ai_reply_count: 3,
    }
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when there is nothing to reply to', async () => {
    h.buildConversationContext.mockResolvedValue([])
    await dispatchInboundToAiReply(ARGS)
    expect(h.generateReply).not.toHaveBeenCalled()
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when the daily messaging limit is reached', async () => {
    h.state.sentTodayCount = 50
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })
})

describe('dispatchInboundToAiReply — handoff', () => {
  it('disables auto-reply and does not send on handoff', async () => {
    h.generateReply.mockResolvedValue({ text: '', handoff: true })
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
    expect(h.state.updatePayload).toEqual({ ai_autoreply_disabled: true })
    expect(h.state.rpcCalls).toHaveLength(0)
  })
})

describe('dispatchInboundToAiReply — existing contacts', () => {
  it('sends an AI auto-reply to an existing contact with previous history and an old closed conversation', async () => {
    h.state.conv = {
      id: 'conv-1',
      assigned_agent_id: null,
      ai_autoreply_disabled: false,
      ai_reply_count: 0,
      status: 'open',
      last_message_at: new Date().toISOString(),
    }
    h.state.sentTodayCount = 10
    h.buildConversationContext.mockResolvedValue([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'are you open today?' },
    ])

    await dispatchInboundToAiReply(ARGS)

    expect(h.generateReply).toHaveBeenCalled()
    expect(h.state.rpcCalls).toContainEqual({
      name: 'claim_ai_reply_slot',
      args: {
        conversation_id: 'conv-1',
        max_replies: 3,
      },
    })
    expect(h.engineSendText).toHaveBeenCalledWith({
      accountId: 'acct-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      contactId: 'contact-1',
      text: 'Hello!',
      isAiReply: true,
    })
  })
})

describe('dispatchInboundToAiReply — buddiesproduction qualification flow', () => {
  const BUDDIES_ARGS = {
    accountId: '468be0e7-bcd6-463a-a974-d1569dbcfd36',
    conversationId: 'conv-1',
    contactId: 'contact-1',
    configOwnerUserId: 'user-buddies',
    incomingMessageId: 'msg-1',
  }

  it('sends 3 interactive qualification buttons on initial greeting', async () => {
    await dispatchInboundToAiReply(BUDDIES_ARGS)
    expect(h.engineSendInteractiveButtons).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: '468be0e7-bcd6-463a-a974-d1569dbcfd36',
        headerText: 'Buddies Production',
        buttons: [
          { id: 'buddies_intent_rental', title: 'Rental Booking' },
          { id: 'buddies_intent_inquiry', title: 'General Inquiry' },
          { id: 'buddies_intent_team', title: 'Talk to Team' },
        ],
      })
    )
  })

  it('never disables AI or triggers silent handoff on general inquiry, sends AI response instead', async () => {
    h.state.customerMsgCount = 3
    h.state.messageText = 'What are your studio timings and address?'
    h.generateReply.mockResolvedValue({ text: '', handoff: true })
    h.state.sentTodayCount = 2
    h.buildConversationContext.mockResolvedValue([
      { role: 'user', content: 'What are your studio timings and address?' },
    ])
    await dispatchInboundToAiReply({
      ...BUDDIES_ARGS,
      incomingMessageId: 'msg-inquiry',
    })
    // Must NOT disable AI
    expect(h.state.updatePayload).not.toEqual({ ai_autoreply_disabled: true })
    // Must send an AI response directly to the customer
    expect(h.engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: '468be0e7-bcd6-463a-a974-d1569dbcfd36',
        isAiReply: true,
      })
    )
  })

  it('provides casting and acting instructions in system prompt for buddies production', async () => {
    h.state.customerMsgCount = 3
    h.state.messageText = 'Mujhe acting karni hai aapki upcoming short film me'
    h.generateReply.mockResolvedValue({
      text: 'Namaste! Bilkul, kripya apna Name, Age, City, 2-3 recent photos aur Instagram profile link share kar dijiye. Hum aapka data casting database me save kar lenge.',
      handoff: false,
    })
    h.buildConversationContext.mockResolvedValue([
      { role: 'user', content: 'Mujhe acting karni hai aapki upcoming short film me' },
    ])
    await dispatchInboundToAiReply({
      ...BUDDIES_ARGS,
      incomingMessageId: 'msg-acting',
    })
    expect(h.generateReply).toHaveBeenCalled()
    const promptArg = h.generateReply.mock.calls[0][0].systemPrompt as string
    expect(promptArg).toContain('Acting / Casting / Short Film')
    expect(promptArg).toContain('Social media profile')
    expect(h.engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: '468be0e7-bcd6-463a-a974-d1569dbcfd36',
        text: expect.stringContaining('casting database'),
      })
    )
  })

  it('sends custom interactive buttons for any account when configured in automations', async () => {
    h.state.welcomeMenuAutomation = {
      id: 'auto-custom',
      is_active: true,
      trigger_config: {
        header_text: 'City Health Clinic',
        body_text: 'Welcome! How can we help you?',
        footer_text: 'Select an option',
        buttons: [
          { id: 'clinic_btn_1', title: 'Book Appointment', action: 'booking' },
          { id: 'clinic_btn_2', title: 'Consult Doctor', action: 'ai_inquiry' },
          { id: 'clinic_btn_3', title: 'Talk to Reception', action: 'talk_to_team' },
        ],
      },
    }

    await dispatchInboundToAiReply(ARGS) // generic account acct-1

    expect(h.engineSendInteractiveButtons).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acct-1',
        headerText: 'City Health Clinic',
        bodyText: 'Welcome! How can we help you?',
        buttons: [
          { id: 'clinic_btn_1', title: 'Book Appointment' },
          { id: 'clinic_btn_2', title: 'Consult Doctor' },
          { id: 'clinic_btn_3', title: 'Talk to Reception' },
        ],
      })
    )
  })

  it('assigns conversation to specific agent when talk_to_team button with assigned_agent_id is clicked', async () => {
    h.state.welcomeMenuAutomation = {
      id: 'auto-custom',
      is_active: true,
      trigger_config: {
        header_text: 'Support Desk',
        body_text: 'Choose an option',
        buttons: [
          {
            id: 'btn_support_sarah',
            title: 'Talk to Support',
            action: 'talk_to_team',
            assigned_agent_id: 'user-sarah-123',
            reply_text: 'Connecting you with Sarah from our team.',
          },
        ],
      },
    }

    // Customer clicks or replies with the button
    h.state.messageText = 'Talk to Support'
    await dispatchInboundToAiReply({
      ...ARGS,
      incomingMessageId: 'msg-team',
    })

    expect(h.engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        text: 'Connecting you with Sarah from our team.',
      })
    )
    expect(h.state.updatePayload).toEqual({
      ai_autoreply_disabled: true,
      status: 'open',
      assigned_agent_id: 'user-sarah-123',
    })
  })
})




