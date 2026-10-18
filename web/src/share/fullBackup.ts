import { localDate } from '../utils/localDate'
import type { Entry, Toy } from '../types'
import {
  exportChatImages,
  exportDiaryPhotos,
  exportToyAvatars,
  getRelativeChatImagePath,
  getRelativeDiaryPhotoPath,
  getRelativeToyAvatarPath,
  importDiaryPhotos,
  localDiaryPhotoReference,
  localToyAvatarReference,
  type DiaryPhotoBackupFile,
} from '../media/photoStorage'
import { CHAT_STORAGE_KEY, type ChatMessage } from '../conversation/chatStorage'
import { isDemoMode } from '../demo/demoMode'
import { buildGrowthExport, parseGrowthImport, type GrowthExportPayload } from './growthJson'

export const FULL_BACKUP_FORMAT = 'toydairy.backup' as const
/** v4 adds `media.chatImages`; v3 backups still restore. */
export const FULL_BACKUP_VERSION = 4 as const

const SUPPORTED_BACKUP_VERSIONS: number[] = [1, 2, 3, FULL_BACKUP_VERSION]

const BACKUP_LOCAL_STORAGE_KEYS = [
  'toydiary.user.prefs',
  CHAT_STORAGE_KEY,
  'toydiary.theme',
  'toydiary.locale',
  'toydiary.daycount.style',
  'toydiary.quietMode',
  'toydiary.me.collectionToyId',
  'toydiary.growth.perspective',
] as const

export interface FullBackupPayload {
  format: typeof FULL_BACKUP_FORMAT
  version: typeof FULL_BACKUP_VERSION
  exportedAt: string
  growth: GrowthExportPayload
  media: {
    photos: DiaryPhotoBackupFile[]
    avatars: DiaryPhotoBackupFile[]
    /**
     * Chat photos are files now, not inline data URLs, so the conversation
     * snapshot alone no longer carries them. Added in version 4.
     */
    chatImages: DiaryPhotoBackupFile[]
  }
  appState: { localStorage: Record<string, string> }
}

function captureLocalAppState() {
  const snapshot: Record<string, string> = {}
  if (typeof window === 'undefined') return snapshot
  for (const key of BACKUP_LOCAL_STORAGE_KEYS) {
    try {
      const value = window.localStorage.getItem(key)
      if (value !== null) snapshot[key] = value
    } catch {
      // A blocked optional preference must not prevent diary/photo backup.
    }
  }
  return snapshot
}

function stableEntries(entries: Entry[]) {
  return entries.map((entry) => {
    const path = getRelativeDiaryPhotoPath(entry.imageUrl, entry.localImagePath)
    return path
      ? { ...entry, imageUrl: localDiaryPhotoReference(path), localImagePath: path }
      : entry
  })
}

function stableToys(toys: Toy[]) {
  return toys.map((toy) => {
    const path = getRelativeToyAvatarPath(toy.avatarUrl, toy.localAvatarPath)
    return path
      ? {
          ...toy,
          avatarUrl: localToyAvatarReference(path),
          localAvatarPath: path,
        }
      : toy
  })
}

/**
 * The chat photos named by the conversation snapshot. The records already store
 * the durable `toydiary-media://` reference, so only the files behind them have
 * to be collected here.
 */
function chatImagePaths(snapshot: Record<string, string>) {
  const raw = snapshot[CHAT_STORAGE_KEY]
  if (!raw) return [] as string[]
  try {
    const chats = JSON.parse(raw) as Record<string, ChatMessage[]>
    return Object.values(chats)
      .filter(Array.isArray)
      .flat()
      .map((message) =>
        getRelativeChatImagePath(message?.imageUrl, message?.localImagePath),
      )
      .filter((path): path is string => Boolean(path))
  } catch {
    // A malformed conversation record must not cost the user the rest of the backup.
    return [] as string[]
  }
}

export async function buildFullBackup(input: {
  toys: Toy[]
  entries: Entry[]
  currentToyId: string | null
}): Promise<FullBackupPayload> {
  // The diary rows would come from the demo namespace while `appState` reads
  // the real keys — a mixed archive that is wrong for both. Backups only run
  // in real mode; the demo space is discarded on exit anyway.
  if (isDemoMode()) {
    throw new Error('演示模式下无法导出完整备份，请先关闭演示模式')
  }
  const normalizedEntries = stableEntries(input.entries)
  const normalizedToys = stableToys(input.toys)
  const appState = { localStorage: captureLocalAppState() }
  return {
    format: FULL_BACKUP_FORMAT,
    version: FULL_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    growth: buildGrowthExport({
      ...input,
      toys: normalizedToys,
      entries: normalizedEntries,
    }),
    media: {
      photos: await exportDiaryPhotos(normalizedEntries),
      avatars: await exportToyAvatars(normalizedToys),
      chatImages: await exportChatImages(chatImagePaths(appState.localStorage)),
    },
    appState,
  }
}

/** Shared shape check for the three media lists, including absent ones. */
function readMediaFiles(value: unknown): DiaryPhotoBackupFile[] {
  return Array.isArray(value)
    ? value.filter(
        (file): file is DiaryPhotoBackupFile =>
          Boolean(
            file &&
              typeof file === 'object' &&
              typeof (file as DiaryPhotoBackupFile).path === 'string' &&
              typeof (file as DiaryPhotoBackupFile).data === 'string',
          ),
      )
    : []
}

export function parseFullBackup(raw: unknown): {
  growth: GrowthExportPayload
  photos: DiaryPhotoBackupFile[]
  localStorage: Record<string, string>
  legacy: boolean
} {
  if (!raw || typeof raw !== 'object') throw new Error('文件格式无效')
  const data = raw as Partial<FullBackupPayload>
  const version = Number(data.version)
  if (data.format !== FULL_BACKUP_FORMAT) {
    return {
      growth: parseGrowthImport(raw),
      photos: [],
      localStorage: {},
      legacy: true,
    }
  }
  if (!SUPPORTED_BACKUP_VERSIONS.includes(version) || !data.growth) {
    throw new Error('不支持的备份版本')
  }
  const photos = readMediaFiles(data.media?.photos)
  const avatars = readMediaFiles(data.media?.avatars)
  // Absent in version 1-3 backups, where chat photos were still inline data URLs.
  const chatImages = readMediaFiles(data.media?.chatImages)
  const rawLocalStorage =
    data.appState && typeof data.appState === 'object'
      ? data.appState.localStorage
      : undefined
  const localStorageSnapshot: Record<string, string> = {}
  if (rawLocalStorage && typeof rawLocalStorage === 'object') {
    for (const key of BACKUP_LOCAL_STORAGE_KEYS) {
      const value = rawLocalStorage[key]
      if (typeof value === 'string') localStorageSnapshot[key] = value
    }
  }
  return {
    growth: parseGrowthImport(data.growth),
    photos: [...photos, ...avatars, ...chatImages],
    localStorage: localStorageSnapshot,
    legacy: version === 1 || version === 2,
  }
}

export async function restoreFullBackupMedia(photos: DiaryPhotoBackupFile[]) {
  await importDiaryPhotos(photos)
}

export function restoreFullBackupAppState(snapshot: Record<string, string>) {
  if (typeof window === 'undefined') return
  // Restoring real keys while the app shows demo data would silently mix the
  // two namespaces; require exiting demo mode first.
  if (isDemoMode()) {
    throw new Error('演示模式下无法恢复完整备份，请先关闭演示模式')
  }
  for (const key of BACKUP_LOCAL_STORAGE_KEYS) {
    try {
      if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
        window.localStorage.setItem(key, snapshot[key])
      } else {
        window.localStorage.removeItem(key)
      }
    } catch {
      throw new Error('偏好设置或对话记录恢复失败')
    }
  }
}

export function fullBackupFilename() {
  return `toydairy-backup-${localDate()}.json`
}
