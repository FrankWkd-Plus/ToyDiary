/**
 * Browser-side background removal for toy photos.
 * Uses @imgly/background-removal (AGPL — OK for hackathon/open demo).
 *
 * Model sizes (from IMG.LY CDN, first run only; then browser-cached):
 *   isnet_quint8 ≈ 40 MB  (smallest, quantized — default for mobile demo)
 *   isnet_fp16   ≈ 80 MB  (library default)
 *   isnet        ≈ full precision (largest)
 *
 * REPLACE_WITH_BACKEND: swap to a hosted matting API if licensing or model
 * download size becomes a problem for production.
 */

export type RemoveBgProgress = {
  /** Human-readable phase for the UI */
  phase: 'import' | 'loading-model' | 'removing' | 'done' | 'fallback'
  /** 0–1 overall estimate */
  progress: number
  /** Raw key from the library, if any */
  key?: string
  /** Bytes-ish counters when the library reports them */
  current?: number
  total?: number
  /** Short status for the progress bar caption */
  detail?: string
}

export type RemoveBgResult = {
  blob: Blob
  /** true when AI matting succeeded */
  removed: boolean
  /** true when we fell back to the original image */
  fallback: boolean
  message?: string
}

/** Smallest shipped model (~40MB). Prefer this on mobile / weak networks. */
export const DEFAULT_MODEL = 'isnet_quint8' as const

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function estimatePhase(
  key: string,
  current: number,
  total: number,
): RemoveBgProgress {
  const ratio = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0
  const lower = key.toLowerCase()
  const detail =
    total > 0
      ? `${formatBytes(current)} / ${formatBytes(total)}`
      : key
        ? String(key)
        : undefined

  if (
    lower.includes('download') ||
    lower.includes('fetch') ||
    lower.includes('model') ||
    lower.includes('wasm') ||
    lower.includes('ort') ||
    lower.includes('onnx') ||
    lower.includes('chunk') ||
    lower.includes('resource')
  ) {
    // Map download into 10%–75% of the overall bar.
    return {
      phase: 'loading-model',
      progress: 0.1 + ratio * 0.65,
      key,
      current,
      total,
      detail,
    }
  }

  return {
    phase: 'removing',
    progress: 0.75 + ratio * 0.2,
    key,
    current,
    total,
    detail: detail || '推理中…',
  }
}

/**
 * Downscale very large photos before matting — speeds up first-run + inference.
 * Max side 1280 keeps sticker quality while cutting decode/infer cost.
 */
async function downscaleForMatting(file: File | Blob, maxSide = 1280): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    if (scale >= 0.98) {
      bitmap.close?.()
      return file instanceof Blob ? file : file
    }
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close?.()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    )
    return blob || file
  } catch {
    return file
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
  onProgress?.({
    phase: 'import',
    progress: 0.02,
    detail: '加载抠图引擎…',
  })

  // Smooth “still working” pulse while the library is silent (import / worker boot).
  let pulse = 0.02
  const pulseTimer = window.setInterval(() => {
    pulse = Math.min(0.12, pulse + 0.008)
    onProgress?.({
      phase: 'import',
      progress: pulse,
      detail: '加载抠图引擎（首次较慢）…',
    })
  }, 400)

  try {
    // Dynamic import keeps the heavy ONNX stack out of the cold-start bundle.
    const { removeBackground } = await import('@imgly/background-removal')
    window.clearInterval(pulseTimer)

    onProgress?.({
      phase: 'loading-model',
      progress: 0.12,
      detail: '准备下载最小模型 isnet_quint8（约 40MB）…',
    })

    const input = await downscaleForMatting(file)

    // Progress callbacks may fire from a Worker — bridge via rAF so React re-renders.
    let lastEmit = 0
    const emit = (p: RemoveBgProgress) => {
      const now = performance.now()
      // Throttle UI updates a bit, but always allow 100% / phase changes.
      if (p.progress >= 0.99 || now - lastEmit > 80) {
        lastEmit = now
        onProgress?.(p)
      } else {
        onProgress?.(p)
      }
    }

    const blob = await removeBackground(input, {
      // Smallest quantized model (~40MB). Still cached after first download.
      model: DEFAULT_MODEL,
      // Prefer CPU for broader mobile compatibility; GPU can hang on some devices.
      device: 'cpu',
      // Main-thread progress is more reliable for UI than worker-only callbacks.
      proxyToWorker: false,
      debug: false,
      output: {
        format: 'image/png',
        quality: 0.9,
      },
      progress: (key, current, total) => {
        emit(estimatePhase(String(key ?? ''), Number(current) || 0, Number(total) || 0))
      },
    })

    onProgress?.({ phase: 'done', progress: 1, detail: '抠图完成' })
    return { blob, removed: true, fallback: false }
  } catch (err) {
    window.clearInterval(pulseTimer)
    console.warn('[removeToyBackground] fallback to original', err)
    onProgress?.({
      phase: 'fallback',
      progress: 1,
      detail: '抠图失败，改用原图',
    })
    const blob =
      file instanceof Blob
        ? file
        : new Blob([file], { type: (file as File).type || 'image/jpeg' })
    return {
      blob,
      removed: false,
      fallback: true,
      message:
        err instanceof Error
          ? `抠图失败（${err.message}），已使用原图`
          : '抠图失败，已使用原图',
    }
  }
}

export function progressLabel(p: RemoveBgProgress): string {
  switch (p.phase) {
    case 'import':
      return '正在加载抠图引擎…'
    case 'loading-model':
      return '正在下载最小模型（约 40MB，仅首次）…'
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
