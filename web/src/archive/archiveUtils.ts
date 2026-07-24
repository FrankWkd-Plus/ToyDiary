import type { Entry, Toy } from '../types'

const FALLBACK_PHOTOS = [
  '/toy-cards/highlight-1.jpg',
  '/toy-cards/highlight-2.jpg',
  '/toy-cards/highlight-3.jpg',
] as const

export function companionDays(toy: Toy) {
  return companionDayStatus(toy).days
}

export function companionDayStatus(toy: Toy) {
  const [year, month, day] = toy.birthDate.split('-').map(Number)
  const today = new Date()
  const startOrdinal = Date.UTC(year, month - 1, day) / 86400000
  const todayOrdinal =
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000
  const difference = todayOrdinal - startOrdinal

  if (!Number.isFinite(difference)) {
    return { days: 0, isFuture: false, daysUntil: 0 }
  }
  if (difference < 0) {
    return { days: 0, isFuture: true, daysUntil: Math.abs(difference) }
  }
  return { days: difference + 1, isFuture: false, daysUntil: 0 }
}

export function toyAvatar(toy: Toy | null | undefined, index = 0) {
  if (toy?.avatarUrl) return toy.avatarUrl
  if (toy?.id === 'toy_luna_demo' || index <= 0) return '/toy-cards/profile.jpg'
  if (toy?.id === 'toy_bean_demo' || index === 1) {
    return '/toy-cards/geese-avatar.jpg'
  }
  return index % 2 === 0
    ? '/toy-cards/highlight-2.jpg'
    : '/toy-cards/highlight-1.jpg'
}

/** Memory-hall card copy — always first-person from the toy's POV. */
export function toyPerspectiveNarration(entry: Entry): string {
  const diaryLine = entry.aiDiary
    ?.split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  if (diaryLine) return diaryLine

  const place =
    entry.place?.displayName?.trim() || entry.location?.trim() || ''
  const note = entry.userNote?.trim()
  if (note) {
    // Owner wrote a note; reframe as the toy remembering that moment.
    return place
      ? `在${place}，你说「${clipNote(note)}」。那一刻，我想一直待在你身边。`
      : `你说「${clipNote(note)}」。那一刻，我想一直待在你身边。`
  }
  if (place) return `在${place}的这一刻，我把风景和你的温度都记住了。`
  if (entry.title?.trim()) {
    return `关于「${entry.title.trim()}」的这一天，我都替你收好了。`
  }
  return '这一天的光，我替你记住了。'
}

function clipNote(note: string, max = 36) {
  const oneLine = note.replace(/\s+/g, ' ')
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine
}

export function archivePhotos(entries: Entry[]) {
  const photos = entries
    .filter((entry) => Boolean(entry.imageUrl))
    .map((entry) => ({
      src: entry.imageUrl as string,
      title: entry.title || '一起收藏的日子',
      // Always toy voice — never raw owner note as the card caption.
      narration: toyPerspectiveNarration(entry),
      date: entry.date,
      location:
        entry.place?.displayName || entry.location || '我们的秘密地点',
      /** Real diary entry id — used by 高光时刻 click-through */
      entryId: entry.id as string | undefined,
    }))

  if (photos.length > 0) return photos

  return FALLBACK_PHOTOS.map((src, index) => ({
    src,
    title: ['海风吹过的下午', '把浪花装进口袋', '藏在绿意里的瀑布'][index],
    // Fallback slides stay in first-person toy voice
    narration: [
      '第一次一起出发，蓝色的海很大，但你的手心刚刚好。',
      '我们把阳光、浪花和想念，都收藏在了这张照片里。',
      '水声很响，可是被你拿在手里时，我一点也不害怕。',
    ][index],
    date: ['2026-07-23', '2026-06-08', '2026-04-03'][index],
    location: ['蓝色海湾', '阳光海岸', '森林瀑布'][index],
    entryId: undefined as string | undefined,
  }))
}
