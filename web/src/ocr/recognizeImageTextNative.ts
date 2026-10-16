import { Capacitor, registerPlugin } from '@capacitor/core'
import { blobToDataUrl } from '../image/createStickerAvatar'

/** Native side lives in `ios/App/App/SceneDelegate.swift` (`ToySubjectPlugin`). */
interface ToySubjectPlugin {
  recognizeText(options: { dataUrl: string }): Promise<{ text: string }>
}

const ToySubject = registerPlugin<ToySubjectPlugin>('ToySubject')

export function isNativeIosClient() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}

async function toDataUrl(image: File | string) {
  if (typeof image !== 'string') return blobToDataUrl(image)
  if (image.startsWith('data:')) return image
  const response = await fetch(image)
  if (!response.ok) throw new Error('读取照片失败')
  return blobToDataUrl(await response.blob())
}

/**
 * Apple's on-device Vision recogniser, so the native app needs no downloaded
 * model. Mirrors the shape of the tesseract path: same line-normalised output,
 * and it throws rather than returning a partial result so the caller keeps its
 * existing "OCR 暂时未识别成功" fallback.
 */
export async function recognizeTextNative(image: File | string) {
  const result = await ToySubject.recognizeText({
    dataUrl: await toDataUrl(image),
  })
  return String(result.text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}
