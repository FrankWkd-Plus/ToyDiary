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
export const FULL_BACKUP_VERSION = 1 as const

export interface FullBackupPayload {
  format: typeof FULL_BACKUP_FORMAT
  version: typeof FULL_BACKUP_VERSION
  exportedAt: string
  growth: GrowthExportPayload
  media: { photos: DiaryPhotoBackupFile[] }
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
  }
}

export function parseFullBackup(raw: unknown): {
  growth: GrowthExportPayload
  photos: DiaryPhotoBackupFile[]
  legacy: boolean
} {
  if (!raw || typeof raw !== 'object') throw new Error('文件格式无效')
  const data = raw as Partial<FullBackupPayload>
  if (data.format !== FULL_BACKUP_FORMAT) {
    return { growth: parseGrowthImport(raw), photos: [], legacy: true }
  }
  if (data.version !== FULL_BACKUP_VERSION || !data.growth) {
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
  return { growth: parseGrowthImport(data.growth), photos, legacy: false }
}

export async function restoreFullBackupMedia(photos: DiaryPhotoBackupFile[]) {
  await importDiaryPhotos(photos)
}

export function fullBackupFilename() {
  return `toydairy-backup-${new Date().toISOString().slice(0, 10)}.json`
}
