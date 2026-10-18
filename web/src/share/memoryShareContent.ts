import type { Entry } from '../types'

export interface MemorySharePhoto {
  id: string
  src: string
  title: string
  date: string
}

export function memorySharePhotos(entries: Entry[]): MemorySharePhoto[] {
  return entries.filter((entry) => entry.imageUrl).map((entry) => ({
    id: entry.id,
    src: entry.imageUrl!,
    title: entry.title || '一起收藏的瞬间',
    date: entry.date,
  }))
}

/** Skip generated diary date/place headings so the excerpt is actual diary prose. */
export function diaryExcerpt(entry?: Pick<Entry, 'aiDiary' | 'userNote'>): string {
  if (!entry) return ''
  const paragraphs = entry.aiDiary?.split(/\n+/).map((line) => line.trim()).filter(Boolean) || []
  const prose = paragraphs.filter((line) => !/^\d{4}[-年/.]/.test(line) && !/^——/.test(line))
  return prose.join(' ').trim() || entry.userNote?.trim() || ''
}

export function randomDiary(entries: Entry[], previousId?: string): Entry | undefined {
  const candidates = entries.filter((entry) => diaryExcerpt(entry))
  const alternatives = candidates.filter((entry) => entry.id !== previousId)
  const pool = alternatives.length ? alternatives : candidates
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Select unique moments; when possible, a shuffle always changes the visible set/order. */
export function randomMemoryPhotos(photos: MemorySharePhoto[], previous: (string | undefined)[] = []) {
  const shuffled = [...photos]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const other = shuffled[j]
    shuffled[j] = shuffled[i]
    shuffled[i] = other
  }
  let selected = shuffled.slice(0, 3).map((photo) => photo.id)
  if (selected.length > 1 && selected.every((id, index) => id === previous[index])) {
    selected = [...selected.slice(1), selected[0]]
  }
  return Array.from({ length: 3 }, (_, index) => selected[index])
}
