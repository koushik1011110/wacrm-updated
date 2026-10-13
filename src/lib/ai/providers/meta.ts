import { AiError, type ChatMessage } from '../types'
import {
  mergeConsecutive,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'

const META_AI_URL = 'https://api.meta.ai/v1/responses'
const META_MAX_OUTPUT_TOKENS = 32000

interface MetaAiContentPart {
  type?: string
  text?: string
}

interface MetaAiOutputItem {
  type?: string
  role?: string
  content?: string | MetaAiContentPart[]
  text?: string
}

interface MetaAiResponse {
  status?: string
  incomplete_details?: {
    reason?: string
  } | null
  output?: MetaAiOutputItem[]
  error?: {
    message?: string
    code?: string | null
  }
}

function normalizeForMeta(messages: ChatMessage[]): ChatMessage[] {
  const merged = mergeConsecutive(messages)
  if (merged.length === 0) {
    return [{ role: 'user', content: 'Hello' }]
  }
  return merged
}

/**
 * Extracts plain text from a parsed Meta AI response object.
 */
function extractMetaResponseText(data: MetaAiResponse | null): string {
  if (!data) return ''

  if (Array.isArray(data.output)) {
    // 1. Look for assistant message item (or any message item)
    const messageItem =
      data.output.find((item) => item.type === 'message' && item.role === 'assistant') ??
      data.output.find((item) => item.type === 'message')

    if (messageItem) {
      if (typeof messageItem.content === 'string') {
        const trimmed = messageItem.content.trim()
        if (trimmed) return trimmed
      }
      if (Array.isArray(messageItem.content)) {
        const textParts = messageItem.content
          .map((part) => (typeof part === 'string' ? part : part?.text ?? ''))
          .filter(Boolean)
        const combined = textParts.join('').trim()
        if (combined) return combined
      }
      if (typeof messageItem.text === 'string' && messageItem.text.trim()) {
        return messageItem.text.trim()
      }
    }

    // 2. Check any non-reasoning item with text
    for (const item of data.output) {
      if (item.type !== 'reasoning') {
        if (typeof item.text === 'string' && item.text.trim()) {
          return item.text.trim()
        }
      }
    }
  }

  return ''
}

/**
 * Parse an SSE (text/event-stream) payload from Meta AI.
 * Accumulates delta text or extracts the final response.completed object.
 */
function parseMetaEventStream(rawText: string): string {
  const lines = rawText.split('\n')
  let accumulatedDelta = ''
  let finalResponseText = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue

    const jsonStr = trimmed.slice(5).trim()
    if (!jsonStr || jsonStr === '[DONE]') continue

    try {
      const parsed = JSON.parse(jsonStr)
      if (parsed.type === 'response.output_text.delta' && typeof parsed.delta === 'string') {
        accumulatedDelta += parsed.delta
      } else if (parsed.type === 'response.completed' && parsed.response) {
        const text = extractMetaResponseText(parsed.response)
        if (text) {
          finalResponseText = text
        }
      }
    } catch {
      // Ignore partial or non-JSON SSE lines
    }
  }

  return finalResponseText || accumulatedDelta.trim()
}

/**
 * Call Meta AI's Responses endpoint with the caller's key.
 * Returns the raw assistant text (handoff parsing happens in `generateReply`).
 */
export async function generateMeta(args: ProviderArgs): Promise<string> {
  const { apiKey, model, systemPrompt, messages, timeoutMs } = args

  if (!apiKey || !apiKey.trim()) {
    throw new AiError('Meta AI API key is missing. Enter your key in Settings → AI Assistant.', {
      code: 'invalid_key',
      status: 401,
    })
  }

  const requestBody: Record<string, unknown> = {
    model,
    instructions: systemPrompt,
    input: normalizeForMeta(messages),
    stream: false,
    temperature: 1,
    top_p: 1,
    max_output_tokens: META_MAX_OUTPUT_TOKENS,
    reasoning: { effort: 'medium' },
  }

  // Allow at least 45 seconds for models with reasoning effort
  const effectiveTimeout = Math.max(timeoutMs, 45_000)

  let res: Response
  try {
    res = await fetch(META_AI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(effectiveTimeout),
    })
  } catch (err) {
    throw toNetworkError(err)
  }

  if (!res.ok) {
    throw await providerHttpError('Meta AI', res)
  }

  const contentType = res.headers?.get?.('content-type') || ''
  let text = ''

  if (contentType.includes('text/event-stream')) {
    const rawText = typeof res.text === 'function' ? await res.text().catch(() => '') : ''
    text = parseMetaEventStream(rawText)
  } else if (typeof res.text === 'function') {
    const rawText = await res.text().catch(() => '')
    if (rawText.startsWith('event:')) {
      text = parseMetaEventStream(rawText)
    } else {
      try {
        const data = JSON.parse(rawText) as MetaAiResponse
        text = extractMetaResponseText(data)

        if (!text && data.status === 'incomplete') {
          const reason = data.incomplete_details?.reason || 'token_limit'
          throw new AiError(`Meta AI stopped early without completing response: ${reason}`, {
            code: 'response_incomplete',
          })
        }
      } catch (parseErr) {
        if (parseErr instanceof AiError) throw parseErr
        text = parseMetaEventStream(rawText)
      }
    }
  } else if (typeof res.json === 'function') {
    const data = (await res.json().catch(() => null)) as MetaAiResponse | null
    text = extractMetaResponseText(data)
  }

  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new AiError('Meta AI returned an empty response.', {
      code: 'empty_response',
    })
  }

  return text.trim()
}
