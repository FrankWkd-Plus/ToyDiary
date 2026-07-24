/**
 * Browser-side background removal for toy photos.
 * Uses @imgly/background-removal (AGPL — OK for hackathon/open demo).
 *
 * REPLACE_WITH_BACKEND: swap to a hosted matting API if licensing or model
 * download size becomes a problem for production.
 */

export type RemoveBgProgress = {
  /** Human-readable phase for the UI */
  phase: 'loading-model' | 'removing' | 'done' | 'fallback'
  /** 0–1 overall estimate */
  progress: number
  /** Raw key from the library, if any */
  key?: string
}

export type RemoveBgResult = {
  blob: Blob
  /** true when AI matting succeeded */
  removed: boolean
  /** true when we fell back to the original image */
  fallback: boolean
  message?: string
}

function estimatePhase(key: string, current: number, total: number): RemoveBgProgress {
  const ratio = total > 0 ? Math.min(1, current / total) : 0
  const lower = key.toLowerCase()
  if (
    lower.includes('download') ||
    lower.includes('fetch') ||
    lower.includes('model') ||
    lower.includes('wasm') ||
    lower.includes('ort')
  ) {
    return {
      phase: 'loading-model',
      progress: 0.05 + ratio * 0.55,
      key,
    }
  }
  return {
    phase: 'removing',
    progress: 0.6 + ratio * 0.35,
    key,
  }
}

/**
 * Remove background from a toy photo.
 * On failure returns the original file as a blob (fallback mode).
 */
export async function removeToyBackground(
  file: File | Blob,
  onProgress?: (p: RemoveBgProgress) => void,
): Promise<RemoveBgResult> {
  onProgress?.({ phase: 'loading-model', progress: 0.05 })

  try {
    // Dynamic import keeps the heavy ONNX stack out of the cold-start bundle.
    const { removeBackground } = await import('@imgly/background-removal')
    onProgress?.({ phase: 'loading-model', progress: 0.15 })

    const blob = await removeBackground(file, {
      // isnet is smaller/faster for mobile demo; quality is fine for stickers.
      model: 'isnet',
      output: {
        format: 'image/png',
        quality: 0.9,
      },
      progress: (key, current, total) => {
        onProgress?.(estimatePhase(String(key), current, total))
      },
    })

    onProgress?.({ phase: 'done', progress: 1 })
    return { blob, removed: true, fallback: false }
  } catch (err) {
    console.warn('[removeToyBackground] fallback to original', err)
    onProgress?.({ phase: 'fallback', progress: 1 })
    const blob =
      file instanceof Blob
        ? file
        : new Blob([file], { type: (file as File).type || 'image/jpeg' })
    return {
      blob,
      removed: false,
      fallback: true,
      message: err instanceof Error ? err.message : '抠图失败，已使用原图',
    }
  }
}

export function progressLabel(p: RemoveBgProgress): string {
  switch (p.phase) {
    case 'loading-model':
      return '正在准备玩偶识别模型…'
    case 'removing':
      return '正在把玩偶从照片里抱出来…'
    case 'fallback':
      return '抠图未成功，改用原图裁切…'
    case 'done':
      return '正在整理绒毛边缘…'
    default:
      return '处理中…'
  }
}
