/** Matches plan.md interface contract + place-aware travel map */

export type EntryType = 'travel' | 'daily' | 'memorial' | 'text' | 'heart'

/** Structured place saved with a record (country/region/city/district/poi…) */
export interface Place {
  id?: string
  country?: string
  region?: string
  city?: string
  district?: string
  poi?: string
  displayName: string
  lat: number
  lng: number
  providerPlaceId?: string
  provider?: 'nominatim' | 'manual' | 'exif' | 'geolocation' | 'seed'
}

export interface Toy {
  id: string
  name: string
  birthDate: string
  birthPlace: string
  role: string
  traits: string[]
  /** AI-filled / user-edited */
  zodiac?: string
  /** Short public-facing line shown consistently across toy identity surfaces. */
  signature?: string
  bio?: string
  monologue?: string
  avatarUrl?: string
  createdAt: string
}

export interface CreateToyInput {
  name: string
  birthDate: string
  birthPlace: string
  role: string
  traits: string[]
  signature?: string
  bio?: string
  monologue?: string
  avatarUrl?: string
  zodiac?: string
}

export interface Entry {
  id: string
  toyId: string
  type: EntryType
  date: string
  /** Legacy free-text location (kept for display fallback) */
  location?: string
  /** Structured place for map / reverse-geo / search */
  place?: Place
  title?: string
  userNote?: string
  mood?: string
  imageUrl?: string
  /** Relative Library path used to re-resolve and remove a native diary photo. */
  localImagePath?: string
  aiDiary?: string
  tags?: string[]
  imageAnalysis?: string
  createdAt: string
}

export interface CreateEntryInput {
  type: EntryType
  date: string
  location?: string
  place?: Place
  title?: string
  userNote?: string
  mood?: string
  /** local object URL or data URL for mock */
  imageUrl?: string
  localImagePath?: string
  aiDiary?: string
  tags?: string[]
  imageAnalysis?: string
}

export interface TravelMapPoint {
  entryId: string
  toyId: string
  date: string
  title?: string
  mood?: string
  imageUrl?: string
  localImagePath?: string
  aiDiary?: string
  userNote?: string
  place: Place
}

export interface TravelMapResponse {
  toyId: string
  points: TravelMapPoint[]
  years: number[]
  cityCount: number
  travelCount: number
}

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  travel: 'Travel',
  daily: 'Daily',
  heart: 'Heart',
  memorial: 'Memorial',
  text: 'Text',
}

export const ENTRY_TYPE_LABEL_ZH: Record<EntryType, string> = {
  travel: '旅行',
  daily: '日常',
  heart: '心事',
  memorial: '纪念日',
  text: '文字',
}

export function entryTypeLabel(
  type: EntryType,
  locale: 'zh' | 'en' = 'zh',
): string {
  return locale === 'en' ? ENTRY_TYPE_LABEL[type] : ENTRY_TYPE_LABEL_ZH[type]
}

export const COMPOSE_ENTRY_TYPES: EntryType[] = [
  'travel',
  'daily',
  'heart',
  'memorial',
]

export const MOOD_OPTIONS = [
  'happy',
  'calm',
  'curious',
  'homesick',
  'excited',
  'gentle',
] as const

export const MOOD_OPTIONS_ZH = [
  '开心',
  '平静',
  '好奇',
  '想家',
  '兴奋',
  '温柔',
] as const

export function moodOptionsFor(locale: 'zh' | 'en') {
  return locale === 'en' ? [...MOOD_OPTIONS] : [...MOOD_OPTIONS_ZH]
}
