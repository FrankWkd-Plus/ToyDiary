import type { EntryType, Toy } from '../types'
import { getStoredLocale, type Locale } from '../i18n'

export interface AnalyzeEntryInput {
  toy: Toy
  date: string
  location?: string
  userNote?: string
  imageUrl?: string
  locale?: Locale
}

export interface EntryAnalysis {
  title: string
  aiDiary: string
  toyReply: string
  mood: string
  tags: string[]
  imageAnalysis?: string
  entryType: EntryType
  processedImageUrl?: string
  source: 'api' | 'local'
}

interface ImageSignals {
  description: string
}

/** Default to Pages Function; override with VITE_AI_ANALYZE_ENDPOINT if needed. */
const AI_ENDPOINT =
  (import.meta.env.VITE_AI_ANALYZE_ENDPOINT as string | undefined)?.trim() ||
  '/api/analyze-entry'
const REMOTE_AI_ENABLED = import.meta.env.VITE_AI_REMOTE_ENABLED !== 'false'

const AI_TIMEOUT_MS = 28_000

export async function analyzeEntry(
  input: AnalyzeEntryInput,
): Promise<EntryAnalysis> {
  const locale = input.locale || getStoredLocale()
  const isEn = locale === 'en'
  // blob: / data: are fine without CORS; remote http needs anonymous for canvas
  const processedImageUrl = input.imageUrl
    ? await compressImage(input.imageUrl).catch(() => input.imageUrl)
    : undefined
  const imageSignals = processedImageUrl
    ? await analyzeImagePalette(processedImageUrl, locale).catch(() => undefined)
    : undefined

  if (!REMOTE_AI_ENABLED) {
    return generateLocalAnalysis(input, imageSignals, processedImageUrl, locale)
  }

  try {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          toy: {
            name: input.toy.name,
            role: input.toy.role,
            traits: input.toy.traits,
            bio: input.toy.bio,
            monologue: input.toy.monologue,
          },
          date: input.date,
          location: input.location,
          userNote: input.userNote,
          locale,
          language: locale,
          // MVP safety: the server receives only a neutral palette observation,
          // never the image itself. Colour must not be treated as scene facts.
          hasPhoto: Boolean(input.imageUrl),
          imageToneDescription: imageSignals?.description,
        }),
      })
    } finally {
      window.clearTimeout(timeout)
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(errText || `AI HTTP ${response.status}`)
    }
    const result = (await response.json()) as Partial<EntryAnalysis> & {
      error?: string
    }
    if (result.error) throw new Error(result.error)
    if (!result.title?.trim() || !result.aiDiary?.trim()) {
      throw new Error(
        isEn ? 'AI response incomplete' : 'AI 返回内容不完整',
      )
    }
    const grounded = generateLocalAnalysis(
      input,
      imageSignals,
      processedImageUrl,
      locale,
    )
    return {
      // Titles, tags and image descriptions stay evidence-based even when a
      // remote model writes the warmer long-form toy diary.
      title: grounded.title,
      aiDiary: result.aiDiary.trim(),
      toyReply:
        result.toyReply?.trim() ||
        (isEn
          ? 'I wrote this moment down and will keep it safe in our growth journal.'
          : '我已经把这一刻写下来啦，会好好放进我们的成长里。'),
      mood: result.mood?.trim() || (isEn ? 'gentle' : '温柔'),
      tags: grounded.tags,
      imageAnalysis: grounded.imageAnalysis,
      entryType: result.entryType || inferEntryType(input),
      processedImageUrl: processedImageUrl || input.imageUrl,
      source: 'api',
    }
  } catch (err) {
    // Local template keeps the flow usable offline / without keys / on timeout.
    console.warn('[analyzeEntry] remote failed, using local:', err)
  }

  return generateLocalAnalysis(input, imageSignals, processedImageUrl, locale)
}

function hasTrait(toy: Toy, ...names: string[]) {
  const set = new Set(toy.traits.map((t) => t.toLowerCase()))
  return names.some((n) => set.has(n.toLowerCase()))
}

function generateLocalAnalysis(
  input: AnalyzeEntryInput,
  imageSignals: ImageSignals | undefined,
  processedImageUrl: string | undefined,
  locale: Locale,
): EntryAnalysis {
  const isEn = locale === 'en'
  const note = input.userNote?.trim() || ''
  const explicitScene = inferSceneFromText(note, input.location)
  const scene =
    explicitScene ||
    (note ? (isEn ? "today's story" : '今天的故事') : isEn ? 'this moment' : '这一刻')
  const needsComfort =
    /sad|upset|tired|exhausted|stressed|anxious|lonely|depressed|bad day|rough day|心情不好|不开心|难过|疲惫|好累|很累|压力|焦虑|烦|孤单/i.test(
      note,
    )
  const isHappy =
    /happy|glad|excited|joy|love|wonderful|great|开心|快乐|惊喜|兴奋|幸福|好喜欢/i.test(
      note,
    )
  const toyName = shortToyName(input.toy.name)
  const scenePhrase =
    scene === 'this moment' || scene === '这一刻'
      ? isEn
        ? "today's story"
        : '今天的故事'
      : scene
  const title = summarizeEntryTitle({
    note,
    location: input.location,
    toyName,
    hasImage: Boolean(input.imageUrl),
    locale,
  })
  const resolvedImageAnalysis = input.imageUrl
    ? explicitScene
      ? imageDescriptionForScene(scene, locale)
      : imageSignals?.description || neutralImageDescription(locale)
    : undefined
  const visualSentence = input.imageUrl
    ? `${
        resolvedImageAnalysis ||
        (isEn
          ? `The photo holds a little of ${scenePhrase}.`
          : `照片里留下了${scenePhrase}。`)
      }`
    : ''
  const eventSentence = note
    ? isEn
      ? `You told me: “${note}”`
      : `你告诉我：“${note}”`
    : isEn
      ? `You shared ${scenePhrase} with me.`
      : `你把${scenePhrase}分享给了我。`
  const comfort = needsComfort
    ? comfortLine(input.toy, toyName, locale)
    : isHappy
      ? happyLine(input.toy, toyName, locale)
      : everydayLine(input.toy, toyName, locale)
  const place = input.location
    ? isEn
      ? `, in ${input.location}`
      : `，在${input.location}`
    : ''

  return {
    title,
    aiDiary: `${formatDate(input.date, locale)}${place}.\n\n${visualSentence}${visualSentence ? '\n\n' : ''}${eventSentence}\n\n${comfort}`,
    toyReply: needsComfort
      ? isEn
        ? `I wrote this moment down. You don't have to force a smile today — ${toyName} is here with you.`
        : `我已经把这一刻写下来啦。今天不用勉强自己开心，${toyName}会陪着你。`
      : isEn
        ? `I tucked this moment into our growth journal. We can come back to it anytime.`
        : `我已经把这一刻写进我们的成长啦，以后还可以一起回来看看。`,
    mood: needsComfort
      ? isEn
        ? 'gentle'
        : '温柔'
      : isHappy
        ? isEn
          ? 'happy'
          : '开心'
        : moodForScene(scene, locale),
    tags: uniqueTags([
      ...(explicitScene ? tagsForScene(scene, locale) : []),
      needsComfort ? (isEn ? 'companionship' : '陪伴') : '',
      input.imageUrl
        ? isEn
          ? 'photo'
          : '照片记录'
        : isEn
          ? 'note'
          : '文字记录',
    ]).slice(0, 4),
    imageAnalysis: resolvedImageAnalysis,
    entryType: inferEntryType(input),
    processedImageUrl,
    source: 'local',
  }
}

export function summarizeEntryTitle(input: {
  note: string
  location?: string
  toyName: string
  hasImage: boolean
  locale: Locale
}) {
  const { note, location, toyName, hasImage, locale } = input
  if (note) {
    const normalizedNote = note
      .replace(/\s+/g, ' ')
      .replace(/[，,。！？!?；;\s]+$/g, '')
    const firstLine = note
      .replace(/\s+/g, ' ')
      .split(/[，,。！？!?；;\n]/)[0]
      .replace(
        locale === 'en'
          ? /^(today|just now|then|well|i want to (?:write down|remember))\s+/i
          : /^(今天|刚刚|然后|就是|嗯+|我想记录一下|想记录一下|记录一下)+[，,、\s]*/,
        '',
      )
      .replace(locale === 'en' ? /^i\s+/i : /^我和/, locale === 'en' ? '' : '和')
      .replace(/(真的)?(特别|非常|超级|太)?(好吃|好看|开心|美味|可爱|棒)[呀啊啦~～]*$/g, '')
      .replace(/^[，,、\s]+|[，,、\s]+$/g, '')
    if (firstLine) {
      const limit = locale === 'en' ? 42 : 14
      const summary = firstLine.length > limit
        ? firstLine.slice(0, limit).replace(/[的了着过和与、\s]+$/g, '')
        : firstLine
      return summary === normalizedNote
        ? locale === 'en'
          ? `${summary} — A Note`
          : `${summary} · 小记`
        : summary
    }
  }
  if (location) {
    return locale === 'en' ? `A day in ${location}` : `在${location}的一天`
  }
  if (hasImage) {
    return locale === 'en'
      ? `A moment with ${toyName}`
      : `和${toyName}收藏的这一刻`
  }
  return locale === 'en' ? 'Something to remember today' : '今天想记住的事'
}

function inferSceneFromText(note: string, location: string | undefined) {
  const text = `${note} ${location || ''}`
    .replace(/(?:并)?不是[^，。！？!?]{0,8}(?:日落|晚霞|夕阳|落日|海边|大海|沙滩|海浪|夜景|夜晚)/g, '')
    .replace(/not (?:a |the )?(?:sunset|beach|ocean|night)/gi, '')
    .toLowerCase()
  if (/sunset|dusk|golden hour|日落|晚霞|夕阳|落日/.test(text)) return 'sunset'
  if (/beach|ocean|sea|sand|海边|大海|沙滩|海浪/.test(text)) return 'seaside'
  if (/coffee|latte|cafe|咖啡|拿铁|咖啡店/.test(text)) return 'cafe'
  if (/rain|rainy|下雨|雨天|雨声/.test(text)) return 'rainy day'
  if (/night|city lights|夜景|夜晚|灯光|灯海/.test(text)) return 'night lights'
  if (/forest|park|woods|trail|green|森林|树林|公园|草地|山里/.test(text))
    return 'green path'
  if (/travel|trip|train|flight|city|旅行|出发|火车|飞机|城市/.test(text))
    return 'journey'
  if (/home|room|bedroom|nap|在家|回家|房间|卧室|午睡/.test(text))
    return 'home time'
  return undefined
}

function comfortLine(toy: Toy, toyName: string, locale: Locale) {
  const isEn = locale === 'en'
  if (hasTrait(toy, 'playful', '活泼')) {
    return isEn
      ? `I wanted to pull you toward more scenery, but I can tell you're low on energy. It's okay — let the evening wind hold the hard feelings. ${toyName} stays on your side.`
      : `我本来想拉着你多看一会儿风景，但发现你今天好像没有太多力气。没关系，坏心情可以先交给晚风，${toyName}会一直站在你这一边。`
  }
  if (hasTrait(toy, 'brave', '勇敢')) {
    return isEn
      ? `Today's adventure can pause here. You don't need to feel better right away. ${toyName} will sit with you a while before the next stretch of road.`
      : `今天的冒险可以先停在这里。你不需要马上变得开心，${toyName}会陪你一起坐一会儿，再慢慢走下一段路。`
  }
  if (hasTrait(toy, 'quiet', '安静')) {
    return isEn
      ? `I won't rush to fill the silence — just move a little closer. It's fine not to feel happy. ${toyName} will stay quietly with you.`
      : `我没有急着说很多话，只是悄悄靠近了一点。你不想开心的时候也没有关系，${toyName}会安安静静陪着你。`
  }
  return isEn
    ? `You said today felt heavy, so I didn't just watch the view. It's okay not to force a smile. ${toyName} will keep you company.`
    : `你说今天心情不太好，所以我没有只顾着看风景。没关系，不想开心的时候也不用勉强自己，${toyName}会一直陪着你。`
}

function happyLine(toy: Toy, toyName: string, locale: Locale) {
  const isEn = locale === 'en'
  if (hasTrait(toy, 'playful', '活泼')) {
    return isEn
      ? `I nearly bounced out of your arms! On days like this, ${toyName} wants to collect the joy again and again.`
      : `我差点开心得从你的手里跳起来！这样的好日子，${toyName}想和你再收藏很多很多次。`
  }
  return isEn
    ? `Seeing you happy warms my fur like sunshine. ${toyName} will remember this feeling carefully.`
    : `看到你开心，我的绒毛好像也被阳光晒得暖暖的。${toyName}会把这份快乐好好记住。`
}

function everydayLine(toy: Toy, toyName: string, locale: Locale) {
  const isEn = locale === 'en'
  if (hasTrait(toy, 'curious', '好奇')) {
    return isEn
      ? `Even ordinary days hide tiny details. ${toyName} will keep looking, and discover them with you.`
      : `原来普通的一天也藏着这么多小细节。${toyName}会继续睁大眼睛，和你一起发现它们。`
  }
  return isEn
    ? `Whether today was special or not, sharing it with you is enough for ${toyName} to keep it.`
    : `不管今天是不是特别的一天，只要和你一起经历过，${toyName}就愿意把它好好记住。`
}

function moodForScene(scene: string, locale: Locale) {
  const isEn = locale === 'en'
  if (scene === 'journey' || scene === 'night lights')
    return isEn ? 'curious' : '好奇'
  if (scene === 'sunset' || scene === 'seaside' || scene === 'rainy day')
    return isEn ? 'gentle' : '温柔'
  return isEn ? 'calm' : '平静'
}

function inferEntryType(input: AnalyzeEntryInput): EntryType {
  const text = `${input.userNote || ''} ${input.location || ''}`.toLowerCase()
  if (
    /travel|trip|train|flight|beach|city|mountain|旅行|出发|火车|飞机|景区|海边|城市|山里/.test(
      text,
    )
  )
    return 'travel'
  if (
    /anniversary|birthday|first time|memorial|纪念|周年|生日|第一次|第\s*\d+\s*天/.test(
      text,
    )
  )
    return 'memorial'
  if (!input.imageUrl) return 'text'
  return 'daily'
}

function tagsForScene(scene: string, locale: Locale) {
  const isEn = locale === 'en'
  const map: Record<string, string[]> = isEn
    ? {
        sunset: ['sunset', 'evening'],
        seaside: ['seaside', 'travel'],
        cafe: ['cafe', 'daily'],
        'rainy day': ['rain', 'daily'],
        'night lights': ['night', 'travel'],
        'green path': ['outdoors', 'nature'],
        journey: ['travel', 'on the road'],
        'home time': ['home', 'daily'],
      }
    : {
        sunset: ['日落', '傍晚'],
        seaside: ['海边', '旅行'],
        cafe: ['咖啡店', '日常'],
        'rainy day': ['雨天', '日常'],
        'night lights': ['夜景', '旅行'],
        'green path': ['户外', '自然'],
        journey: ['旅行', '出发'],
        'home time': ['居家', '日常'],
      }
  return map[scene] || (isEn ? ['daily'] : ['日常'])
}

function imageDescriptionForScene(
  scene: string,
  locale: Locale,
) {
  const isEn = locale === 'en'
  const descriptions: Record<string, string> = isEn
    ? {
        sunset:
          'The photo holds evening sky — warm light slowly saying goodbye to the day.',
        seaside:
          'Photo and words keep an open shoreline: water, sand, and far-away scenery.',
        cafe: 'Photo and words capture a small slice of cafe life.',
        'rainy day': 'Photo and words hold a quiet, rain-soft moment.',
        'night lights': 'Photo and words keep the glow of lights after dark.',
        'green path':
          'The frame is full of natural greens, like walking into the trees.',
        journey: 'The photo freezes one pause along the road.',
        'home time':
          'The photo keeps an ordinary, precious stretch of home time.',
      }
    : {
        sunset: '照片里留下了傍晚的天空，暖暖的光像是在慢慢和今天告别。',
        seaside:
          '照片和文字一起记录了开阔的海边，海水、沙滩和远处的风景都被收藏下来。',
        cafe: '照片和文字一起记录了咖啡店里的生活片段。',
        'rainy day': '照片和文字一起记录了一个带着雨意的安静时刻。',
        'night lights': '照片和文字一起记录了夜晚亮起来的灯光。',
        'green path': '照片里有很多自然的颜色，像是一起走进了绿色风景里。',
        journey: '照片记录了这段旅途中的一个停留时刻。',
        'home time': '照片记录了在家度过的一段普通又珍贵的时光。',
      }
  return (
    descriptions[scene] ||
    neutralImageDescription(locale)
  )
}

function neutralImageDescription(locale: Locale) {
  return locale === 'en'
    ? 'The photo keeps a shared moment between you and your toy.'
    : '照片记录了你和玩偶共同经历的一个生活瞬间。'
}

function uniqueTags(tags: string[]) {
  return [...new Set(tags.filter(Boolean))]
}

function shortToyName(name: string) {
  return name.replace(/little bear|teddy|toy|小熊|玩偶/gi, '').trim() || name
}

function formatDate(date: string, locale: Locale) {
  const [year, month, day] = date.split('-')
  if (locale === 'zh') {
    return `${year}年${Number(month)}月${Number(day)}日`
  }
  const d = new Date(Number(year), Number(month) - 1, Number(day))
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

async function analyzeImagePalette(
  imageUrl: string,
  locale: Locale = 'zh',
): Promise<ImageSignals> {
  const isEn = locale === 'en'
  const image = await loadImage(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = 48
  canvas.height = 48
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas is unavailable')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  let warm = 0
  let blue = 0
  let green = 0
  let brightness = 0
  let samples = 0

  const sampledHeight = Math.round(canvas.height * 0.62)
  for (let y = 0; y < sampledHeight; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      const index = (y * canvas.width + x) * 4
      const red = pixels[index]
      const greenValue = pixels[index + 1]
      const blueValue = pixels[index + 2]
      brightness += (red + greenValue + blueValue) / 3
      if (red > 145 && red > greenValue * 1.1 && red > blueValue * 1.3) warm += 1
      if (blueValue > 115 && blueValue > red * 1.1) blue += 1
      if (
        greenValue > 95 &&
        greenValue > red * 1.06 &&
        greenValue > blueValue * 1.03
      ) {
        green += 1
      }
      samples += 1
    }
  }

  const warmRatio = warm / samples
  const blueRatio = blue / samples
  const greenRatio = green / samples
  const averageBrightness = brightness / samples

  if (warmRatio > 0.16) {
    return {
      description: isEn
        ? 'The photo has an overall warm, yellow-orange colour tone.'
        : '照片整体呈现温暖的黄橙色调。',
    }
  }
  if (blueRatio > 0.2) {
    return {
      description: isEn
        ? 'The photo has an overall clear blue colour tone.'
        : '照片整体以清透的蓝色调为主。',
    }
  }
  if (greenRatio > 0.18) {
    return {
      description: isEn
        ? 'The photo has an overall soft green colour tone.'
        : '照片整体以柔和的绿色调为主。',
    }
  }
  if (averageBrightness < 72) {
    return {
      description: isEn
        ? 'The photo is relatively dim, with a subdued overall tone.'
        : '照片整体光线偏暗，色调比较沉静。',
    }
  }
  return {
    description: neutralImageDescription(locale),
  }
}

async function compressImage(imageUrl: string) {
  const image = await loadImage(imageUrl)
  const maxSide = 1080
  const scale = Math.min(
    1,
    maxSide / Math.max(image.naturalWidth, image.naturalHeight),
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.78)
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    // Remote URLs need CORS for canvas; blob/data do not.
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      image.crossOrigin = 'anonymous'
    }
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image could not be loaded'))
    image.src = src
  })
}
