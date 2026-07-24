/**
 * Shared OpenAI / Anthropic (Messages API) client for Pages Functions.
 *
 * Env (Pages → toydiary → Settings → Environment variables):
 *   OPENAI_API_KEY   — required (also used as Anthropic key; name kept for compat)
 *   OPENAI_BASE_URL  — optional base, no trailing slash
 *   OPENAI_MODEL     — optional model id
 *   AI_PROVIDER      — optional: "openai" | "anthropic" | "auto" (default auto)
 *
 * Auto detection:
 *   - AI_PROVIDER if set
 *   - base URL contains anthropic
 *   - model name looks like Claude (claude-*, anthropic/…)
 *   - else OpenAI-compatible chat/completions
 */

export type AiProviderKind = 'openai' | 'anthropic'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

export type AiCallInput = {
  apiKey: string
  baseUrl?: string
  model?: string
  providerHint?: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  /** OpenAI-only; ignored for Anthropic (prompt still asks for JSON). */
  jsonObject?: boolean
}

export type AiCallResult =
  | {
      ok: true
      text: string
      provider: AiProviderKind
      model: string
      baseUrl: string
      endpoint: string
      rawBody: string
    }
  | {
      ok: false
      error: string
      detail?: string
      provider: AiProviderKind
      model: string
      baseUrl: string
      endpoint: string
      status?: number
      rawBody?: string
      hint?: string
    }

export type AuthMeta = {
  envKey: 'OPENAI_API_KEY'
  projectHint: string
  provider: AiProviderKind
  providerSource: string
  baseUrl: string
  model: string
  baseUrlSource: 'env:OPENAI_BASE_URL' | 'default'
  modelSource: 'env:OPENAI_MODEL' | 'default'
  endpoint: string
  keyConfigured: true
  keyHint?: string
}

const DEFAULT_OPENAI_BASE = 'https://api.openai.com/v1'
const DEFAULT_ANTHROPIC_BASE = 'https://api.anthropic.com/v1'
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-haiku-latest'
const ANTHROPIC_VERSION = '2023-06-01'

export function resolveAiConfig(env: {
  OPENAI_API_KEY?: string
  OPENAI_BASE_URL?: string
  OPENAI_MODEL?: string
  AI_PROVIDER?: string
}) {
  const configuredBaseUrl = env.OPENAI_BASE_URL?.trim()
  const configuredModel = env.OPENAI_MODEL?.trim()
  const providerHint = env.AI_PROVIDER?.trim()
  const model = configuredModel || ''
  const provider = detectProvider({
    providerHint,
    baseUrl: configuredBaseUrl,
    model,
  })
  const baseUrl = (
    configuredBaseUrl ||
    (provider === 'anthropic' ? DEFAULT_ANTHROPIC_BASE : DEFAULT_OPENAI_BASE)
  ).replace(/\/$/, '')
  const resolvedModel =
    configuredModel ||
    (provider === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_OPENAI_MODEL)

  return {
    provider,
    providerSource: providerSourceLabel(providerHint, configuredBaseUrl, model),
    baseUrl,
    model: resolvedModel,
    baseUrlSource: configuredBaseUrl
      ? ('env:OPENAI_BASE_URL' as const)
      : ('default' as const),
    modelSource: configuredModel
      ? ('env:OPENAI_MODEL' as const)
      : ('default' as const),
  }
}

export function detectProvider(input: {
  providerHint?: string
  baseUrl?: string
  model?: string
}): AiProviderKind {
  const hint = input.providerHint?.trim().toLowerCase()
  if (hint === 'anthropic' || hint === 'claude') return 'anthropic'
  if (hint === 'openai' || hint === 'oai') return 'openai'

  const base = (input.baseUrl || '').toLowerCase()
  if (
    base.includes('anthropic.com') ||
    base.includes('/anthropic') ||
    /claude[^/]*\.com/.test(base)
  ) {
    return 'anthropic'
  }
  if (base.includes('openai.com') || base.includes('openrouter.ai')) {
    // OpenRouter is OpenAI-compatible by default
    return 'openai'
  }

  const model = (input.model || '').toLowerCase()
  if (
    model.startsWith('claude') ||
    model.includes('claude-') ||
    model.startsWith('anthropic/') ||
    model.includes('/claude')
  ) {
    return 'anthropic'
  }

  return 'openai'
}

function providerSourceLabel(
  providerHint: string | undefined,
  baseUrl: string | undefined,
  model: string,
): string {
  const hint = providerHint?.trim().toLowerCase()
  if (hint === 'anthropic' || hint === 'claude' || hint === 'openai' || hint === 'oai') {
    return `env:AI_PROVIDER=${hint}`
  }
  const base = (baseUrl || '').toLowerCase()
  if (base.includes('anthropic') || base.includes('openai.com')) {
    return 'baseUrl'
  }
  if (model && detectProvider({ model }) === 'anthropic') return 'model'
  return 'default'
}

export function maskKey(key: string) {
  const trimmed = key.trim()
  if (trimmed.length <= 8) return '********'
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)} (len ${trimmed.length})`
}

export function buildAuthMeta(
  config: ReturnType<typeof resolveAiConfig>,
  endpoint: string,
  apiKey?: string,
): AuthMeta {
  return {
    envKey: 'OPENAI_API_KEY',
    projectHint: 'Cloudflare Pages project: toydiary (Production env vars)',
    provider: config.provider,
    providerSource: config.providerSource,
    baseUrl: config.baseUrl,
    model: config.model,
    baseUrlSource: config.baseUrlSource,
    modelSource: config.modelSource,
    endpoint,
    keyConfigured: true,
    keyHint: apiKey ? maskKey(apiKey) : undefined,
  }
}

export async function callChatModel(input: AiCallInput): Promise<AiCallResult> {
  const forced =
    input.providerHint?.trim().toLowerCase() === 'anthropic' ||
    input.providerHint?.trim().toLowerCase() === 'claude' ||
    input.providerHint?.trim().toLowerCase() === 'openai' ||
    input.providerHint?.trim().toLowerCase() === 'oai'

  const provider = detectProvider({
    providerHint: input.providerHint,
    baseUrl: input.baseUrl,
    model: input.model,
  })
  const baseUrl = (
    input.baseUrl ||
    (provider === 'anthropic' ? DEFAULT_ANTHROPIC_BASE : DEFAULT_OPENAI_BASE)
  ).replace(/\/$/, '')
  const model =
    input.model ||
    (provider === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_OPENAI_MODEL)

  if (provider === 'anthropic') {
    return callAnthropic({ ...input, baseUrl, model })
  }

  const openaiResult = await callOpenAI({ ...input, baseUrl, model })
  if (openaiResult.ok) return openaiResult

  // Auto fallback: custom gateway may speak Anthropic Messages even when
  // model id doesn't look like Claude. Skip if provider was forced to openai.
  const customBase =
    Boolean(input.baseUrl?.trim()) &&
    !input.baseUrl!.toLowerCase().includes('openai.com')
  const shouldTryAnthropic =
    !forced &&
    customBase &&
    (openaiResult.status === 404 ||
      openaiResult.status === 400 ||
      openaiResult.status === 415 ||
      openaiResult.error === 'Invalid AI provider response' ||
      Boolean(openaiResult.rawBody && looksLikeAnthropicPayload(openaiResult.rawBody)) ||
      Boolean(openaiResult.hint?.includes('Anthropic')))

  if (!shouldTryAnthropic) return openaiResult

  const anthropicResult = await callAnthropic({ ...input, baseUrl, model })
  if (anthropicResult.ok) return anthropicResult

  // Prefer the more informative failure
  return {
    ...anthropicResult,
    detail: [
      `openai: ${openaiResult.error}${openaiResult.detail ? ` — ${openaiResult.detail.slice(0, 400)}` : ''}`,
      `anthropic: ${anthropicResult.error}${anthropicResult.detail ? ` — ${anthropicResult.detail.slice(0, 400)}` : ''}`,
    ].join('\n'),
    hint:
      'Tried OpenAI /chat/completions then Anthropic /messages. Set AI_PROVIDER=anthropic or openai to pin one protocol.',
  }
}

async function callOpenAI(
  input: AiCallInput & { baseUrl: string; model: string },
): Promise<AiCallResult> {
  const endpoint = `${input.baseUrl}/chat/completions`
  let upstream: Response
  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        temperature: input.temperature ?? 0.8,
        max_tokens: input.maxTokens ?? 512,
        ...(input.jsonObject
          ? { response_format: { type: 'json_object' } }
          : {}),
        messages: input.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    })
  } catch (err) {
    return {
      ok: false,
      error: 'Failed to reach AI provider',
      detail: err instanceof Error ? err.message : String(err),
      provider: 'openai',
      model: input.model,
      baseUrl: input.baseUrl,
      endpoint,
    }
  }

  const rawBody = await upstream.text().catch(() => '')
  if (!upstream.ok) {
    // Some gateways reject OpenAI paths — surface body and hint Anthropic.
    return {
      ok: false,
      error: `AI provider HTTP ${upstream.status}`,
      detail: rawBody.slice(0, 1200) || undefined,
      provider: 'openai',
      model: input.model,
      baseUrl: input.baseUrl,
      endpoint,
      status: upstream.status,
      rawBody: rawBody.slice(0, 1200),
      hint: anthropicHintFromFailure(rawBody),
    }
  }

  const text = extractAssistantText(rawBody)
  if (!text) {
    return {
      ok: false,
      error: 'Invalid AI provider response',
      detail: rawBody.slice(0, 1200) || '(empty body)',
      provider: 'openai',
      model: input.model,
      baseUrl: input.baseUrl,
      endpoint,
      status: upstream.status,
      rawBody: rawBody.slice(0, 1200),
      hint:
        looksLikeAnthropicPayload(rawBody)
          ? 'Response looks Anthropic-shaped but request used OpenAI /chat/completions. Set AI_PROVIDER=anthropic (or use a Claude model id / anthropic base URL).'
          : 'HTTP ok but no assistant text found (OpenAI choices[] or Anthropic content[]).',
    }
  }

  return {
    ok: true,
    text,
    provider: 'openai',
    model: input.model,
    baseUrl: input.baseUrl,
    endpoint,
    rawBody,
  }
}

async function callAnthropic(
  input: AiCallInput & { baseUrl: string; model: string },
): Promise<AiCallResult> {
  const endpoint = anthropicMessagesUrl(input.baseUrl)
  const { system, messages } = toAnthropicMessages(input.messages)

  let upstream: Response
  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        // Official Anthropic + many gateways accept both.
        'x-api-key': input.apiKey,
        Authorization: `Bearer ${input.apiKey}`,
        'anthropic-version': ANTHROPIC_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens ?? 512,
        temperature: input.temperature ?? 0.8,
        ...(system ? { system } : {}),
        messages,
      }),
    })
  } catch (err) {
    return {
      ok: false,
      error: 'Failed to reach AI provider',
      detail: err instanceof Error ? err.message : String(err),
      provider: 'anthropic',
      model: input.model,
      baseUrl: input.baseUrl,
      endpoint,
    }
  }

  const rawBody = await upstream.text().catch(() => '')
  if (!upstream.ok) {
    return {
      ok: false,
      error: `AI provider HTTP ${upstream.status}`,
      detail: rawBody.slice(0, 1200) || undefined,
      provider: 'anthropic',
      model: input.model,
      baseUrl: input.baseUrl,
      endpoint,
      status: upstream.status,
      rawBody: rawBody.slice(0, 1200),
      hint:
        'Anthropic Messages API failed. Check OPENAI_BASE_URL (…/v1), OPENAI_MODEL (claude-…), and that the key matches this gateway.',
    }
  }

  const text = extractAssistantText(rawBody)
  if (!text) {
    return {
      ok: false,
      error: 'Invalid AI provider response',
      detail: rawBody.slice(0, 1200) || '(empty body)',
      provider: 'anthropic',
      model: input.model,
      baseUrl: input.baseUrl,
      endpoint,
      status: upstream.status,
      rawBody: rawBody.slice(0, 1200),
      hint: 'HTTP ok but no text in Anthropic content[] (or OpenAI choices[] fallback).',
    }
  }

  return {
    ok: true,
    text,
    provider: 'anthropic',
    model: input.model,
    baseUrl: input.baseUrl,
    endpoint,
    rawBody,
  }
}

function anthropicMessagesUrl(baseUrl: string) {
  const base = baseUrl.replace(/\/$/, '')
  if (base.endsWith('/messages')) return base
  // base is typically https://host/v1
  return `${base}/messages`
}

function toAnthropicMessages(messages: ChatMessage[]) {
  const systemParts: string[] = []
  const out: { role: 'user' | 'assistant'; content: unknown }[] = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      const text = contentToPlainText(msg.content)
      if (text) systemParts.push(text)
      continue
    }
    const role = msg.role === 'assistant' ? 'assistant' : 'user'
    const content = toAnthropicContent(msg.content)
    if (!content) continue
    // Anthropic requires alternating user/assistant; merge consecutive same roles.
    const last = out[out.length - 1]
    if (last && last.role === role) {
      last.content = mergeAnthropicContent(last.content, content)
    } else {
      out.push({ role, content })
    }
  }

  // Anthropic requires first message to be user
  if (out.length === 0) {
    out.push({ role: 'user', content: [{ type: 'text', text: '你好' }] })
  } else if (out[0].role !== 'user') {
    out.unshift({ role: 'user', content: [{ type: 'text', text: '（继续）' }] })
  }

  return {
    system: systemParts.join('\n\n') || undefined,
    messages: out,
  }
}

function contentToPlainText(content: ChatMessage['content']): string {
  if (typeof content === 'string') return content.trim()
  return content
    .map((part) => {
      if (part.type === 'text') return part.text
      return ''
    })
    .filter(Boolean)
    .join('\n')
    .trim()
}

function toAnthropicContent(content: ChatMessage['content']): unknown {
  if (typeof content === 'string') {
    return content.trim()
      ? [{ type: 'text', text: content }]
      : null
  }

  const parts: unknown[] = []
  for (const part of content) {
    if (part.type === 'text' && part.text?.trim()) {
      parts.push({ type: 'text', text: part.text })
      continue
    }
    if (part.type === 'image_url' && part.image_url?.url) {
      const converted = dataUrlToAnthropicImage(part.image_url.url)
      if (converted) parts.push(converted)
      else {
        parts.push({
          type: 'text',
          text: `[image: ${part.image_url.url.slice(0, 80)}…]`,
        })
      }
    }
  }
  return parts.length ? parts : null
}

function dataUrlToAnthropicImage(url: string) {
  const match = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return null
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: match[1],
      data: match[2],
    },
  }
}

function mergeAnthropicContent(a: unknown, b: unknown): unknown {
  const asArr = Array.isArray(a) ? a : [{ type: 'text', text: String(a ?? '') }]
  const bsArr = Array.isArray(b) ? b : [{ type: 'text', text: String(b ?? '') }]
  return [...asArr, ...bsArr]
}

function looksLikeAnthropicPayload(rawBody: string) {
  try {
    const data = JSON.parse(rawBody) as Record<string, unknown>
    return (
      Array.isArray(data.content) ||
      data.type === 'message' ||
      typeof data.stop_reason === 'string'
    )
  } catch {
    return /"type"\s*:\s*"message"/.test(rawBody) || /"content"\s*:\s*\[/.test(rawBody)
  }
}

function anthropicHintFromFailure(rawBody: string) {
  const lower = rawBody.toLowerCase()
  if (
    lower.includes('anthropic') ||
    lower.includes('messages') ||
    lower.includes('x-api-key') ||
    lower.includes('claude')
  ) {
    return 'Provider error suggests Anthropic API. Set AI_PROVIDER=anthropic (or Claude model / anthropic base URL).'
  }
  return undefined
}

/**
 * Extract assistant text from OpenAI-compatible AND Anthropic Messages shapes.
 */
export function extractAssistantText(rawBody: string): string {
  if (!rawBody?.trim()) return ''
  let data: unknown
  try {
    data = JSON.parse(rawBody)
  } catch {
    // Rare: plain text body
    const plain = rawBody.trim()
    return plain.startsWith('{') || plain.startsWith('<') ? '' : plain
  }
  if (!data || typeof data !== 'object') return ''
  const root = data as Record<string, unknown>

  const fromString = (value: unknown) =>
    typeof value === 'string' ? value.trim() : ''

  const fromContentBlocks = (content: unknown): string => {
    if (typeof content === 'string') return content.trim()
    if (!Array.isArray(content)) return ''
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object') {
          const p = part as Record<string, unknown>
          // Anthropic: { type: "text", text: "..." }
          if (typeof p.text === 'string') return p.text
          if (typeof p.content === 'string') return p.content
          // OpenAI content parts
          if (p.type === 'text' && typeof p.text === 'string') return p.text
        }
        return ''
      })
      .join('')
      .trim()
  }

  // Anthropic Messages API: { content: [{ type: "text", text }], ... }
  if (Array.isArray(root.content)) {
    const fromAnthropic = fromContentBlocks(root.content)
    if (fromAnthropic) return fromAnthropic
  }
  if (typeof root.content === 'string' && root.content.trim()) {
    // avoid treating huge non-message payloads as reply when choices exist
    if (!Array.isArray(root.choices)) return root.content.trim()
  }

  // OpenAI chat.completions
  const choices = root.choices
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
    const choice = choices[0] as Record<string, unknown>
    const message = choice.message
    if (message && typeof message === 'object') {
      const msg = message as Record<string, unknown>
      const fromMsg =
        fromContentBlocks(msg.content) ||
        fromString(msg.reasoning_content) ||
        fromString(msg.reasoning)
      if (fromMsg) return fromMsg
    }
    const fromChoice =
      fromString(choice.text) ||
      fromContentBlocks(
        (choice.delta as Record<string, unknown> | undefined)?.content,
      )
    if (fromChoice) return fromChoice
  }

  // Non-standard gateways / already-normalized
  const direct =
    fromString(root.reply) ||
    fromString(root.output_text) ||
    fromString(root.result) ||
    fromString(root.completion)
  if (direct) return direct

  // Nested Anthropic-like under data/message
  for (const key of ['data', 'message', 'output', 'response'] as const) {
    const nested = root[key]
    if (nested && typeof nested === 'object') {
      const n = nested as Record<string, unknown>
      const t =
        fromContentBlocks(n.content) ||
        fromString(n.text) ||
        fromString(n.reply)
      if (t) return t
    }
  }

  return ''
}
