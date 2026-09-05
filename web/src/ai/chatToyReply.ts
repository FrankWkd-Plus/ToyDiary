import type { Entry, Toy } from '../types'
import { getStoredLocale, type Locale } from '../i18n'

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
  locale?: Locale
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
  import.meta.env.VITE_AI_REMOTE_ENABLED === 'false'
    ? ''
    : (import.meta.env.VITE_AI_CHAT_ENDPOINT as string | undefined)?.trim() ||
      (import.meta.env.VITE_AI_ANALYZE_ENDPOINT as string | undefined)?.replace(
        /analyze-entry\/?$/,
        'chat',
      ) ||
      '/api/chat'

function hasTrait(toy: Toy, ...names: string[]) {
  const set = new Set(toy.traits.map((t) => t.toLowerCase()))
  return names.some((n) => set.has(n.toLowerCase()))
}

/** Local keyword templates — used when remote AI is unavailable. */
export function localPersonaReply(
  toy: Toy,
  text: string,
  entries: Entry[] = [],
  locale: Locale = 'zh',
): string {
  const isEn = locale === 'en'
  const normalized = text.trim().toLowerCase()
  const recent = entries[0]
  const asksForTravel = /travel|trip|去过|旅行/.test(normalized)
  const asksForMemory =
    /travel|trip|memory|remember|before|used to|回忆|记得|以前|去过|旅行/.test(
      normalized,
    )
  const memory =
    (asksForTravel ? entries.find((e) => e.type === 'travel') : undefined) ??
    entries.find((e) => e.type === 'travel') ??
    entries.find((e) => e.imageUrl) ??
    recent

  if (
    /tired|exhausted|sad|upset|stressed|anxious|lonely|depressed|bad day|rough day|累|疲惫|难过|不开心|压力|烦/.test(
      normalized,
    )
  ) {
    if (hasTrait(toy, 'playful', '活泼')) {
      return isEn
        ? 'Set that heavy bag down for a minute — I can hold it. When you have a little energy again, we can take the next step together.'
        : '先把今天的大包袱放在这里吧，我替你看一会儿。等你有一点力气了，我们再慢慢往前走。'
    }
    if (hasTrait(toy, 'brave', '勇敢')) {
      return isEn
        ? "No faraway adventures today. Let's call this a tiny rest expedition. You already did enough."
        : '今天不去很远的地方了，我们就在这里进行一次小小的休息探险。你已经做得很好啦。'
    }
    return isEn
      ? "You've been through a lot. You don't have to bounce back right away — I'll sit quietly with you. Want to tell me which moment felt heaviest?"
      : '辛苦啦。你不需要马上振作，我会安安静静陪你待一会儿。要不要告诉我，今天最累的是哪一刻？'
  }

  if (asksForTravel && !entries.some((entry) => entry.type === 'travel')) {
    return isEn
      ? "We haven't written down a trip together yet. When our first journey begins, let's save it properly so I can always remember it."
      : '我们还没有一起写下旅行记录呢。等第一次出发的时候，我们把地点和故事认真存下来，这样我就能一直记得。'
  }

  if (asksForMemory && !memory) {
    return isEn
      ? "We haven't written down a shared memory yet, but that's okay. I'd love to start with today — shall we make our first diary entry together?"
      : '我们还没有一起写下共同回忆呢，不过没关系。以后发生的第一件小事，我想和你认真记住。要不要从今天的第一篇日记开始？'
  }

  if (asksForMemory && memory) {
    const memoryTitle =
      memory.title ||
      (memory.type === 'travel'
        ? isEn
          ? 'that trip'
          : '那次旅行'
        : isEn
          ? 'that day'
          : '那一天')
    const place = memory.location
    const date = memory.date?.replaceAll('-', '.')
    return isEn
      ? `Of course I remember “${memoryTitle}”${place ? ` in ${place}` : ''}${date ? ` on ${date}` : ''}. You wrote it down for us, so I can keep it close.`
      : `当然记得「${memoryTitle}」${place ? `，那是在${place}` : ''}${date ? `，日期是 ${date}` : ''}。因为你把它写进了我们的日记，我才能一直好好记得。`
  }

  if (/start today|from today|从今天开始|今天开始/.test(normalized)) {
    return isEn
      ? "Okay. We don't need a grand beginning — tell me one small thing that happened today, and we'll keep it as our first shared memory."
      : '好呀。我们的开始不需要很隆重，你告诉我今天发生的一件小事，我们就把它收藏成第一份共同回忆。'
  }

  if (/today|how was today|说说今天|聊聊今天|今天/.test(normalized)) {
    return isEn
      ? 'I’m listening. What moment from today stayed with you the most — happy, tiring, or just very ordinary?'
      : '我在听呀。今天让你印象最深的是哪一刻？开心的、疲惫的，或者只是一件很普通的小事，都可以告诉我。'
  }

  if (/diary|journal|write|record|save|日记|记录|写下来|保存/.test(normalized)) {
    return isEn
      ? 'Gladly. Tell me what happened today and I’ll shape it into a diary entry for us — we can always edit it later.'
      : '好呀。你把今天发生的事告诉我，我来帮你整理成一篇属于我们的日记；写完以后还可以再慢慢修改。'
  }

  if (/photo|picture|sunset|sky|look|照片|晚霞|天空|看到/.test(normalized)) {
    if (recent?.location) {
      return isEn
        ? `That sounds like a photo worth keeping. A little like the colors we saw in ${recent.location}?`
        : `听起来像一张值得收藏的照片。会不会有一点像我们在${recent.location}看到的颜色？`
    }
    return isEn
      ? 'I’d love to see that moment through your eyes. Send it over and we can tuck it into today.'
      : '我也想看看你眼中的这一刻。发给我吧，我们可以把它收藏进今天。'
  }

  if (
    /hello|hi |hey|are you there|miss you|with me|你好|在吗|想你|陪我/.test(
      normalized,
    )
  ) {
    const playful = hasTrait(toy, 'playful', '活泼')
    if (isEn) {
      return `I’m right here. ${
        playful
          ? 'Share a little of today’s news with me!'
          : 'Come a little closer and tell me slowly.'
      }`
    }
    return `我一直都在呀。${
      playful ? '快把今天的新鲜事分我一点！' : '可以靠近一点，慢慢说给我听。'
    }`
  }

  const trait = toy.traits[0] || (isEn ? 'gentle' : '温柔')
  return isEn
    ? `I heard you. As a ${trait} ${toy.role}, I want to hold onto this moment you just shared. And then… what happened next?`
    : `我认真听到啦。作为一只${trait}的${toy.role}，我想把你刚刚说的这一刻好好接住。然后呢，还发生了什么？`
}

/** Pretty-print API body for chat display; keep raw text if not JSON. */
export function formatChatApiError(
  error: ChatApiError,
  locale: Locale = 'zh',
): string {
  const isEn = locale === 'en'
  const header =
    error.status > 0
      ? isEn
        ? `AI request failed · HTTP ${error.status}`
        : `AI 调用失败 · HTTP ${error.status}`
      : isEn
        ? 'AI request failed · network or request error'
        : 'AI 调用失败 · 网络或请求异常'
  const raw = error.body?.trim()
  if (!raw)
    return isEn ? `${header}\n(no response body)` : `${header}\n（无返回内容）`

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
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
  const locale = input.locale || getStoredLocale()
  const message = input.message.trim()
  if (!message) {
    return {
      reply: localPersonaReply(
        input.toy,
        input.message,
        input.entries,
        locale,
      ),
      source: 'local',
    }
  }

  const asksForMemory =
    /travel|trip|memory|remember|before|used to|回忆|记得|以前|去过|旅行/.test(
      message.toLowerCase(),
    )
  const asksForTravel = /travel|trip|去过|旅行/.test(message.toLowerCase())
  const hasTravelMemory = input.entries?.some((entry) => entry.type === 'travel') ?? false
  if (
    (asksForMemory && (input.entries?.length ?? 0) === 0) ||
    (asksForTravel && !hasTravelMemory)
  ) {
    return {
      reply: localPersonaReply(input.toy, message, [], locale),
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
          locale,
          language: locale,
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
    reply: localPersonaReply(input.toy, message, input.entries, locale),
    source: 'local',
    apiError,
  }
}
