import { Capacitor, registerPlugin } from '@capacitor/core'

interface ToySubjectPlugin {
  removeBackground(options: {
    dataUrl: string
  }): Promise<{ dataUrl: string; removed: boolean }>
}

const ToySubject = registerPlugin<ToySubjectPlugin>('ToySubject')

export interface SubjectCutoutResult {
  blob: Blob
  removed: boolean
  message?: string
}

function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取照片失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * Uses Apple's on-device Vision segmentation in the native iOS app. Browser
 * previews intentionally fall back to the original photo without downloading
 * a large third-party model.
 */
export async function removeToyBackgroundNative(
  file: File,
): Promise<SubjectCutoutResult> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    return {
      blob: file,
      removed: false,
      message: '网页预览使用原图；iOS App 会在本机自动抠图',
    }
  }

  try {
    const result = await ToySubject.removeBackground({
      dataUrl: await fileToDataUrl(file),
    })
    const response = await fetch(result.dataUrl)
    return { blob: await response.blob(), removed: result.removed }
  } catch (error) {
    const detail = error instanceof Error ? error.message : ''
    const simulatorUnavailable = /inference context/i.test(detail)
    const systemUnavailable = /iOS 17|UNAVAILABLE/i.test(detail)
    return {
      blob: file,
      removed: false,
      message:
        simulatorUnavailable
          ? '当前模拟器不支持系统抠图，已保留原图；在真机上会自动识别玩偶主体'
          : systemUnavailable
            ? '自动抠图需要 iOS 17 或更高版本，已为你保留原图裁切'
          : '暂时没有识别到清晰的玩偶主体，已保留原图裁切',
    }
  }
}
