import { supabaseAdmin } from './admin-client'
import { loadAiConfig } from './config'
import { buildConversationContext } from './context'
import { retrieveKnowledge } from './knowledge'
import { generateReply } from './generate'
import { buildSystemPrompt } from './defaults'
import { latestUserMessage } from './query'
import { engineSendText, engineSendCtaUrl, engineSendInteractiveList, engineMarkMessageAsRead } from '@/lib/flows/meta-send'
import { startOfLocalDay } from '@/lib/dashboard/date-utils'
import { AiConfig } from './types'
import { trackAiTokenUsage } from './token-tracker'
import { processBookingFlow } from '@/lib/booking/flow'

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

        // Mark incoming customer message as READ (blue ticks on WhatsApp)
        if (incomingMessage?.message_id) {
          await engineMarkMessageAsRead({
            accountId,
            metaMessageId: incomingMessage.message_id,
          }).catch((err) => console.warn('[auto-reply] mark read error:', err))
        }

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

    const isStaleHandover =
      !conversation.assigned_agent_id &&
      conversation.ai_autoreply_disabled === true

    if (isNewInquiry || isStaleHandover) {
      console.log(`[ai auto-reply] resetting conversation AI state: isNewInquiry=${isNewInquiry}, isStaleHandover=${isStaleHandover}`)
      await db
        .from('conversations')
        .update({
          ai_reply_count: isNewInquiry ? 0 : conversation.ai_reply_count,
          ai_autoreply_disabled: false,
          status: 'open',
          assigned_agent_id: null,
        })
        .eq('id', conversation.id)
      
      conversation.ai_autoreply_disabled = false
      conversation.status = 'open'
      conversation.assigned_agent_id = null
      if (isNewInquiry) {
        conversation.ai_reply_count = 0
      }
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

    // Mark incoming customer message as READ (blue ticks on WhatsApp)
    if (incomingMessage?.message_id) {
      await engineMarkMessageAsRead({
        accountId,
        metaMessageId: incomingMessage.message_id,
      }).catch((err) => console.warn('[auto-reply] mark read error:', err))
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

    const systemPrompt = buildSystemPrompt({
      userPrompt: config.systemPrompt,
      mode: 'auto_reply',
      knowledge,
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
