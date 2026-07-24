/**
 * Lightweight toy mood / energy (AI-tamago inspired).
 * Derived at read time from traits, recent entries, and clock — no persistence.
 */

import type { Entry, Toy } from '../types'

export type ToyMoodId =
  | 'happy'
  | 'calm'
  | 'curious'
  | 'sleepy'
  | 'lonely'
  | 'excited'

export interface ToyVitality {
  mood: ToyMoodId
  /** 0–100 */
  energy: number
  emoji: string
  /** short chip label e.g. 困困的 */
  label: string
  /** one soft line for cards / monologue area */
  line: string
}

const MOOD_META: Record<
  ToyMoodId,
  { emoji: string; label: string; lines: string[] }
> = {
  happy: {
    emoji: '😊',
    label: '开心',
    lines: ['今天心情亮晶晶的', '想和你分享一点小确幸', '被你记得的感觉真好'],
  },
  calm: {
    emoji: '🌿',
    label: '安静',
    lines: ['静静待在你身边就很好', '把呼吸放慢一点', '今天适合慢慢写手帐'],
  },
  curious: {
    emoji: '🔍',
    label: '好奇',
    lines: ['想看看你眼中的今天', '外面是不是有新故事？', '告诉我一件小事吧'],
  },
  sleepy: {
    emoji: '😴',
    label: '困困的',
    lines: ['今天有点困，但还是想等你', '换上睡衣，想听你说晚安', '眼皮有点沉，心还醒着'],
  },
  lonely: {
    emoji: '💭',
    label: '有点想你',
    lines: ['有点想你啦', '好久没一起记一笔了', '口袋里还留着位置给你'],
  },
  excited: {
    emoji: '✨',
    label: '兴奋',
    lines: ['电量充足，想听你吐槽今天', '又想出门玩啦', '心跳有点快，是好事'],
  },
}

const ENTRY_MOOD_MAP: Record<string, ToyMoodId> = {
  开心: 'happy',
  平静: 'calm',
  好奇: 'curious',
  想家: 'lonely',
  兴奋: 'excited',
  温柔: 'calm',
}

function pickLine(lines: string[], seed: number) {
  return lines[Math.abs(seed) % lines.length] ?? lines[0]
}

function daysSince(isoDate: string, now: Date) {
  const start = new Date(`${isoDate.slice(0, 10)}T00:00:00`).getTime()
  if (Number.isNaN(start)) return 0
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today.getTime() - start) / 86400000))
}

/**
 * Derive mood + energy for a toy. Pure / deterministic for a given `now`.
 */
export function getToyVitality(
  toy: Toy,
  entries: Entry[],
  now: Date = new Date(),
): ToyVitality {
  const hour = now.getHours()
  const toyEntries = entries.filter((e) => e.toyId === toy.id)
  const latest = toyEntries[0]
  const staleDays = latest ? daysSince(latest.date, now) : 14
  const traits = toy.traits ?? []

  let mood: ToyMoodId = 'calm'
  let energy = 72

  if (hour >= 22 || hour < 6) {
    mood = 'sleepy'
    energy -= 18
  } else if (hour < 11) {
    mood = traits.includes('活泼') ? 'happy' : 'curious'
    energy += 4
  } else if (hour >= 18) {
    mood = 'calm'
    energy -= 4
  } else {
    mood = traits.includes('活泼') ? 'happy' : 'calm'
  }

  if (traits.includes('好奇') && mood !== 'sleepy') {
    mood = hour < 14 ? 'curious' : mood
    energy += 3
  }
  if (traits.includes('活泼')) energy += 6
  if (traits.includes('安静') || traits.includes('温柔')) energy -= 4

  if (latest?.type === 'travel' && staleDays <= 3) {
    mood = 'excited'
    energy += 10
  } else if (latest?.mood && ENTRY_MOOD_MAP[latest.mood] && staleDays <= 2) {
    mood = ENTRY_MOOD_MAP[latest.mood]
  }

  if (staleDays >= 7) {
    mood = hour >= 22 || hour < 6 ? 'sleepy' : 'lonely'
    energy -= 12
  } else if (staleDays >= 4 && mood !== 'sleepy') {
    energy -= 6
  }

  energy = Math.max(18, Math.min(100, Math.round(energy)))

  // Very low energy forces sleepy overlay on label line, keep mood unless night already.
  if (energy < 30 && mood !== 'lonely') {
    mood = 'sleepy'
  }

  const meta = MOOD_META[mood]
  const seed =
    toy.id.length * 17 +
    hour +
    (latest?.date ? latest.date.length * 3 : 0) +
    traits.join('').length

  return {
    mood,
    energy,
    emoji: meta.emoji,
    label: meta.label,
    line: pickLine(meta.lines, seed),
  }
}

/** Compact status for conversation header (replaces getToyStatus). */
export function vitalityStatusLine(v: ToyVitality, toyName: string) {
  if (v.mood === 'sleepy') return v.line
  if (v.mood === 'lonely') return `${toyName} · ${v.line}`
  return v.line
}
