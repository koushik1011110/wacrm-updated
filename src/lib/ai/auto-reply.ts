import { supabaseAdmin } from './admin-client'
import { loadAiConfig } from './config'
import { buildConversationContext } from './context'
import { retrieveKnowledge } from './knowledge'
import { generateReply } from './generate'
import { buildSystemPrompt } from './defaults'
import { latestUserMessage } from './query'
import { engineSendText, engineSendCtaUrl, engineSendInteractiveList, engineSendInteractiveButtons } from '@/lib/flows/meta-send'
import { startOfLocalDay } from '@/lib/dashboard/date-utils'
import { AiConfig } from './types'
import { trackAiTokenUsage } from './token-tracker'
import { processBookingFlow } from '@/lib/booking/flow'

const BUDDIES_PRODUCTION_ACCOUNT_ID = '468be0e7-bcd6-463a-a974-d1569dbcfd36'
const BUDDIES_PRODUCTION_EMAIL = 'buddiesproduction2017@gmail.com'

const BUDDIES_DEFAULT_PROMPT = `You are the official WhatsApp assistant for Buddies Production (buddiesproduction2017@gmail.com).
Buddies Production is an active film & media production house, photography and video production studio, and professional cinema/camera equipment rental service in India.

About Buddies Production:
1. Media & Production House: Short films, movies, songs, music videos, creative shoots, video production, and casting.
2. Equipment Rental & Studio: Camera gear (Sony, Canon, Cinema & DSLR), lenses, lighting setups, 4K drones, and shoot studio rental.

Special Handling for Acting / Casting / Short Film / Role / Song Inquiries:
- Most inquiries come from actors, models, and artists asking about acting roles, auditions, short films, casting, songs, or music video opportunities.
- When someone asks about acting, casting, auditions, short films, working in movies/songs, or collaboration:
  1. Respond like a warm, polite, and helpful human from the Buddies Production team (NOT a robotic AI, avoid long complicated formal essays).
  2. Acknowledge their interest warmly and concisely.
  3. Ask them in simple Hindi/Hinglish (or English, matching their language) to share their details so their profile can be saved for future casting needs & upcoming projects:
     • Name & Age
     • Current City / Location
     • 2-3 Recent Photos (Clear Headshot & Full look)
     • Social media profile / Work link (e.g. Instagram profile link, portfolio, or showreel)
  4. Assure them that their profile will be saved in Buddies Production's casting database, and the team will reach out whenever a suitable role or project comes up.
  5. Keep it natural, human-like, and concise — do NOT drag the conversation into long chatting.

Rules for General Inquiries:
1. Tone: Warm, natural, concise, and human-like. Respond in Hindi, Hinglish, or English matching the customer's language.
2. For Equipment Rental & Studio queries: Prefer Knowledge Base documents if provided to answer accurately regarding camera gear, studio availability, and policies.
3. If specific equipment details are not in the Knowledge Base, DO NOT hand off to a human or remain silent! Answer helpfully with general guidance and politely ask for their required dates or gear.
4. NEVER make up or discuss unrelated topics (such as real estate, godowns, shops, food, etc.).
5. If customer wants to book equipment or studio, invite them to select 'Rental Booking' or type 'Book'.
6. NEVER emit [[HANDOFF]] and NEVER hand off to a human for general inquiries or casting inquiries. Always reply directly as AI.`

async function isBuddiesProductionAccount(db: any, accountId: string): Promise<boolean> {
  if (accountId === BUDDIES_PRODUCTION_ACCOUNT_ID) return true
  try {
    const { data } = await db
      .from('profiles')
      .select('email')
      .eq('account_id', accountId)
      .eq('role', 'owner')
      .maybeSingle()
    return data?.email === BUDDIES_PRODUCTION_EMAIL
  } catch {
    return false
  }
}

interface DispatchArgs {
  /** Tenancy key — drives config, contact, and whatsapp_config lookups. */
  accountId: string
  conversationId: string
  contactId: string
  /** The account's WhatsApp config owner, used for the outbound send's
   *  audit columns (mirrors how the flow runner passes it through). */
  configOwnerUserId: string
  incomingMessageId?: string | null
}

interface EligibilityArgs {
  accountId: string
  contact: { id: string; phone: string }
  conversation: { id: string; assigned_agent_id?: string | null; ai_autoreply_disabled?: boolean; ai_reply_count: number }
  incomingMessage: { id: string; content_text: string | null; message_id: string }
  config: AiConfig
  db: any
}

/**
 * Reusable eligibility function for AI auto-reply logic.
 */
export async function canSendAIAutoReply(
  args: EligibilityArgs,
): Promise<{ allowed: boolean; reason?: string }> {
  const { accountId, contact, conversation, incomingMessage, config, db } = args

  if (!config.autoReplyEnabled) {
    return { allowed: false, reason: 'AI disabled' }
  }

  // 1. Enforce account-wide daily message limit
  const todayStart = startOfLocalDay().toISOString()
  const { count: sentToday, error: countErr } = await db
    .from('messages')
    .select('id, conversations!inner(account_id)', { count: 'exact', head: true })
    .eq('is_ai_reply', true)
    .eq('conversations.account_id', accountId)
    .gte('created_at', todayStart)

  if (countErr) {
    if (countErr.code === 'PGRST204' || (countErr.message && countErr.message.includes('is_ai_reply'))) {
      console.warn('[ai auto-reply] is_ai_reply column not found in database; skipping daily message limit enforcement.')
    } else {
      console.error('[ai auto-reply] failed to query daily message count:', countErr)
    }
  } else {
    console.log(`[ai auto-reply] daily reply count: ${sentToday} / ${config.dailyMessageLimit}`)
    if (sentToday !== null && sentToday >= config.dailyMessageLimit) {
      return { allowed: false, reason: 'daily limit reached' }
    }
  }

  // 2. Deterministic, user-configured responders win over the LLM
  const { data: autoResponders } = await db
    .from('automations')
    .select('id')
    .eq('account_id', accountId)
    .eq('is_active', true)
    .in('trigger_type', ['new_message_received', 'keyword_match'])
    .limit(1)
  if (autoResponders && autoResponders.length > 0) {
    return { allowed: false, reason: 'active deterministic auto-responder found' }
  }

  // 3. Human agent assignment
  if (conversation.assigned_agent_id) {
    return { allowed: false, reason: 'human agent assigned' }
  }

  // 4. Conversation AI disabled
  if (conversation.ai_autoreply_disabled) {
    return { allowed: false, reason: 'AI disabled' }
  }

  // 5. Conversation reply count cap
  if (conversation.ai_reply_count >= config.autoReplyMaxPerConversation) {
    return { allowed: false, reason: 'conversation limit reached' }
  }

  // 6. Messages existence
  const messages = await buildConversationContext(db, conversation.id)
  if (messages.length === 0) {
    return { allowed: false, reason: 'no messages in conversation' }
  }

  // 7. Duplicate check (latest message role !== user)
  const lastMsg = messages[messages.length - 1]
  if (lastMsg.role !== 'user') {
    return { allowed: false, reason: 'duplicate incoming message' }
  }

  return { allowed: true }
}

/**
 * AI auto-reply for a freshly-arrived inbound message.
 */
export async function dispatchInboundToAiReply(
  args: DispatchArgs,
): Promise<void> {
  const { accountId, conversationId, contactId, configOwnerUserId, incomingMessageId } = args

  try {
    const db = supabaseAdmin()

    // Fetch contact
    const { data: contact } = await db
      .from('contacts')
      .select('id, phone')
      .eq('id', contactId)
      .single()

    // Fetch conversation
    const { data: conversation } = await db
      .from('conversations')
      .select('id, assigned_agent_id, ai_autoreply_disabled, ai_reply_count, status, last_message_at, current_booking_id, booking_step')
      .eq('id', conversationId)
      .single()

    if (!contact || !conversation) {
      console.log('AI auto-reply / Booking skipped', {
        reason: 'Missing contact or conversation record',
        contactId,
        conversationId,
        messageId: incomingMessageId,
      })
      return
    }

    // Fetch incoming message
    let incomingMessage = null
    if (incomingMessageId) {
      const { data: msg } = await db
        .from('messages')
        .select('id, content_text, interactive_reply_id, message_id')
        .eq('id', incomingMessageId)
        .single()
      incomingMessage = msg
    } else {
      const { data: msg } = await db
        .from('messages')
        .select('id, content_text, interactive_reply_id, message_id')
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'customer')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      incomingMessage = msg
    }

    if (!incomingMessage) {
      console.log('AI auto-reply / Booking skipped', {
        reason: 'Missing incomingMessage record',
        contactId: contact.id,
        conversationId: conversation.id,
        messageId: incomingMessageId,
      })
      return
    }

    const messageTextToProcess =
      incomingMessage.interactive_reply_id || incomingMessage.content_text || ''

    // 0. WELCOME INTENT QUALIFICATION MENU (Configurable for all accounts via UI)
    const isBuddies = await isBuddiesProductionAccount(db, accountId)

    let welcomeMenu: {
      enabled: boolean
      header_text?: string
      body_text?: string
      footer_text?: string
      buttons?: Array<{
        id: string
        title: string
        action: 'booking' | 'ai_inquiry' | 'talk_to_team' | 'custom_reply'
        reply_text?: string
        assigned_agent_id?: string | null
      }>
    } | null = null

    try {
      const { data: welcomeAuto } = await db
        .from('automations')
        .select('id, is_active, trigger_config')
        .eq('account_id', accountId)
        .eq('trigger_type', 'welcome_intent_menu')
        .maybeSingle()

      if (welcomeAuto) {
        welcomeMenu = {
          enabled: Boolean(welcomeAuto.is_active),
          header_text: (welcomeAuto.trigger_config as any)?.header_text,
          body_text: (welcomeAuto.trigger_config as any)?.body_text,
          footer_text: (welcomeAuto.trigger_config as any)?.footer_text,
          buttons: (welcomeAuto.trigger_config as any)?.buttons,
        }
      }
    } catch (wmErr) {
      console.warn('[welcome menu] Error loading welcome automation:', wmErr)
    }

    // Default configuration for Buddies Production if not explicitly configured in UI
    if (!welcomeMenu && isBuddies) {
      welcomeMenu = {
        enabled: true,
        header_text: 'Buddies Production',
        body_text:
          'Namaste! 🙏 Welcome to Buddies Production.\n\nAapki behtar sahayata ke liye, kripya confirm karein ki aap kis regarding connect karna chahte hain?',
        footer_text: 'Please select an option below',
        buttons: [
          { id: 'buddies_intent_rental', title: 'Rental Booking', action: 'booking' },
          {
            id: 'buddies_intent_inquiry',
            title: 'General Inquiry',
            action: 'ai_inquiry',
            reply_text: 'Please let us know your query, how can we help you today?',
          },
          { id: 'buddies_intent_team', title: 'Talk to Team', action: 'talk_to_team' },
        ],
      }
    }

    if (
      welcomeMenu &&
      welcomeMenu.enabled &&
      Array.isArray(welcomeMenu.buttons) &&
      welcomeMenu.buttons.length > 0
    ) {
      const replyId = incomingMessage.interactive_reply_id || ''
      const lowerText = (incomingMessage.content_text || '').toLowerCase().trim()

      // Match clicked button or matching text
      const matchedBtn = welcomeMenu.buttons.find(
        (b) =>
          (replyId && b.id === replyId) ||
          (b.title && lowerText === b.title.toLowerCase().trim()) ||
          (b.id === 'buddies_intent_rental' && lowerText === 'rental booking') ||
          (b.id === 'buddies_intent_inquiry' && lowerText === 'general inquiry') ||
          (b.id === 'buddies_intent_team' &&
            (lowerText === 'talk to team' ||
              lowerText === 'team' ||
              lowerText.includes('team se baat') ||
              lowerText.includes('agent se baat')))
      )

      if (matchedBtn) {
        console.log(
          `[welcome menu] Customer selected intent: ${matchedBtn.title} (action: ${matchedBtn.action})`
        )

        // 1. Action: BOOKING (Triggers automated booking flow)
        if (matchedBtn.action === 'booking') {
          const bookingState = await processBookingFlow(
            db,
            accountId,
            conversation.id,
            contact.id,
            matchedBtn.title,
            configOwnerUserId
          )
          if (bookingState.interactiveList) {
            await engineSendInteractiveList({
              accountId,
              userId: configOwnerUserId,
              conversationId: conversation.id,
              contactId: contact.id,
              headerText: bookingState.interactiveList.headerText,
              bodyText: bookingState.interactiveList.bodyText,
              buttonLabel: bookingState.interactiveList.buttonLabel,
              footerText: bookingState.interactiveList.footerText,
              sections: bookingState.interactiveList.sections,
            })
            return
          } else if (bookingState.replyText) {
            await engineSendText({
              accountId,
              userId: configOwnerUserId,
              conversationId: conversation.id,
              contactId: contact.id,
              text: bookingState.replyText,
              isAiReply: true,
            })
            return
          }
        }

        // 2. Action: TALK TO TEAM (Transfer to human team, pause AI auto-reply, assign team member)
        if (matchedBtn.action === 'talk_to_team') {
          const replyText =
            matchedBtn.reply_text ||
            'Ji bilkul! 🙏 Aapki chat humari support team ko forward kar di gayi hai. Humare team member aapse jald hi direct baat karenge. Dhanyawad!'
          await engineSendText({
            accountId,
            userId: configOwnerUserId,
            conversationId: conversation.id,
            contactId: contact.id,
            text: replyText,
            isAiReply: true,
          })
          const updatePayload: Record<string, unknown> = {
            ai_autoreply_disabled: true,
            status: 'open',
          }
          if (matchedBtn.assigned_agent_id) {
            updatePayload.assigned_agent_id = matchedBtn.assigned_agent_id
            console.log(
              `[welcome menu] Pre-assigning conversation ${conversation.id} to team member ${matchedBtn.assigned_agent_id}`
            )
          }
          await db
            .from('conversations')
            .update(updatePayload)
            .eq('id', conversation.id)
          return
        }

        // 3. Action: AI INQUIRY (Acknowledge and invite question, keep AI auto-reply active)
        if (matchedBtn.action === 'ai_inquiry') {
          const replyText =
            matchedBtn.reply_text || 'Please let us know your query, how can we help you today?'
          await engineSendText({
            accountId,
            userId: configOwnerUserId,
            conversationId: conversation.id,
            contactId: contact.id,
            text: replyText,
            isAiReply: true,
          })
          return
        }

        // 4. Action: CUSTOM REPLY (Predefined message)
        if (matchedBtn.action === 'custom_reply' && matchedBtn.reply_text) {
          await engineSendText({
            accountId,
            userId: configOwnerUserId,
            conversationId: conversation.id,
            contactId: contact.id,
            text: matchedBtn.reply_text,
            isAiReply: true,
          })
          return
        }
      }

      // Check if customer already has an active booking session (giving name, phone, slot, payment)
      const hasActiveBooking = conversation.current_booking_id && conversation.booking_step

      if (!hasActiveBooking) {
        const isGreeting = /^(hi|hello|hey|namaste|hlo|hii|hiii|good\s*(morning|evening|afternoon)|start|help)$/i.test(
          lowerText
        )
        const { count: customerMsgCount } = await db
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conversation.id)
          .eq('sender_type', 'customer')

        const isStartingMessage = isGreeting || (customerMsgCount ?? 0) <= 1

        if (isStartingMessage && !replyId) {
          console.log('[welcome menu] Sending intent qualification buttons to new/starting customer')
          const headerText = (welcomeMenu.header_text || '').slice(0, 60)
          const bodyText =
            welcomeMenu.body_text ||
            'Namaste! 🙏 Welcome. Aapki behtar sahayata ke liye, kripya confirm karein ki aap kis regarding connect karna chahte hain?'
          const footerText = (welcomeMenu.footer_text || 'Please select an option below').slice(0, 60)

          const formattedButtons = welcomeMenu.buttons.slice(0, 3).map((btn, idx) => ({
            id: btn.id || `intent_btn_${idx + 1}`,
            title: (btn.title || `Option ${idx + 1}`).slice(0, 20),
          }))

          await engineSendInteractiveButtons({
            accountId,
            userId: configOwnerUserId,
            conversationId: conversation.id,
            contactId: contact.id,
            headerText: headerText || undefined,
            bodyText,
            buttons: formattedButtons,
            footerText,
          })
          return
        }
      }
    }

    // 1. UNCONDITIONAL BOOKING FLOW ENGINE EXECUTION
    // This allows booking intent & interactive list selections to work always!
    if (messageTextToProcess.trim()) {
      const bookingState = await processBookingFlow(
        db,
        accountId,
        conversation.id,
        contact.id,
        messageTextToProcess,
        configOwnerUserId
      )

      if (bookingState.isBookingFlow && (bookingState.replyText || bookingState.interactiveList)) {
        console.log('[booking flow] Handling booking step for customer:', bookingState.step)

        // Simulate natural human typing pause
        await new Promise((resolve) => setTimeout(resolve, 1500))

        // 1A. Send Interactive List for Category or Rental Product Selection
        if (bookingState.interactiveList) {
          try {
            console.log('[booking flow] Sending WhatsApp Interactive List for selection...')
            await engineSendInteractiveList({
              accountId,
              userId: configOwnerUserId,
              conversationId: conversation.id,
              contactId: contact.id,
              headerText: bookingState.interactiveList.headerText,
              bodyText: bookingState.interactiveList.bodyText,
              buttonLabel: bookingState.interactiveList.buttonLabel,
              footerText: bookingState.interactiveList.footerText,
              sections: bookingState.interactiveList.sections,
            })
            console.log('[booking flow] WhatsApp Interactive List successfully sent!')
            return
          } catch (listErr) {
            console.error('[booking flow] Interactive list send error, falling back to text:', listErr)
          }
        }

        // 1B. Send Interactive List for Date & Slot selection
        if (bookingState.step === 'datetime' && bookingState.slotSections) {
          try {
            console.log('[booking flow] Sending WhatsApp Interactive List for Date & Slot selection...')
            await engineSendInteractiveList({
              accountId,
              userId: configOwnerUserId,
              conversationId: conversation.id,
              contactId: contact.id,
              headerText: '📅 Appointment Booking',
              bodyText: 'Please tap the button below to select your preferred booking slot:',
              buttonLabel: 'Select Time Slot',
              footerText: 'Choose from available slots',
              sections: bookingState.slotSections,
            })
            console.log('[booking flow] WhatsApp Interactive List successfully sent!')
            return
          } catch (listErr) {
            console.error('[booking flow] Interactive list send error:', listErr)
          }
        }

        // 1C. Send PayU Payment CTA
        if (bookingState.step === 'payment' && bookingState.paymentLink) {
          try {
            const payAmount = bookingState.advanceAmount ? Number(bookingState.advanceAmount).toFixed(0) : '500'
            await engineSendCtaUrl({
              accountId,
              userId: configOwnerUserId,
              conversationId: conversation.id,
              contactId: contact.id,
              headerText: '📅 Booking Payment',
              bodyText: bookingState.replyText || 'Please complete your booking payment:',
              buttonLabel: `💳 Pay ₹${payAmount} Now`,
              url: bookingState.paymentLink,
              footerText: 'Instant Confirmation via PayU',
              isAiReply: true,
            })
            return
          } catch (ctaErr) {
            console.warn('[booking flow] Interactive CTA send error, falling back to text:', ctaErr)
          }
        }

        // 1D. Send Text Reply
        await engineSendText({
          accountId,
          userId: configOwnerUserId,
          conversationId: conversation.id,
          contactId: contact.id,
          text: bookingState.replyText || 'Please select an option to continue your booking.',
          isAiReply: true,
        })
        return
      }
    }

    // 2. GENERAL AI AUTO-REPLY (Knowledge Base & LLM)
    const config = await loadAiConfig(db, accountId)
    if (!config) {
      console.log('AI auto-reply skipped', {
        reason: 'AI config not found',
        contactId,
        conversationId,
        messageId: incomingMessageId,
      })
      return
    }

    // Reopen/unassign checks inside AI runner
    const lastMessageTime = conversation.last_message_at
      ? new Date(conversation.last_message_at).getTime()
      : 0
    const isNewInquiry =
      conversation.status === 'closed' ||
      conversation.status === 'snoozed' ||
      (conversation.last_message_at && Date.now() - lastMessageTime > 24 * 60 * 60 * 1000)

    if (isNewInquiry) {
      console.log(`[ai auto-reply] resetting conversation AI state for new inquiry`)
      await db
        .from('conversations')
        .update({
          ai_reply_count: 0,
          ai_autoreply_disabled: false,
          status: 'open',
          assigned_agent_id: null,
        })
        .eq('id', conversation.id)
      
      conversation.ai_autoreply_disabled = false
      conversation.status = 'open'
      conversation.assigned_agent_id = null
      conversation.ai_reply_count = 0
    }

    const eligibility = await canSendAIAutoReply({
      accountId,
      contact,
      conversation,
      incomingMessage,
      config,
      db,
    })

    console.log('[webhook] AI eligibility checked', {
      allowed: eligibility.allowed,
      reason: eligibility.reason,
    })

    if (!eligibility.allowed) {
      console.log('AI auto-reply skipped', {
        reason: eligibility.reason,
        contactId: contact.id,
        conversationId: conversation.id,
        messageId: incomingMessage.id,
      })
      return
    }

    // Simulate typing pause
    await new Promise((resolve) => setTimeout(resolve, 1800))

    console.log(`[ai auto-reply] contact ID: ${contact.id}, conversation ID: ${conversation.id}`)
    console.log(`[ai auto-reply] AI enabled status: account=${config.autoReplyEnabled}, conv_disabled=${conversation.ai_autoreply_disabled}`)
    console.log(`[ai auto-reply] assignment status: ${conversation.assigned_agent_id}`)
    console.log(`[ai auto-reply] human takeover status (conv_disabled): ${conversation.ai_autoreply_disabled}`)
    console.log(`[ai auto-reply] conversation reply count: ${conversation.ai_reply_count} / ${config.autoReplyMaxPerConversation}`)
    // Load message transcript history
    const messages = await buildConversationContext(db, conversation.id)
    console.log(`[ai auto-reply] AI generation started for conversation ${conversation.id}`)

    // Ground the reply in the account's knowledge base (best-effort).
    const knowledge = await retrieveKnowledge(
      db,
      accountId,
      config,
      latestUserMessage(messages),
    )

    const userPromptToUse = isBuddies
      ? (config.systemPrompt ? `${BUDDIES_DEFAULT_PROMPT}\n\nAdditional Instructions:\n${config.systemPrompt}` : BUDDIES_DEFAULT_PROMPT)
      : config.systemPrompt

    const systemPrompt = buildSystemPrompt({
      userPrompt: userPromptToUse,
      mode: 'auto_reply',
      knowledge,
      allowHandoff: !isBuddies,
    })

    const { text, handoff } = await generateReply({
      config,
      systemPrompt,
      messages,
    })

    if (text) {
      console.log('[webhook] AI reply generated', { text })
      // Track AI token usage & deduct cost from account balance
      await trackAiTokenUsage(
        db,
        accountId,
        configOwnerUserId,
        config.provider,
        config.model,
        systemPrompt,
        text,
      )
    }

    if (handoff || !text) {
      if (isBuddies) {
        console.log('[buddies ai] No handoff for Buddies Production — sending AI response')
        const fallbackText =
          "Hello! 🙏 Buddies Production me aapka swagat hai. Agar aap acting/casting, short film ya hamare camera gear & studio rental ke baare me pooch rahe hain, toh kripya apni query batayein — humari team aapko assist karegi!"
        await engineSendText({
          accountId,
          userId: configOwnerUserId,
          conversationId: conversation.id,
          contactId: contact.id,
          text: fallbackText,
          isAiReply: true,
        })
        return
      }

      await db
        .from('conversations')
        .update({ ai_autoreply_disabled: true })
        .eq('id', conversation.id)
      console.log('AI auto-reply skipped', {
        reason: 'handoff triggered or empty reply text generated',
        contactId: contact.id,
        conversationId: conversation.id,
        messageId: incomingMessage.id,
      })
      return
    }

    // Atomically claim a reply slot
    const { data: claimed, error: claimErr } = await db.rpc(
      'claim_ai_reply_slot',
      {
        conversation_id: conversation.id,
        max_replies: config.autoReplyMaxPerConversation,
      },
    )
    if (claimErr || claimed !== true) {
      console.log('AI auto-reply skipped', {
        reason: `failed to claim slot or limit reached: ${claimErr?.message || 'slot already taken'}`,
        contactId: contact.id,
        conversationId: conversation.id,
        messageId: incomingMessage.id,
      })
      return
    }

    console.log(`[ai auto-reply] WhatsApp reply sending. Conversation ID: ${conversation.id}`)
    await engineSendText({
      accountId,
      userId: configOwnerUserId,
      conversationId: conversation.id,
      contactId: contact.id,
      text,
      isAiReply: true,
    })
    console.log('[webhook] WhatsApp reply sent', { conversationId: conversation.id })
  } catch (err: any) {
    console.error('AI auto-reply skipped due to error', {
      contact_id: contactId,
      conversation_id: conversationId,
      incoming_message_id: incomingMessageId,
      workspace_id: accountId,
      skip_reason: 'error_thrown',
      error_message: err.message,
      stack: err.stack,
    })
  }
}
