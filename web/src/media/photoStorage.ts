import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import type { Entry } from '../types'

/**
 * A `blob:` URL belongs to one WebView document only. Diary photos therefore
 * get copied into the native app container before an entry is persisted.
 */
const PHOTO_ROOT = 'ToyDiary/photos'
const LOCAL_MEDIA_PREFIX = 'toydiary-media://'

export function isNativeApp() {
  return Capacitor.isNativePlatform()
}

function extensionFor(file?: File, sourceUri?: string) {
  const fromFile = file?.name.split('.').pop()?.toLowerCase()
  const fromUri = sourceUri?.split('?')[0].split('.').pop()?.toLowerCase()
  const extension = fromFile || fromUri
  return extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : 'jpg'
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result || '')
      const comma = value.indexOf(',')
      resolve(comma >= 0 ? value.slice(comma + 1) : value)
    }
    reader.onerror = () => reject(new Error('读取照片失败'))
    reader.readAsDataURL(file)
  })
}

async function previewToBase64(previewUrl: string) {
  const response = await fetch(previewUrl)
  if (!response.ok) throw new Error('读取照片失败')
  const blob = await response.blob()
  return fileToBase64(new File([blob], 'photo.jpg', { type: blob.type }))
}

export interface PersistPhotoInput {
  /** The source file selected from a browser input or built from Camera data. */
  file?: File
  /** Native Camera URI. This is preferred because it retains the original file. */
  nativeUri?: string
  /** Used for browser preview and as a last-resort source. */
  previewUrl?: string
}

export interface PersistedDiaryPhoto {
  /** Stable logical URL persisted in the diary record, never an app-container URL. */
  url: string
  /** Relative path inside Library, retained for safe deletion and re-resolution. */
  nativePath?: string
}

export interface DiaryPhotoBackupFile {
  path: string
  /** Base64 file data, without a data URL prefix. */
  data: string
}

function relativePhotoPath(value?: string) {
  if (!value) return undefined
  const source = value.startsWith(LOCAL_MEDIA_PREFIX)
    ? value.slice(LOCAL_MEDIA_PREFIX.length)
    : value
  const marker = PHOTO_ROOT + '/'
  const index = source.indexOf(marker)
  if (index < 0) return undefined
  const path = source.slice(index).split(/[?#]/, 1)[0]
  return path.startsWith(marker) ? decodeURIComponent(path) : undefined
}

export function localDiaryPhotoReference(path: string) {
  return `${LOCAL_MEDIA_PREFIX}${path}`
}

/**
 * Maps a stable logical photo path to the current native container on every
 * launch. iOS may change the absolute container location during an update.
 */
export async function resolveDiaryPhotoUrl(
  imageUrl?: string,
  localImagePath?: string,
) {
  if (!isNativeApp()) return imageUrl
  const path = relativePhotoPath(localImagePath) || relativePhotoPath(imageUrl)
  if (!path) return imageUrl
  try {
    await Filesystem.stat({ path, directory: Directory.Library })
    const uri = await Filesystem.getUri({ path, directory: Directory.Library })
    return Capacitor.convertFileSrc(uri.uri)
  } catch {
    return imageUrl
  }
}

/** Finds the durable relative path in either new or legacy records. */
export function getRelativeDiaryPhotoPath(
  imageUrl?: string,
  localImagePath?: string,
) {
  return relativePhotoPath(localImagePath) || relativePhotoPath(imageUrl)
}

/**
 * Returns a stable Capacitor-served URL on iOS/Android. Browser builds retain
 * their current preview URL; durable browser media will be added with the
 * future IndexedDB web-storage layer.
 */
export async function persistDiaryPhoto({
  file,
  nativeUri,
  previewUrl,
}: PersistPhotoInput): Promise<PersistedDiaryPhoto | undefined> {
  if (!file && !nativeUri && !previewUrl) return undefined
  if (!isNativeApp()) return previewUrl ? { url: previewUrl } : undefined

  let data: string
  if (nativeUri) {
    const source = await Filesystem.readFile({ path: nativeUri })
    if (typeof source.data !== 'string') throw new Error('读取原始照片失败')
    data = source.data
  } else if (file) {
    data = await fileToBase64(file)
  } else {
    data = await previewToBase64(previewUrl as string)
  }

  const path = `${PHOTO_ROOT}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}.${extensionFor(file, nativeUri)}`
  await Filesystem.writeFile({
    path,
    data,
    directory: Directory.Library,
    recursive: true,
  })
  return { url: localDiaryPhotoReference(path), nativePath: path }
}

/** Best-effort cleanup — deleting a diary must not fail if its photo is gone. */
export async function deletePersistedDiaryPhoto(pathOrUri?: string) {
  if (!pathOrUri || !isNativeApp()) return
  try {
    const relativePath = relativePhotoPath(pathOrUri)
    if (relativePath) {
      await Filesystem.deleteFile({ path: relativePath, directory: Directory.Library })
    } else {
      await Filesystem.deleteFile({ path: pathOrUri })
    }
  } catch {
    // The file may have been removed by the OS already; the diary can still go.
  }
}

/** Reads all native diary photos referenced by a set of entries for backup. */
export async function exportDiaryPhotos(entries: Entry[]) {
  if (!isNativeApp()) return [] as DiaryPhotoBackupFile[]
  const paths = [
    ...new Set(
      entries
        .map((entry) => getRelativeDiaryPhotoPath(entry.imageUrl, entry.localImagePath))
        .filter((path): path is string => Boolean(path)),
    ),
  ]
  const photos: DiaryPhotoBackupFile[] = []
  for (const path of paths) {
    try {
      const result = await Filesystem.readFile({ path, directory: Directory.Library })
      if (typeof result.data === 'string') photos.push({ path, data: result.data })
    } catch {
      // A missing file should not make the user's remaining backup unusable.
    }
  }
  return photos
}

/** Restores backed-up photos before their diary records are made visible. */
export async function importDiaryPhotos(photos: DiaryPhotoBackupFile[]) {
  if (!isNativeApp() || !photos.length) return
  for (const photo of photos) {
    if (!relativePhotoPath(photo.path) || typeof photo.data !== 'string') continue
    await Filesystem.writeFile({
      path: photo.path,
      data: photo.data,
      directory: Directory.Library,
      recursive: true,
    })
  }
}
