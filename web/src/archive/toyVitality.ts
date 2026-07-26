/**
 * Lightweight toy mood / energy (AI-tamago inspired).
 * Derived at read time from traits, recent entries, and clock — no persistence.
 */

import type { Entry, Toy } from '../types'
import { getStoredLocale, translate, type Locale } from '../i18n'

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
  /** short chip label e.g. Sleepy */
  label: string
  /** one soft line for cards / monologue area */
  line: string
}

const MOOD_META: Record<
  ToyMoodId,
  { emoji: string; labelKey: string; lineKeys: string[] }
> = {
  happy: {
    emoji: '😊',
    labelKey: 'vitality.happy',
    lineKeys: ['vitality.happy.1', 'vitality.happy.2', 'vitality.happy.3'],
  },
  calm: {
    emoji: '🌿',
    labelKey: 'vitality.calm',
    lineKeys: ['vitality.calm.1', 'vitality.calm.2', 'vitality.calm.3'],
  },
  curious: {
    emoji: '🔍',
    labelKey: 'vitality.curious',
    lineKeys: [
      'vitality.curious.1',
      'vitality.curious.2',
      'vitality.curious.3',
    ],
  },
  sleepy: {
    emoji: '😴',
    labelKey: 'vitality.sleepy',
    lineKeys: [
      'vitality.sleepy.1',
      'vitality.sleepy.2',
      'vitality.sleepy.3',
    ],
  },
  lonely: {
    emoji: '💭',
    labelKey: 'vitality.lonely',
    lineKeys: [
      'vitality.lonely.1',
      'vitality.lonely.2',
      'vitality.lonely.3',
    ],
  },
  excited: {
    emoji: '✨',
    labelKey: 'vitality.excited',
    lineKeys: [
      'vitality.excited.1',
      'vitality.excited.2',
      'vitality.excited.3',
    ],
  },
}

const ENTRY_MOOD_MAP: Record<string, ToyMoodId> = {
  开心: 'happy',
  happy: 'happy',
  平静: 'calm',
  calm: 'calm',
  好奇: 'curious',
  curious: 'curious',
  想家: 'lonely',
  homesick: 'lonely',
  兴奋: 'excited',
  excited: 'excited',
  温柔: 'calm',
  gentle: 'calm',
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

function hasTrait(traits: string[], ...names: string[]) {
  const set = new Set(traits.map((t) => t.toLowerCase()))
  return names.some((n) => set.has(n.toLowerCase()))
}

/**
 * Derive mood + energy for a toy. Pure / deterministic for a given `now`.
 */
export function getToyVitality(
  toy: Toy,
  entries: Entry[],
  now: Date = new Date(),
  locale: Locale = getStoredLocale(),
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
    mood = hasTrait(traits, 'playful', '活泼') ? 'happy' : 'curious'
    energy += 4
  } else if (hour >= 18) {
    mood = 'calm'
    energy -= 4
  } else {
    mood = hasTrait(traits, 'playful', '活泼') ? 'happy' : 'calm'
  }

  if (hasTrait(traits, 'curious', '好奇') && mood !== 'sleepy') {
    mood = hour < 14 ? 'curious' : mood
    energy += 3
  }
  if (hasTrait(traits, 'playful', '活泼')) energy += 6
  if (hasTrait(traits, 'quiet', '安静', 'gentle', '温柔')) energy -= 4

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

  if (energy < 30 && mood !== 'lonely') {
    mood = 'sleepy'
  }

  const meta = MOOD_META[mood]
  const seed =
    toy.id.length * 17 +
    hour +
    (latest?.date ? latest.date.length * 3 : 0) +
    traits.join('').length

  const lines = meta.lineKeys.map((k) => translate(locale, k))

  return {
    mood,
    energy,
    emoji: meta.emoji,
    label: translate(locale, meta.labelKey),
    line: pickLine(lines, seed),
  }
}

/** Compact status for conversation header (replaces getToyStatus). */
export function vitalityStatusLine(v: ToyVitality, toyName: string) {
  if (v.mood === 'sleepy') return v.line
  if (v.mood === 'lonely') return `${toyName} · ${v.line}`
  return v.line
}
