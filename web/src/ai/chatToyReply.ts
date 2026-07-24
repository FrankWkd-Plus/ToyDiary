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

export interface ChatToyReplyResult {
  reply: string
  source: 'api' | 'local'
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

/**
 * Ask the toy to reply. Tries Pages Function `/api/chat` (OPENAI_* secrets),
 * falls back to local persona templates.
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

      if (!response.ok) throw new Error(`Chat HTTP ${response.status}`)
      const data = (await response.json()) as { reply?: string }
      const reply = data.reply?.trim()
      if (reply) return { reply, source: 'api' }
    } catch {
      // fall through to local
    }
  }

  return {
    reply: localPersonaReply(input.toy, message, input.entries),
    source: 'local',
  }
}
