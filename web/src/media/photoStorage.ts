import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'

/**
 * A `blob:` URL belongs to one WebView document only. Diary photos therefore
 * get copied into the native app container before an entry is persisted.
 */
const PHOTO_ROOT = 'ToyDiary/photos'

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

/**
 * Returns a stable Capacitor-served URL on iOS/Android. Browser builds retain
 * their current preview URL; durable browser media will be added with the
 * future IndexedDB web-storage layer.
 */
export async function persistDiaryPhoto({
  file,
  nativeUri,
  previewUrl,
}: PersistPhotoInput): Promise<string | undefined> {
  if (!file && !nativeUri && !previewUrl) return undefined
  if (!isNativeApp()) return previewUrl

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
  const saved = await Filesystem.writeFile({
    path,
    data,
    directory: Directory.Library,
    recursive: true,
  })
  return Capacitor.convertFileSrc(saved.uri)
}
