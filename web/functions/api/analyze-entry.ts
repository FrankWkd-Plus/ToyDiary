/**
 * Cloudflare Pages Function: POST /api/analyze-entry
 *
 * Env (Dashboard → Pages → toydiary → Settings → Environment variables):
 *   OPENAI_API_KEY   (Encrypt / secret)  — required
 *   OPENAI_BASE_URL  (plain or secret)   — optional
 *   OPENAI_MODEL     (plain)             — optional
 *   AI_PROVIDER      — optional: openai | anthropic | auto (default auto)
 *
 * Do NOT put the API key in any VITE_* variable (those are public in the browser).
 */

import {
  buildAuthMeta,
  callChatModel,
  resolveAiConfig,
  type ChatMessage,
  type ContentPart,
} from '../_shared/aiProvider'

type Env = {
  OPENAI_API_KEY?: string
  OPENAI_BASE_URL?: string
  OPENAI_MODEL?: string
  AI_PROVIDER?: string
}

type AnalyzeBody = {
  toy?: {
    name?: string
    role?: string
    traits?: string[]
    bio?: string
    monologue?: string
  }
  date?: string
  location?: string
  userNote?: string
  imageDataUrl?: string
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
          'OPENAI_API_KEY is not configured. Set it as a secret in Cloudflare Pages.',
      },
      500,
    )
  }

  let body: AnalyzeBody
  try {
    body = (await request.json()) as AnalyzeBody
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const toy = body.toy ?? {}
  const name = toy.name?.trim() || '玩偶'
  const role = toy.role?.trim() || '伙伴'
  const traits = (toy.traits ?? []).filter(Boolean)
  const traitStr = traits.length ? traits.join('、') : '温柔'
  const date = body.date?.trim() || new Date().toISOString().slice(0, 10)
  const location = body.location?.trim()
  const userNote = body.userNote?.trim()
  const imageDataUrl = body.imageDataUrl?.trim()

  const system = [
    '你是 Toy Dairy 的文案助手，为用户的玩偶生成成长手帐。',
    '必须只输出一个 JSON 对象，不要 markdown 代码块，不要其它说明。',
    'JSON 字段：',
    'title: string（短标题，中文，≤20字）',
    'aiDiary: string（玩偶第一人称日记，中文，2-4 短段，可用 \\n 换行）',
    'toyReply: string（保存前对用户说的一句话，中文）',
    'mood: string（一个中文心情词，如 温柔/开心/平静/好奇）',
    'tags: string[]（1-4 个中文标签）',
    'imageAnalysis: string（若有图则简述画面，否则空字符串）',
    'entryType: "travel" | "daily" | "memorial" | "text"',
    '口吻要贴合玩偶性格，温暖、手帐感，不要模板腔。',
  ].join('\n')

  const textBrief = [
    `玩偶名：${name}`,
    `身份：${role}`,
    `性格：${traitStr}`,
    toy.bio ? `简介：${toy.bio}` : '',
    toy.monologue ? `独白：${toy.monologue}` : '',
    `日期：${date}`,
    location ? `地点：${location}` : '',
    userNote ? `主人备注：${userNote}` : '主人未写备注',
    imageDataUrl ? '用户附带了一张照片，请结合画面。' : '没有照片。',
  ]
    .filter(Boolean)
    .join('\n')

  const userContent: ContentPart[] = [{ type: 'text', text: textBrief }]
  if (imageDataUrl?.startsWith('data:image/')) {
    userContent.push({
      type: 'image_url',
      image_url: { url: imageDataUrl },
    })
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: userContent },
  ]

  const config = resolveAiConfig(env)
  const result = await callChatModel({
    apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    providerHint: env.AI_PROVIDER,
    messages,
    temperature: 0.8,
    maxTokens: 900,
    // Only applied on OpenAI path; Anthropic is instructed via system prompt.
    jsonObject: true,
  })

  const auth = buildAuthMeta(config, result.endpoint, apiKey)
  auth.provider = result.provider

  if (!result.ok) {
    return json(
      {
        error: result.error,
        detail: result.detail,
        auth,
        hint: result.hint,
      },
      502,
    )
  }

  const rawContent = result.text
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(stripCodeFence(rawContent)) as Record<string, unknown>
  } catch {
    return json(
      {
        error: 'AI response is not valid JSON',
        detail: rawContent.slice(0, 400),
        auth,
      },
      502,
    )
  }

  const title = String(parsed.title ?? '').trim()
  const aiDiary = String(parsed.aiDiary ?? '').trim()
  if (!title || !aiDiary) {
    return json(
      {
        error: 'AI response missing title or aiDiary',
        detail: rawContent.slice(0, 400),
        auth,
      },
      502,
    )
  }

  const entryTypeRaw = String(parsed.entryType ?? 'daily')
  const entryType = (['travel', 'daily', 'memorial', 'text'] as const).includes(
    entryTypeRaw as 'travel',
  )
    ? entryTypeRaw
    : 'daily'

  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 4)
    : []

  return json({
    title,
    aiDiary,
    toyReply:
      String(parsed.toyReply ?? '').trim() ||
      `我已经把这一刻写下来啦，会好好放进我们的成长里。`,
    mood: String(parsed.mood ?? '温柔').trim() || '温柔',
    tags,
    imageAnalysis: String(parsed.imageAnalysis ?? '').trim(),
    entryType,
    auth,
  })
}

function stripCodeFence(text: string) {
  const trimmed = text.trim()
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return match ? match[1].trim() : trimmed
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
