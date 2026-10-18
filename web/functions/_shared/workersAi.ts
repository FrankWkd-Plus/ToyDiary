/**
 * Cloudflare Workers AI client for Pages Functions.
 *
 * The `AI` binding is declared in `web/wrangler.jsonc`:
 *
 *   "ai": { "binding": "AI" }
 *
 * No API key, gateway URL or external account is involved. Model ids are
 * tried in order so a catalog change (or a model that is not enabled for the
 * account) degrades to the next one instead of breaking chat entirely.
 *
 * Optional: set `AI_MODEL` (plain var) to pin a different Workers AI model.
 */

export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessage = {
  role: ChatRole
  content: string
}

export type RunAiInput = {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  /** Hard cap for one model attempt. */
  timeoutMs?: number
}

/** Structural view of the Workers AI binding. */
export interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>
}

export type AiEnv = {
  AI?: AiBinding
  AI_MODEL?: string
}

export type AiTextResult =
  | {
      ok: true
      text: string
      model: string
      provider: 'workers-ai'
    }
  | {
      ok: false
      error: string
      detail?: string
      hint?: string
      model: string
      provider: 'workers-ai'
      triedModels: string[]
    }

/**
 * Qwen3 30B-A3B is a good fit here: strong Chinese, strong instruction
 * following, and it is served as an OpenAI-style chat completion.
 */
export const DEFAULT_AI_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8'

const FALLBACK_AI_MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct',
]

export function aiModelCandidates(env: AiEnv): string[] {
  const configured = env.AI_MODEL?.trim()
  const models = [configured, DEFAULT_AI_MODEL, ...FALLBACK_AI_MODELS]
  return [...new Set(models.filter((m): m is string => Boolean(m)))]
}

export async function runWorkersAi(
  env: AiEnv,
  input: RunAiInput,
): Promise<AiTextResult> {
  const models = aiModelCandidates(env)

  if (!env.AI || typeof env.AI.run !== 'function') {
    return {
      ok: false,
      error: 'Workers AI binding (AI) is not configured',
      detail: 'The Pages Function could not find an AI binding on env.',
      hint:
        'Add "ai": { "binding": "AI" } to web/wrangler.jsonc and redeploy the Pages project. No API key is needed.',
      model: models[0],
      provider: 'workers-ai',
      triedModels: [],
    }
  }

  const messages = input.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))

  let last: Extract<AiTextResult, { ok: false }> | null = null

  for (const model of models) {
    try {
      const raw = await withTimeout(
        env.AI.run(model, {
          messages,
          max_tokens: input.maxTokens ?? 512,
          temperature: input.temperature ?? 0.8,
        }),
        input.timeoutMs ?? 20_000,
      )

      const text = stripThinking(extractAiText(raw)).trim()
      if (text) {
        return { ok: true, text, model, provider: 'workers-ai' }
      }

      last = {
        ok: false,
        error: 'Workers AI returned an empty response',
        detail: preview(raw),
        model,
        provider: 'workers-ai',
        triedModels: [],
      }
    } catch (err) {
      last = {
        ok: false,
        error: 'Workers AI request failed',
        detail: err instanceof Error ? err.message : String(err),
        model,
        provider: 'workers-ai',
        triedModels: [],
      }
    }
  }

  const failure: Extract<AiTextResult, { ok: false }> = last ?? {
    ok: false,
    error: 'Workers AI request failed',
    model: models[0],
    provider: 'workers-ai',
    triedModels: [],
  }

  console.error('[workers-ai] all models failed', {
    models,
    error: failure.error,
    detail: failure.detail,
  })

  return {
    ...failure,
    hint: `Tried ${models.join(', ')}. Set AI_MODEL to pin a different Workers AI model.`,
    triedModels: models,
  }
}

/**
 * Workers AI models return either `{ response: string }` (Llama, Qwen2.5) or
 * an OpenAI-style `{ choices: [{ message: { content } }] }` (Qwen3).
 */
export function extractAiText(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (!raw || typeof raw !== 'object') return ''

  const root = raw as Record<string, unknown>

  if (typeof root.response === 'string') return root.response
  if (root.response && typeof root.response === 'object') {
    // Some models return a structured object when asked for JSON.
    return safeStringify(root.response)
  }

  if (typeof root.result === 'string') return root.result
  if (root.result && typeof root.result === 'object') {
    const nested = extractAiText(root.result)
    if (nested) return nested
  }

  const choices = root.choices
  if (Array.isArray(choices) && choices.length > 0) {
    const choice = choices[0]
    if (choice && typeof choice === 'object') {
      const entry = choice as Record<string, unknown>
      const message = entry.message
      if (message && typeof message === 'object') {
        const fromMessage = contentToText(
          (message as Record<string, unknown>).content,
        )
        if (fromMessage) return fromMessage
      }
      if (typeof entry.text === 'string') return entry.text
      if (entry.delta && typeof entry.delta === 'object') {
        const fromDelta = contentToText(
          (entry.delta as Record<string, unknown>).content,
        )
        if (fromDelta) return fromDelta
      }
    }
  }

  for (const key of ['output_text', 'text', 'completion'] as const) {
    const value = root[key]
    if (typeof value === 'string' && value.trim()) return value
  }

  return ''
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object') {
          const text = (part as Record<string, unknown>).text
          if (typeof text === 'string') return text
        }
        return ''
      })
      .join('')
  }
  if (content && typeof content === 'object') {
    const text = (content as Record<string, unknown>).text
    if (typeof text === 'string') return text
  }
  return ''
}

/** Qwen3 can wrap reasoning in think tags; never show those blocks to users. */
export function stripThinking(text: string): string {
  return text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/^\s*<think(?:ing)?>[\s\S]*$/i, '')
    .trim()
}

/**
 * Extract the first JSON object from a model response. Handles code fences,
 * leading prose and trailing commentary.
 */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const candidates: string[] = []
  const fenced = stripCodeFence(trimmed)
  candidates.push(fenced)

  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first !== -1 && last > first) {
    candidates.push(trimmed.slice(first, last + 1))
  }

  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const parsed: unknown = JSON.parse(candidate)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // try the next candidate
    }
  }

  return null
}

export function stripCodeFence(text: string): string {
  const match = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return match ? match[1].trim() : text
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Workers AI timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

function preview(value: unknown): string {
  try {
    const text = typeof value === 'string' ? value : safeStringify(value)
    return text.slice(0, 600)
  } catch {
    return String(value).slice(0, 600)
  }
}

function safeStringify(value: unknown): string {
  try {
    const text = JSON.stringify(value)
    return text ?? String(value)
  } catch {
    return String(value)
  }
}
