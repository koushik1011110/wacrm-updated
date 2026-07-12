import { NextResponse } from 'next/server'
import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import { validateAiCredentials } from '@/lib/ai/validate'
import { embedTexts } from '@/lib/ai/embeddings'
import { AiError, type AiProvider } from '@/lib/ai/types'

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * GET /api/ai/config
 *
 * Any member may read the config so the inbox/settings can reflect
 * whether AI is set up. The encrypted key is NEVER returned — only a
 * `has_key` flag; the settings form shows a masked placeholder.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    let data: any = null
    let error: any = null

    const fetchResult = await supabase
      .from('ai_configs')
      .select(
        'provider, model, system_prompt, is_active, auto_reply_enabled, auto_reply_max_per_conversation, daily_message_limit, api_key, embeddings_api_key',
      )
      .eq('account_id', accountId)
      .maybeSingle()

    error = fetchResult.error
    data = fetchResult.data

    if (error) {
      if (error.code === 'PGRST204' || (error.message && error.message.includes('daily_message_limit'))) {
        const retryResult = await supabase
          .from('ai_configs')
          .select(
            'provider, model, system_prompt, is_active, auto_reply_enabled, auto_reply_max_per_conversation, api_key, embeddings_api_key',
          )
          .eq('account_id', accountId)
          .maybeSingle()

        if (retryResult.error) {
          console.error('[ai/config GET] fetch retry error:', retryResult.error)
          return NextResponse.json(
            { error: 'Failed to load AI configuration' },
            { status: 500 },
          )
        }
        data = retryResult.data ? { ...retryResult.data, daily_message_limit: 50 } : null
      } else {
        console.error('[ai/config GET] fetch error:', error)
        return NextResponse.json(
          { error: 'Failed to load AI configuration' },
          { status: 500 },
        )
      }
    }

    if (!data) return NextResponse.json({ configured: false })
    // The keys are selected only to derive the has_* flags; neither is
    // returned to the client.
    const { api_key, embeddings_api_key, ...safe } = data
    let provider = safe.provider as AiProvider
    let model = safe.model
    if (model.startsWith('gemini:')) {
      provider = 'gemini'
      model = model.slice('gemini:'.length)
    }
    return NextResponse.json({
      configured: true,
      has_key: !!api_key,
      has_embeddings_key: !!embeddings_api_key,
      ...safe,
      provider,
      model,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/ai/config  (admin+)
 *
 * Upsert the account's AI config. Validates the key with the provider
 * before persisting (mirrors the WhatsApp config verifying with Meta
 * first), then stores the key AES-256-GCM-encrypted. When `api_key` is
 * omitted the existing stored key is reused (the form sends it only
 * when the user re-enters it).
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')

    const limit = checkRateLimit(`ai-config:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return bad('Invalid request body')

    const provider = body.provider as AiProvider
    if (provider !== 'openai' && provider !== 'anthropic' && provider !== 'gemini') {
      return bad('provider must be "openai", "anthropic" or "gemini"')
    }
    const model = typeof body.model === 'string' ? body.model.trim() : ''
    if (!model) return bad('model is required')

    const systemPrompt =
      typeof body.system_prompt === 'string' && body.system_prompt.trim()
        ? body.system_prompt.trim()
        : null
    const isActive = body.is_active === true
    const autoReplyEnabled = body.auto_reply_enabled === true

    let maxPer = Number(body.auto_reply_max_per_conversation)
    if (!Number.isFinite(maxPer)) maxPer = 3
    maxPer = Math.min(40, Math.max(1, Math.floor(maxPer)))

    let dailyLimit = Number(body.daily_message_limit)
    if (!Number.isFinite(dailyLimit)) dailyLimit = 50
    dailyLimit = Math.min(1000, Math.max(1, Math.floor(dailyLimit)))

    const rawKey = typeof body.api_key === 'string' ? body.api_key.trim() : ''

    // Embeddings key (optional, for semantic KB search): a non-empty
    // string sets/replaces it; an explicit null clears it; absent leaves
    // it unchanged. The form only sends it when the admin edits it.
    const rawEmbeddingsKey =
      typeof body.embeddings_api_key === 'string'
        ? body.embeddings_api_key.trim()
        : ''
    const clearEmbeddingsKey = body.embeddings_api_key === null

    // Reuse the stored key when the form didn't send a fresh one.
    const { data: existing } = await supabase
      .from('ai_configs')
      .select('id, provider, model, api_key')
      .eq('account_id', accountId)
      .maybeSingle()

    let apiKeyPlain: string
    if (rawKey) {
      apiKeyPlain = rawKey
    } else if (existing?.api_key) {
      try {
        apiKeyPlain = decrypt(existing.api_key)
      } catch {
        return bad('Stored API key could not be decrypted — re-enter your key.')
      }
    } else {
      return bad('api_key is required')
    }

    // Only spend a provider round-trip when the credentials that affect
    // reachability actually changed. A save that just flips a toggle or
    // edits the system prompt on an existing, already-validated config
    // skips the call — no wasted token/latency on the account's key.
    let existingProvider = existing?.provider
    let existingModel = existing?.model
    if (existingModel?.startsWith('gemini:')) {
      existingProvider = 'gemini'
      existingModel = existingModel.slice('gemini:'.length)
    }

    const credentialsChanged =
      !existing ||
      rawKey !== '' ||
      provider !== existingProvider ||
      model !== existingModel

    if (credentialsChanged) {
      try {
        await validateAiCredentials({
          provider,
          model,
          apiKey: apiKeyPlain,
          systemPrompt,
          isActive,
          autoReplyEnabled,
          autoReplyMaxPerConversation: maxPer,
          dailyMessageLimit: dailyLimit,
          embeddingsApiKey: null,
        })
      } catch (err) {
        if (err instanceof AiError) {
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status: 400 },
          )
        }
        console.error('[ai/config POST] validation error:', err)
        return bad('Could not validate the API key with the provider.')
      }
    }

    // Validate a new embeddings key before storing (a cheap 1-input
    // embed), same "verify before save" discipline as the chat key.
    if (rawEmbeddingsKey) {
      try {
        await embedTexts(rawEmbeddingsKey, ['ping'])
      } catch (err) {
        if (err instanceof AiError) {
          return NextResponse.json(
            { error: `Embeddings key: ${err.message}`, code: err.code },
            { status: 400 },
          )
        }
        console.error('[ai/config POST] embeddings validation error:', err)
        return bad('Could not validate the embeddings key.')
      }
    }

    const encryptedKey = rawKey ? encrypt(rawKey) : null
    const shared: Record<string, unknown> = {
      provider,
      model,
      system_prompt: systemPrompt,
      is_active: isActive,
      auto_reply_enabled: autoReplyEnabled,
      daily_message_limit: dailyLimit,
    }
    if (rawEmbeddingsKey) {
      shared.embeddings_api_key = encrypt(rawEmbeddingsKey)
    } else if (clearEmbeddingsKey) {
      shared.embeddings_api_key = null
    }

    let dailyMessageLimitColumnExists = true
    let maxRepliesCap = maxPer

    const attemptSave = async (prov: string, mod: string) => {
      const payload: Record<string, unknown> = {
        ...shared,
        provider: prov,
        model: mod,
        auto_reply_max_per_conversation: maxRepliesCap,
      }
      if (!dailyMessageLimitColumnExists) {
        delete payload.daily_message_limit
      }
      if (encryptedKey) {
        payload.api_key = encryptedKey
      }
      if (existing) {
        return await supabase
          .from('ai_configs')
          .update(payload)
          .eq('account_id', accountId)
      } else {
        return await supabase.from('ai_configs').insert({
          account_id: accountId,
          created_by: userId,
          api_key: encryptedKey, // guaranteed non-null: rawKey required when no existing row
          ...payload,
        })
      }
    }

    const runSave = async (prov: string, mod: string) => {
      let res = await attemptSave(prov, mod)
      if (res.error) {
        // Fallback 1: Missing daily_message_limit column
        if (
          res.error.code === 'PGRST204' ||
          (res.error.message && res.error.message.includes('daily_message_limit'))
        ) {
          dailyMessageLimitColumnExists = false
          res = await attemptSave(prov, mod)
        }
        // Fallback 2: auto_reply_max_per_conversation check constraint (20 max allowed previously)
        if (
          res.error &&
          res.error.code === '23514' &&
          res.error.message &&
          res.error.message.includes('auto_reply_max_per_conversation_check')
        ) {
          maxRepliesCap = Math.min(20, maxPer)
          res = await attemptSave(prov, mod)
        }
      }
      return res
    }

    let saveRes = await runSave(provider, model)
    let saveErr = saveRes.error

    if (saveErr && saveErr.code === '23514' && !saveErr.message.includes('auto_reply_max_per_conversation_check')) {
      // Fallback for database check constraint limitations: store gemini under openai with prefix
      const fallbackProvider = 'openai'
      const fallbackModel = `gemini:${model}`
      saveRes = await runSave(fallbackProvider, fallbackModel)
      saveErr = saveRes.error
    }

    if (saveErr) {
      console.error('[ai/config POST] save error:', saveErr)
      return NextResponse.json(
        { error: 'Failed to save AI configuration' },
        { status: 500 },
      )
    }

    // Refresh/reload schema cache after save (fails silently if function not created yet)
    try {
      await supabase.rpc('reload_schema')
    } catch (e) {
      // Ignored if migration hasn't been applied yet
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * DELETE /api/ai/config  (admin+)
 *
 * Removes the account's AI config (turns everything off and forgets the
 * key). Also used to recover from a corrupted encrypted key.
 */
export async function DELETE() {
  try {
    const { supabase, accountId } = await requireRole('admin')
    const { error } = await supabase
      .from('ai_configs')
      .delete()
      .eq('account_id', accountId)
    if (error) {
      console.error('[ai/config DELETE] error:', error)
      return NextResponse.json(
        { error: 'Failed to delete AI configuration' },
        { status: 500 },
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
