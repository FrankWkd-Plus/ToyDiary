import type { EntryType, Toy } from '../types'

export interface AnalyzeEntryInput {
  toy: Toy
  date: string
  location?: string
  userNote?: string
  imageUrl?: string
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
  scene: string
  description: string
  tags: string[]
}

/** Default to Pages Function; override with VITE_AI_ANALYZE_ENDPOINT if needed. */
const AI_ENDPOINT =
  (import.meta.env.VITE_AI_ANALYZE_ENDPOINT as string | undefined)?.trim() ||
  '/api/analyze-entry'

const AI_TIMEOUT_MS = 28_000

export async function analyzeEntry(
  input: AnalyzeEntryInput,
): Promise<EntryAnalysis> {
  // blob: / data: are fine without CORS; remote http needs anonymous for canvas
  const processedImageUrl = input.imageUrl
    ? await compressImage(input.imageUrl).catch(() => input.imageUrl)
    : undefined
  const imageSignals = processedImageUrl
    ? await analyzeImagePalette(processedImageUrl).catch(() => undefined)
    : undefined

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
          // Prefer compressed data URL so the function can vision-read photos
          imageDataUrl: processedImageUrl?.startsWith('data:')
            ? processedImageUrl
            : undefined,
          imageUrl:
            !processedImageUrl?.startsWith('data:') && input.imageUrl
              ? input.imageUrl
              : undefined,
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
      throw new Error('AI 返回内容不完整')
    }
    return {
      title: result.title.trim(),
      aiDiary: result.aiDiary.trim(),
      toyReply:
        result.toyReply?.trim() ||
        `我已经把这一刻写下来啦，会好好放进我们的成长里。`,
      mood: result.mood?.trim() || '温柔',
      tags: result.tags?.filter(Boolean).slice(0, 4) || [],
      imageAnalysis:
        result.imageAnalysis?.trim() || imageSignals?.description,
      entryType: result.entryType || inferEntryType(input),
      processedImageUrl: processedImageUrl || input.imageUrl,
      source: 'api',
    }
  } catch (err) {
    // Local template keeps the flow usable offline / without keys / on timeout.
    console.warn('[analyzeEntry] remote failed, using local:', err)
  }

  return generateLocalAnalysis(input, imageSignals, processedImageUrl)
}

function generateLocalAnalysis(
  input: AnalyzeEntryInput,
  imageSignals: ImageSignals | undefined,
  processedImageUrl: string | undefined,
): EntryAnalysis {
  const note = input.userNote?.trim() || ''
  const explicitScene = inferSceneFromText(note, input.location)
  const scene =
    explicitScene || imageSignals?.scene || (note ? '今天的故事' : '这一刻')
  const needsComfort = /心情不好|不开心|难过|疲惫|好累|很累|压力|焦虑|烦|孤单/.test(
    note,
  )
  const isHappy = /开心|快乐|惊喜|兴奋|幸福|好喜欢/.test(note)
  const toyName = shortToyName(input.toy.name)
  const scenePhrase = scene === '这一刻' ? '今天的故事' : scene
  const title = titleForScene(scene, needsComfort, Boolean(input.imageUrl))
  const resolvedImageAnalysis = input.imageUrl
    ? imageDescriptionForScene(scene, imageSignals)
    : undefined
  const visualSentence = input.imageUrl
    ? `${resolvedImageAnalysis || `照片里留下了${scenePhrase}。`}`
    : ''
  const eventSentence = note
    ? `你告诉我：“${note}”`
    : `你把${scenePhrase}分享给了我。`
  const comfort = needsComfort
    ? comfortLine(input.toy, toyName)
    : isHappy
      ? happyLine(input.toy, toyName)
      : everydayLine(input.toy, toyName)
  const place = input.location ? `，在${input.location}` : ''

  return {
    title,
    aiDiary: `${formatDate(input.date)}${place}。\n\n${visualSentence}${visualSentence ? '\n\n' : ''}${eventSentence}。\n\n${comfort}`,
    toyReply: needsComfort
      ? `我已经把这一刻写下来啦。今天不用勉强自己开心，${toyName}会陪着你。`
      : `我已经把这一刻写进我们的成长啦，以后还可以一起回来看看。`,
    mood: needsComfort ? '温柔' : isHappy ? '开心' : moodForScene(scene),
    tags: uniqueTags([
      ...tagsForScene(scene),
      ...(!explicitScene ? imageSignals?.tags || [] : []),
      needsComfort ? '陪伴' : '',
      input.imageUrl ? '照片记录' : '文字记录',
    ]).slice(0, 4),
    imageAnalysis: resolvedImageAnalysis,
    entryType: inferEntryType(input),
    processedImageUrl,
    source: 'local',
  }
}

function inferSceneFromText(note: string, location: string | undefined) {
  const text = `${note} ${location || ''}`
  if (/日落|晚霞|夕阳|落日/.test(text)) return '日落'
  if (/海边|大海|沙滩|海浪/.test(text)) return '海边'
  if (/咖啡|拿铁|咖啡店/.test(text)) return '咖啡店'
  if (/下雨|雨天|雨声/.test(text)) return '雨天'
  if (/夜景|夜晚|灯光|灯海/.test(text)) return '夜景'
  if (/森林|树林|公园|草地|山里/.test(text)) return '绿色小路'
  if (/旅行|出发|火车|飞机|城市/.test(text)) return '旅途'
  if (/在家|回家|房间|卧室|午睡/.test(text)) return '居家时光'
  return undefined
}

function titleForScene(scene: string, needsComfort: boolean, hasImage: boolean) {
  if (scene === '日落') {
    return needsComfort ? '陪你看日落的傍晚' : '把日落装进口袋'
  }
  if (scene === '海边') return '海风替我们收藏今天'
  if (scene === '咖啡店') return '一起闻到咖啡香'
  if (scene === '雨天') return '听雨慢慢落下来'
  if (scene === '夜景') return '灯光亮起来以后'
  if (scene === '绿色小路') return '藏在绿意里的时光'
  if (scene === '旅途') return '今天又向世界走了一步'
  if (scene === '居家时光') return '什么都不做也很好'
  return hasImage ? '这一刻，想和你一起记住' : '今天想和你说的话'
}

function comfortLine(toy: Toy, toyName: string) {
  if (toy.traits.includes('活泼')) {
    return `我本来想拉着你多看一会儿风景，但发现你今天好像没有太多力气。没关系，坏心情可以先交给晚风，${toyName}会一直站在你这一边。`
  }
  if (toy.traits.includes('勇敢')) {
    return `今天的冒险可以先停在这里。你不需要马上变得开心，${toyName}会陪你一起坐一会儿，再慢慢走下一段路。`
  }
  if (toy.traits.includes('安静')) {
    return `我没有急着说很多话，只是悄悄靠近了一点。你不想开心的时候也没有关系，${toyName}会安安静静陪着你。`
  }
  return `你说今天心情不太好，所以我没有只顾着看风景。没关系，不想开心的时候也不用勉强自己，${toyName}会一直陪着你。`
}

function happyLine(toy: Toy, toyName: string) {
  if (toy.traits.includes('活泼')) {
    return `我差点开心得从你的手里跳起来！这样的好日子，${toyName}想和你再收藏很多很多次。`
  }
  return `看到你开心，我的绒毛好像也被阳光晒得暖暖的。${toyName}会把这份快乐好好记住。`
}

function everydayLine(toy: Toy, toyName: string) {
  if (toy.traits.includes('好奇')) {
    return `原来普通的一天也藏着这么多小细节。${toyName}会继续睁大眼睛，和你一起发现它们。`
  }
  return `不管今天是不是特别的一天，只要和你一起经历过，${toyName}就愿意把它好好记住。`
}

function moodForScene(scene: string) {
  if (scene === '旅途' || scene === '夜景') return '好奇'
  if (scene === '日落' || scene === '海边' || scene === '雨天') return '温柔'
  return '平静'
}

function inferEntryType(input: AnalyzeEntryInput): EntryType {
  const text = `${input.userNote || ''} ${input.location || ''}`
  if (/旅行|出发|火车|飞机|景区|海边|城市|山里/.test(text)) return 'travel'
  if (/纪念|周年|生日|第一次|第\\s*\\d+\\s*天/.test(text)) return 'memorial'
  if (!input.imageUrl) return 'text'
  return 'daily'
}

function tagsForScene(scene: string) {
  const map: Record<string, string[]> = {
    日落: ['日落', '傍晚'],
    海边: ['海边', '旅行'],
    咖啡店: ['咖啡店', '日常'],
    雨天: ['雨天', '日常'],
    夜景: ['夜景', '旅行'],
    绿色小路: ['户外', '自然'],
    旅途: ['旅行', '出发'],
    居家时光: ['居家', '日常'],
  }
  return map[scene] || ['日常']
}

function imageDescriptionForScene(
  scene: string,
  imageSignals: ImageSignals | undefined,
) {
  const descriptions: Record<string, string> = {
    日落: '照片里留下了傍晚的天空，暖暖的光像是在慢慢和今天告别。',
    海边: '照片和文字一起记录了开阔的海边，海水、沙滩和远处的风景都被收藏下来。',
    咖啡店: '照片和文字一起记录了咖啡店里的生活片段。',
    雨天: '照片和文字一起记录了一个带着雨意的安静时刻。',
    夜景: '照片和文字一起记录了夜晚亮起来的灯光。',
    绿色小路: '照片里有很多自然的颜色，像是一起走进了绿色风景里。',
    旅途: '照片记录了这段旅途中的一个停留时刻。',
    居家时光: '照片记录了在家度过的一段普通又珍贵的时光。',
  }
  return descriptions[scene] || imageSignals?.description || '照片记录了你和玩偶共同经历的一个生活瞬间。'
}

function uniqueTags(tags: string[]) {
  return [...new Set(tags.filter(Boolean))]
}

function shortToyName(name: string) {
  return name.replace(/小熊|玩偶/gi, '').trim() || name
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-')
  return `${year}年${Number(month)}月${Number(day)}日`
}

async function analyzeImagePalette(imageUrl: string): Promise<ImageSignals> {
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
      scene: '日落',
      description: '画面里有大片暖橙色的光，像是太阳落下时的晚霞。',
      tags: ['暖色天空', '傍晚'],
    }
  }
  if (blueRatio > 0.2) {
    return {
      scene: '蓝色风景',
      description: '画面里有开阔的蓝色风景，天空显得很远也很安静。',
      tags: ['蓝色天空', '户外'],
    }
  }
  if (greenRatio > 0.18) {
    return {
      scene: '绿色小路',
      description: '画面里有很多绿色，像是一起走进了自然里。',
      tags: ['自然', '绿色'],
    }
  }
  if (averageBrightness < 72) {
    return {
      scene: '夜景',
      description: '画面光线偏暗，像是夜晚留下的一段安静时光。',
      tags: ['夜晚', '灯光'],
    }
  }
  return {
    scene: '这一刻',
    description: '照片记录了你和玩偶共同经历的一个生活瞬间。',
    tags: ['共同记忆'],
  }
}

async function compressImage(imageUrl: string) {
  const image = await loadImage(imageUrl)
  const maxSide = 1080
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
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
