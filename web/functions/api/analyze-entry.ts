/**
 * Cloudflare Pages Function: POST /api/analyze-entry
 *
 * Uses the Workers AI binding declared in web/wrangler.jsonc. No external
 * API key or gateway is involved.
 */

import { json, preflight } from '../_shared/http'
import type { PagesContext } from '../_shared/types'
import {
  parseJsonObject,
  runWorkersAi,
  type AiEnv,
  type ChatMessage,
} from '../_shared/workersAi'

type Env = AiEnv

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
  hasPhoto?: boolean
  /** Neutral client-side colour observation; never a scene classification. */
  imageToneDescription?: string
  /** 'zh' | 'en' — language for generated diary copy */
  locale?: string
  language?: string
}

const MAX_NOTE_CHARS = 2000
const MAX_LOCATION_CHARS = 200

const ENTRY_TYPES = ['travel', 'daily', 'memorial', 'text'] as const
type EntryType = (typeof ENTRY_TYPES)[number]

const REPAIR_SYSTEM = [
  'You repair malformed JSON.',
  'Return ONLY one valid JSON object with these fields:',
  'title (string), aiDiary (string), toyReply (string), mood (string),',
  'tags (string[]), imageAnalysis (string),',
  'entryType ("travel" | "daily" | "memorial" | "text").',
  'No markdown code fences. No commentary. Do not show reasoning.',
].join('\n')

export async function onRequestOptions(): Promise<Response> {
  return preflight()
}

function resolveLocale(body: AnalyzeBody): 'zh' | 'en' {
  const raw = (body.locale || body.language || '').toLowerCase()
  if (raw.startsWith('en')) return 'en'
  if (raw.startsWith('zh')) return 'zh'
  return 'zh'
}

export async function onRequestPost(
  context: PagesContext<Env>,
): Promise<Response> {
  const { request, env } = context

  let body: AnalyzeBody
  try {
    body = (await request.json()) as AnalyzeBody
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const locale = resolveLocale(body)
  const isEn = locale === 'en'

  const toy = body.toy ?? {}
  const name = toy.name?.trim() || (isEn ? 'Toy' : '玩偶')
  const role = toy.role?.trim() || (isEn ? 'companion' : '伙伴')
  const traits = (toy.traits ?? []).filter(Boolean)
  const traitStr = traits.length
    ? traits.join(isEn ? ', ' : '、')
    : isEn
      ? 'gentle'
      : '温柔'
  const date = body.date?.trim() || new Date().toISOString().slice(0, 10)
  const location = body.location?.trim().slice(0, MAX_LOCATION_CHARS)
  const userNote = body.userNote?.trim().slice(0, MAX_NOTE_CHARS)
  const hasPhoto = body.hasPhoto === true
  const imageToneDescription = body.imageToneDescription?.trim()

  const system = isEn
    ? [
        "You are the copywriter for Toy Diary, writing growth journal entries for the user's toy companion.",
        'IMPORTANT: Write all user-facing text in natural English.',
        'Output only one JSON object. No markdown code fences. No extra commentary.',
        'JSON fields:',
        'title: string (short title in English, ≤12 words)',
        'aiDiary: string (first-person diary from the toy, English, 2-4 short paragraphs, use \\n for line breaks)',
        'toyReply: string (one warm sentence said to the user before saving, English)',
        'mood: string (one English mood word, e.g. gentle / happy / calm / curious)',
        'tags: string[] (1-4 short English tags)',
        'imageAnalysis: string (OPTIONAL garnish: only ONE short sentence about photo colour/lighting when it genuinely adds atmosphere; return empty string in most cases)',
        'entryType: "travel" | "daily" | "memorial" | "text"',
        "Match the toy's personality. Keep the tone warm and diary-like, not template-y.",
        'Do not show your reasoning and never emit think tags — output only the JSON object.',
        'GROUNDING: Treat only the owner note, selected location, date and type as event facts.',
        'Never infer sunset, evening, night, beach, outdoors, weather, objects or a place from colour tone alone.',
        'Colour and lighting are an occasional garnish only — do NOT describe the photo colour tone in every diary entry; spend the words on the story and feelings of this moment.',
        'If the owner did not describe a scene, use a neutral title and neutral wording about this moment.',
      ].join('\n')
    : [
        '你是 Toy Diary 的文案助手，为用户的玩偶生成成长手帐。',
        '重要：所有面向用户的文案必须用自然流畅的中文。',
        '必须只输出一个 JSON 对象，不要 markdown 代码块，不要其它说明。',
        'JSON 字段：',
        'title: string（短标题，中文，≤20字）',
        'aiDiary: string（玩偶第一人称日记，中文，2-4 短段，可用 \\n 换行）',
        'toyReply: string（保存前对用户说的一句话，中文）',
        'mood: string（一个中文心情词，如 温柔/开心/平静/好奇）',
        'tags: string[]（1-4 个中文标签）',
        'imageAnalysis: string（可选点缀：仅当照片色调/光线确实为这篇日记增添氛围时写一句；大多数情况返回空字符串）',
        'entryType: "travel" | "daily" | "memorial" | "text"',
        '口吻要贴合玩偶性格，温暖、手帐感，不要模板腔。',
        '不要展示思考过程，不要输出 think 标签，只输出最终 JSON。',
        '事实约束：只有用户备注、主动选择的地点、日期和类型可以作为事件事实。',
        '禁止仅凭暖色、暗色、蓝色或绿色推断日落、傍晚、夜晚、海边、户外、天气、物体或地点。',
        '色调与光线只是偶尔的点缀——不要每篇日记都例行描述照片的色调，把笔墨放在这一刻的故事和感受上。',
        '用户没有说明具体场景时，标题和正文必须使用“这一刻”等中性表达。',
      ].join('\n')

  const textBrief = isEn
    ? [
        `Toy name: ${name}`,
        `Role: ${role}`,
        `Traits: ${traitStr}`,
        toy.bio ? `Bio: ${toy.bio}` : '',
        toy.monologue ? `Monologue: ${toy.monologue}` : '',
        `Date: ${date}`,
        location ? `Location: ${location}` : '',
        userNote ? `Owner note: ${userNote}` : 'No owner note.',
        hasPhoto
          ? `A photo is attached. Tone impression is for atmosphere reference only (${imageToneDescription || 'none'}); do not put it into the diary body unless it truly enhances the mood.`
          : 'No photo attached.',
      ]
        .filter(Boolean)
        .join('\n')
    : [
        `玩偶名：${name}`,
        `身份：${role}`,
        `性格：${traitStr}`,
        toy.bio ? `简介：${toy.bio}` : '',
        toy.monologue ? `独白：${toy.monologue}` : '',
        `日期：${date}`,
        location ? `地点：${location}` : '',
        userNote ? `主人备注：${userNote}` : '主人未写备注',
        hasPhoto
          ? `用户附带了一张照片。色调印象仅供参考氛围（${imageToneDescription || '无'}），不必写进正文，除非确实为氛围加分。`
          : '没有照片。',
      ]
        .filter(Boolean)
        .join('\n')

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: textBrief },
  ]

  const result = await runWorkersAi(env, {
    messages,
    temperature: 0.8,
    maxTokens: 1100,
    timeoutMs: 22_000,
  })

  if (!result.ok) {
    return json(
      {
        error: result.error,
        detail: result.detail,
        hint: result.hint,
        triedModels: result.triedModels,
        auth: {
          provider: 'workers-ai',
          binding: 'AI',
          configured: Boolean(env.AI),
        },
      },
      env.AI ? 502 : 503,
    )
  }

  let parsed = parseJsonObject(result.text)

  // Smaller models occasionally wrap JSON in prose. One cheap repair attempt
  // is much better than dropping the whole diary back to the local template.
  if (!parsed) {
    const repair = await runWorkersAi(env, {
      messages: [
        { role: 'system', content: REPAIR_SYSTEM },
        {
          role: 'user',
          content: `Convert this output into valid JSON:\n\n${result.text.slice(0, 6000)}`,
        },
      ],
      temperature: 0.2,
      maxTokens: 1100,
      timeoutMs: 22_000,
    })
    if (repair.ok) parsed = parseJsonObject(repair.text)
  }

  if (!parsed) {
    return json(
      {
        error: 'AI response is not valid JSON',
        detail: result.text.slice(0, 400),
        auth: {
          provider: 'workers-ai',
          binding: 'AI',
          model: result.model,
          configured: true,
        },
      },
      502,
    )
  }

  const title = asText(parsed.title)
  const aiDiary = asText(parsed.aiDiary)
  if (!title || !aiDiary) {
    return json(
      {
        error: 'AI response missing title or aiDiary',
        detail: result.text.slice(0, 400),
        auth: {
          provider: 'workers-ai',
          binding: 'AI',
          model: result.model,
          configured: true,
        },
      },
      502,
    )
  }

  const entryTypeRaw = asText(parsed.entryType).toLowerCase()
  const entryType: EntryType = ENTRY_TYPES.includes(entryTypeRaw as EntryType)
    ? (entryTypeRaw as EntryType)
    : 'daily'

  const tags = normalizeTags(parsed.tags)

  const defaultReply = isEn
    ? 'I wrote this moment down and will keep it safe in our growth journal.'
    : '我已经把这一刻写下来啦，会好好放进我们的成长里。'
  const defaultMood = isEn ? 'gentle' : '温柔'

  return json({
    title,
    aiDiary,
    toyReply: asText(parsed.toyReply) || defaultReply,
    mood: asText(parsed.mood) || defaultMood,
    tags,
    imageAnalysis: hasPhoto
      ? imageToneDescription ||
        (isEn
          ? 'The photo keeps a shared moment without making a scene assumption.'
          : '照片记录了一个共同瞬间，不对具体场景作推断。')
      : '',
    entryType,
    auth: {
      provider: 'workers-ai',
      binding: 'AI',
      model: result.model,
      configured: true,
    },
  })
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) {
    return value.map((part) => asText(part)).filter(Boolean).join('\n')
  }
  if (value && typeof value === 'object') {
    const text = (value as Record<string, unknown>).text
    if (typeof text === 'string') return text.trim()
  }
  return ''
}

function normalizeTags(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，、\s]+/)
      : []
  return raw
    .map((tag) => asText(tag))
    .filter(Boolean)
    .slice(0, 4)
}
