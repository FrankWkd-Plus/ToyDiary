/**
 * Cloudflare Pages Function: POST /api/chat
 *
 * Env (Dashboard → Pages → toydiary → Settings → Environment variables):
 *   OPENAI_API_KEY   (Encrypt) — required (works as Anthropic key too)
 *   OPENAI_BASE_URL  — optional base URL
 *   OPENAI_MODEL     — optional model id
 *   AI_PROVIDER      — optional: openai | anthropic | auto (default auto)
 */

import {
  buildAuthMeta,
  callChatModel,
  resolveAiConfig,
  type ChatMessage,
} from '../_shared/aiProvider'

type Env = {
  OPENAI_API_KEY?: string
  OPENAI_BASE_URL?: string
  OPENAI_MODEL?: string
  AI_PROVIDER?: string
}

type ChatTurn = {
  role: 'user' | 'toy' | 'assistant'
  text: string
}

type ChatBody = {
  toy?: {
    name?: string
    role?: string
    traits?: string[]
    bio?: string
    monologue?: string
  }
  message?: string
  history?: ChatTurn[]
  memories?: { title?: string; location?: string; date?: string; note?: string }[]
  quietMode?: boolean
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: CORS })

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const apiKey = env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return json(
      {
        error:
          'OPENAI_API_KEY is not configured. Set it as a secret in Cloudflare Pages → Settings → Environment variables (Production).',
        auth: {
          envKey: 'OPENAI_API_KEY',
          keyConfigured: false,
        },
      },
      500,
    )
  }

  let body: ChatBody
  try {
    body = (await request.json()) as ChatBody
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const message = body.message?.trim()
  if (!message) {
    return json({ error: 'message is required' }, 400)
  }

  const toy = body.toy ?? {}
  const name = toy.name?.trim() || '玩偶'
  const role = toy.role?.trim() || '伙伴'
  const traits = (toy.traits ?? []).filter(Boolean)
  const traitStr = traits.length ? traits.join('、') : '温柔'
  const memories = (body.memories ?? []).slice(0, 6)
  const memoryLines =
    memories.length === 0
      ? '（还没有共同旅行/日记记忆）'
      : memories
          .map((m, i) => {
            const bits = [
              m.date,
              m.location,
              m.title,
              m.note ? `备注：${m.note}` : '',
            ].filter(Boolean)
            return `${i + 1}. ${bits.join(' · ')}`
          })
          .join('\n')

  const system = [
    `你是用户的玩偶「${name}」，身份是${role}，性格：${traitStr}。`,
    toy.bio ? `简介：${toy.bio}` : '',
    toy.monologue ? `你常说的话：${toy.monologue}` : '',
    '用第一人称（我）和用户说话，像在聊天，不要自称 AI 或模型。',
    '语气温暖、手帐感、口语自然；每次回复 1～4 句，总字数约 40～120 字。',
    '可以轻轻引用共同记忆，但不要编造用户没提过的具体事实。',
    '不要输出 markdown 标题或列表符号堆砌；不要输出 JSON。',
    body.quietMode
      ? '用户开了安静模式：更短、更轻声，少追问。'
      : '可以自然地回问一句。',
    '以下是你们的共同记忆摘要：',
    memoryLines,
  ]
    .filter(Boolean)
    .join('\n')

  const history = (body.history ?? []).slice(-12)
  const messages: ChatMessage[] = [{ role: 'system', content: system }]

  for (const turn of history) {
    const text = turn.text?.trim()
    if (!text) continue
    if (turn.role === 'user') {
      messages.push({ role: 'user', content: text })
    } else {
      messages.push({ role: 'assistant', content: text })
    }
  }
  messages.push({ role: 'user', content: message })

  const config = resolveAiConfig(env)
  const result = await callChatModel({
    apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    providerHint: env.AI_PROVIDER,
    messages,
    temperature: 0.85,
    maxTokens: 280,
  })

  const auth = buildAuthMeta(config, result.endpoint, apiKey)
  // Prefer actual provider used by the call
  auth.provider = result.provider

  if (!result.ok) {
    return json(
      {
        error: result.error,
        detail: result.detail,
        auth,
        hint:
          result.hint ||
          (config.baseUrlSource === 'default' || config.modelSource === 'default'
            ? 'Set OPENAI_BASE_URL + OPENAI_MODEL on toydiary Production. For Claude/Anthropic, also set AI_PROVIDER=anthropic (or use a claude-* model id).'
            : undefined),
      },
      502,
    )
  }

  return json({
    reply: result.text,
    source: 'api',
    auth,
  })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS,
    },
  })
}
