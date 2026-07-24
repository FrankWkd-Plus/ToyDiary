import type { Entry, Toy } from '../types'

export interface ChatTurn {
  role: 'user' | 'toy'
  text: string
}

export interface ChatToyReplyInput {
  toy: Toy
  message: string
  history?: ChatTurn[]
  entries?: Entry[]
  quietMode?: boolean
}

export interface ChatApiError {
  /** HTTP status from our /api/chat (or 0 if network/parse failed). */
  status: number
  /** Raw response body text (or network error message). */
  body: string
}

export interface ChatToyReplyResult {
  reply: string
  source: 'api' | 'local'
  /** Present when remote AI was attempted but did not yield a usable reply. */
  apiError?: ChatApiError
}

const CHAT_ENDPOINT =
  (import.meta.env.VITE_AI_CHAT_ENDPOINT as string | undefined)?.trim() ||
  (import.meta.env.VITE_AI_ANALYZE_ENDPOINT as string | undefined)?.replace(
    /analyze-entry\/?$/,
    'chat',
  ) ||
  '/api/chat'

/** Local keyword templates — used when remote AI is unavailable. */
export function localPersonaReply(
  toy: Toy,
  text: string,
  entries: Entry[] = [],
): string {
  const normalized = text.trim()
  const recent = entries[0]
  const travel =
    entries.find((e) => e.type === 'travel' && e.imageUrl) ??
    entries.find((e) => e.imageUrl) ??
    recent

  if (/累|疲惫|难过|不开心|压力|烦/.test(normalized)) {
    if (toy.traits.includes('活泼')) {
      return '先把今天的大包袱放在这里吧，我替你看一会儿。等你有一点力气了，我们再慢慢往前走。'
    }
    if (toy.traits.includes('勇敢')) {
      return '今天不去很远的地方了，我们就在这里进行一次小小的休息探险。你已经做得很好啦。'
    }
    return '辛苦啦。你不需要马上振作，我会安安静静陪你待一会儿。要不要告诉我，今天最累的是哪一刻？'
  }

  if (/旅行|回忆|记得|以前|去过/.test(normalized) && travel?.location) {
    return `当然记得。我们在${travel.location}留下了「${travel.title || '一段小小的旅行'}」。我最舍不得忘记的，是那天你愿意带我一起看世界。`
  }

  if (/日记|记录|写下来|保存/.test(normalized)) {
    return '好呀。你把今天发生的事告诉我，我来帮你整理成一篇属于我们的日记；写完以后还可以再慢慢修改。'
  }

  if (/照片|晚霞|天空|看到/.test(normalized)) {
    return recent?.location
      ? `听起来像一张值得收藏的照片。会不会有一点像我们在${recent.location}看到的颜色？`
      : '我也想看看你眼中的这一刻。发给我吧，我们可以把它收藏进今天。'
  }

  if (/你好|在吗|想你|陪我/.test(normalized)) {
    return `我一直都在呀。${toy.traits.includes('活泼') ? '快把今天的新鲜事分我一点！' : '可以靠近一点，慢慢说给我听。'}`
  }

  const trait = toy.traits[0] || '温柔'
  return `我认真听到啦。作为一只${trait}的${toy.role}，我想把你刚刚说的这一刻好好接住。然后呢，还发生了什么？`
}

/** Pretty-print API body for chat display; keep raw text if not JSON. */
export function formatChatApiError(error: ChatApiError): string {
  const header =
    error.status > 0
      ? `AI 调用失败 · HTTP ${error.status}`
      : 'AI 调用失败 · 网络或请求异常'
  const raw = error.body?.trim()
  if (!raw) return `${header}\n（无返回内容）`

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    // Prefer a short human line first (from our Pages Function or OpenAI-style payload).
    const summary =
      pickErrorSummary(parsed) ||
      (typeof parsed.detail === 'string' ? parsed.detail : undefined)
    const pretty = JSON.stringify(parsed, null, 2)
    return summary
      ? `${header}\n${summary}\n\n${pretty}`
      : `${header}\n${pretty}`
  } catch {
    return `${header}\n${raw}`
  }
}

function pickErrorSummary(parsed: Record<string, unknown>): string | undefined {
  if (typeof parsed.error === 'string' && parsed.error.trim()) {
    return parsed.error.trim()
  }
  const nested = parsed.error
  if (nested && typeof nested === 'object') {
    const errObj = nested as { message?: unknown; code?: unknown; type?: unknown }
    const parts = [errObj.message, errObj.code, errObj.type]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map((v) => v.trim())
    if (parts.length) return parts.join(' · ')
  }
  if (typeof parsed.message === 'string' && parsed.message.trim()) {
    return parsed.message.trim()
  }
  if (typeof parsed.detail === 'string' && parsed.detail.trim()) {
    // detail may itself be a JSON string from the upstream provider
    const detail = parsed.detail.trim()
    try {
      const inner = JSON.parse(detail) as Record<string, unknown>
      const innerSummary = pickErrorSummary(inner)
      if (innerSummary) return innerSummary
    } catch {
      // keep raw detail below
    }
    return detail.slice(0, 240)
  }
  return undefined
}

/**
 * Ask the toy to reply. Tries Pages Function `/api/chat` (OPENAI_* secrets),
 * falls back to local persona templates. On remote failure, includes apiError
 * with the HTTP status and response body so the UI can surface it.
 */
export async function chatToyReply(
  input: ChatToyReplyInput,
): Promise<ChatToyReplyResult> {
  const message = input.message.trim()
  if (!message) {
    return {
      reply: localPersonaReply(input.toy, input.message, input.entries),
      source: 'local',
    }
  }

  let apiError: ChatApiError | undefined

  if (CHAT_ENDPOINT) {
    try {
      const memories = (input.entries ?? []).slice(0, 6).map((e) => ({
        title: e.title,
        location: e.location,
        date: e.date,
        note: e.userNote,
      }))

      const history = (input.history ?? [])
        .filter((t) => t.text?.trim())
        .slice(-12)
        .map((t) => ({ role: t.role, text: t.text.trim() }))

      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toy: {
            name: input.toy.name,
            role: input.toy.role,
            traits: input.toy.traits,
            bio: input.toy.bio,
            monologue: input.toy.monologue,
          },
          message,
          history,
          memories,
          quietMode: input.quietMode,
        }),
      })

      const rawBody = await response.text().catch(() => '')

      if (!response.ok) {
        apiError = {
          status: response.status,
          body: rawBody.slice(0, 2000) || `Chat HTTP ${response.status}`,
        }
      } else {
        let data: { reply?: string; error?: string; detail?: string } = {}
        try {
          data = rawBody ? (JSON.parse(rawBody) as typeof data) : {}
        } catch {
          apiError = {
            status: response.status,
            body: rawBody.slice(0, 2000) || 'Invalid JSON response',
          }
        }

        if (!apiError) {
          const reply = data.reply?.trim()
          if (reply) return { reply, source: 'api' }
          apiError = {
            status: response.status,
            body:
              rawBody.slice(0, 2000) ||
              JSON.stringify({
                error: data.error || 'Empty AI reply',
                detail: data.detail,
              }),
          }
        }
      }
    } catch (err) {
      apiError = {
        status: 0,
        body: err instanceof Error ? err.message : String(err),
      }
    }
  }

  return {
    reply: localPersonaReply(input.toy, message, input.entries),
    source: 'local',
    apiError,
  }
}
