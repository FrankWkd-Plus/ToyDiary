/** Matches plan.md interface contract */

export type EntryType = 'travel' | 'daily' | 'memorial' | 'text'

export interface Toy {
  id: string
  name: string
  birthDate: string
  birthPlace: string
  role: string
  traits: string[]
  /** AI-filled */
  zodiac?: string
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
}

export interface Entry {
  id: string
  toyId: string
  type: EntryType
  date: string
  location?: string
  title?: string
  userNote?: string
  mood?: string
  imageUrl?: string
  aiDiary?: string
  tags?: string[]
  imageAnalysis?: string
  createdAt: string
}

export interface CreateEntryInput {
  type: EntryType
  date: string
  location?: string
  title?: string
  userNote?: string
  mood?: string
  /** local object URL or data URL for mock */
  imageUrl?: string
  aiDiary?: string
  tags?: string[]
  imageAnalysis?: string
}

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  travel: '旅行',
  daily: '日常',
  memorial: '纪念日',
  text: '文字',
}

export const MOOD_OPTIONS = ['开心', '平静', '好奇', '想家', '兴奋', '温柔'] as const
