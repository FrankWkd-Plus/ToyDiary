/**
 * Cloudflare Pages Function: POST /api/analyze-entry
 *
 * Secrets (Dashboard → Pages → toydairy → Settings → Environment variables):
 *   OPENAI_API_KEY   (Encrypt / secret)  — required
 *   OPENAI_BASE_URL  (plain or secret)   — optional, default https://api.openai.com/v1
 *   OPENAI_MODEL     (plain)             — optional, default gpt-4o-mini
 *
 * Do NOT put the API key in any VITE_* variable (those are public in the browser).
 */

type Env = {
  OPENAI_API_KEY?: string
  OPENAI_BASE_URL?: string
  OPENAI_MODEL?: string
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

  type ContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }

  const userContent: ContentPart[] = [{ type: 'text', text: textBrief }]
  if (imageDataUrl?.startsWith('data:image/')) {
    userContent.push({
      type: 'image_url',
      image_url: { url: imageDataUrl },
    })
  }

  const configuredBaseUrl = env.OPENAI_BASE_URL?.trim()
  const configuredModel = env.OPENAI_MODEL?.trim()
  const baseUrl = (configuredBaseUrl || 'https://api.openai.com/v1').replace(
    /\/$/,
    '',
  )
  const model = configuredModel || 'gpt-4o-mini'
  const authMeta = {
    envKey: 'OPENAI_API_KEY',
    projectHint: 'Cloudflare Pages project: toydiary (Production env vars)',
    baseUrl,
    model,
    baseUrlSource: configuredBaseUrl ? 'env:OPENAI_BASE_URL' : 'default',
    modelSource: configuredModel ? 'env:OPENAI_MODEL' : 'default',
    keyConfigured: true as const,
  }

  let upstream: Response
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
      }),
    })
  } catch (err) {
    return json(
      {
        error: 'Failed to reach AI provider',
        detail: err instanceof Error ? err.message : String(err),
        auth: authMeta,
      },
      502,
    )
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    return json(
      {
        error: `AI provider HTTP ${upstream.status}`,
        detail: detail.slice(0, 800),
        auth: authMeta,
        hint:
          authMeta.baseUrlSource === 'default' ||
          authMeta.modelSource === 'default'
            ? 'OPENAI_BASE_URL / OPENAI_MODEL not set on Pages Production — using code defaults (api.openai.com + gpt-4o-mini). Set them under project toydiary → Settings → Environment variables (Production).'
            : undefined,
      },
      502,
    )
  }

  let rawContent = ''
  try {
    const data = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    rawContent = data.choices?.[0]?.message?.content?.trim() || ''
  } catch {
    return json({ error: 'Invalid AI provider response' }, 502)
  }

  if (!rawContent) {
    return json({ error: 'Empty AI response' }, 502)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(stripCodeFence(rawContent)) as Record<string, unknown>
  } catch {
    return json({ error: 'AI response is not valid JSON', detail: rawContent.slice(0, 400) }, 502)
  }

  const title = String(parsed.title ?? '').trim()
  const aiDiary = String(parsed.aiDiary ?? '').trim()
  if (!title || !aiDiary) {
    return json({ error: 'AI response missing title or aiDiary' }, 502)
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
