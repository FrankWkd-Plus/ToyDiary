import type { Entry, Toy } from '../types'
import {
  exportDiaryPhotos,
  getRelativeDiaryPhotoPath,
  importDiaryPhotos,
  localDiaryPhotoReference,
  type DiaryPhotoBackupFile,
} from '../media/photoStorage'
import { buildGrowthExport, parseGrowthImport, type GrowthExportPayload } from './growthJson'

export const FULL_BACKUP_FORMAT = 'toydairy.backup' as const
export const FULL_BACKUP_VERSION = 2 as const

const BACKUP_LOCAL_STORAGE_KEYS = [
  'toydiary.user.prefs',
  'toydiary.conversations.v1',
  'toydiary.theme',
  'toydiary.locale',
  'toydiary.daycount.style',
  'toydiary.quietMode',
  'toydiary.me.collectionToyId',
] as const

export interface FullBackupPayload {
  format: typeof FULL_BACKUP_FORMAT
  version: typeof FULL_BACKUP_VERSION
  exportedAt: string
  growth: GrowthExportPayload
  media: { photos: DiaryPhotoBackupFile[] }
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

export async function buildFullBackup(input: {
  toys: Toy[]
  entries: Entry[]
  currentToyId: string | null
}): Promise<FullBackupPayload> {
  const normalizedEntries = stableEntries(input.entries)
  return {
    format: FULL_BACKUP_FORMAT,
    version: FULL_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    growth: buildGrowthExport({ ...input, entries: normalizedEntries }),
    media: { photos: await exportDiaryPhotos(normalizedEntries) },
    appState: { localStorage: captureLocalAppState() },
  }
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
  if ((version !== 1 && version !== FULL_BACKUP_VERSION) || !data.growth) {
    throw new Error('不支持的备份版本')
  }
  const photos = Array.isArray(data.media?.photos)
    ? data.media.photos.filter(
        (photo): photo is DiaryPhotoBackupFile =>
          Boolean(
            photo &&
              typeof photo === 'object' &&
              typeof (photo as DiaryPhotoBackupFile).path === 'string' &&
              typeof (photo as DiaryPhotoBackupFile).data === 'string',
          ),
      )
    : []
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
    photos,
    localStorage: localStorageSnapshot,
    legacy: version === 1,
  }
}

export async function restoreFullBackupMedia(photos: DiaryPhotoBackupFile[]) {
  await importDiaryPhotos(photos)
}

export function restoreFullBackupAppState(snapshot: Record<string, string>) {
  if (typeof window === 'undefined') return
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
  return `toydairy-backup-${new Date().toISOString().slice(0, 10)}.json`
}
