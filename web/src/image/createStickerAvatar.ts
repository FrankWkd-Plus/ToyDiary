/**
 * Canvas sticker pipeline:
 * transparent cutout → auto-crop → white outline → 512×512 centered avatar.
 *
 * REPLACE_WITH_BACKEND: store final WebP/PNG in R2/S3; keep only avatarUrl in DB.
 */

export type StickerBorder = 'thin' | 'standard' | 'thick'
export type StickerPreviewBg = 'transparent' | 'cream' | 'mint'

export type StickerOptions = {
  size?: number
  /** white outline thickness in source-alpha space before scale */
  border?: StickerBorder
  /** subject scale inside the square (0.5–0.95) */
  subjectScale?: number
  /** pan offset in normalized canvas space (-0.5..0.5) */
  offsetX?: number
  offsetY?: number
  /** extra user zoom on top of subjectScale */
  zoom?: number
}

const BORDER_PX: Record<StickerBorder, number> = {
  thin: 6,
  standard: 10,
  thick: 16,
}

export const PREVIEW_BG: Record<StickerPreviewBg, string> = {
  transparent: 'transparent',
  cream: '#fff8ef',
  mint: '#e8f5ee',
}

function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src)
    const img = new Image()
    img.onload = () => {
      if (typeof src !== 'string') URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      if (typeof src !== 'string') URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.crossOrigin = 'anonymous'
    img.src = url
  })
}

function findOpaqueBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = 12,
) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3]
      if (a > alphaThreshold) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 }
  }
  return { minX, minY, maxX, maxY }
}

function dilateAlpha(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  const out = new Uint8Array(width * height)
  const r = Math.max(1, Math.round(radius))
  // Chebyshev distance dilation — fast enough for ≤1024px cutouts
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hit = 0
      const y0 = Math.max(0, y - r)
      const y1 = Math.min(height - 1, y + r)
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(width - 1, x + r)
      outer: for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          if (src[(yy * width + xx) * 4 + 3] > 16) {
            hit = 255
            break outer
          }
        }
      }
      out[y * width + x] = hit
    }
  }
  return out
}

/**
 * Build a white-border sticker avatar data URL (PNG).
 * Accepts either a transparent cutout or a normal photo (fallback crop).
 */
export async function createStickerAvatar(
  source: Blob | string,
  options: StickerOptions = {},
): Promise<string> {
  const size = options.size ?? 512
  const border = options.border ?? 'standard'
  const subjectScale = options.subjectScale ?? 0.8
  const zoom = options.zoom ?? 1
  const offsetX = options.offsetX ?? 0
  const offsetY = options.offsetY ?? 0
  const borderPx = BORDER_PX[border]

  const img = await loadImage(source)
  // Work canvas at image resolution (capped) for quality/speed balance
  const maxSide = 768
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))

  const work = document.createElement('canvas')
  work.width = w
  work.height = h
  const wctx = work.getContext('2d', { willReadFrequently: true })
  if (!wctx) throw new Error('Canvas unavailable')
  wctx.clearRect(0, 0, w, h)
  wctx.drawImage(img, 0, 0, w, h)

  const imageData = wctx.getImageData(0, 0, w, h)
  const bounds = findOpaqueBounds(imageData.data, w, h)
  const pad = borderPx + 4
  const cropX = Math.max(0, bounds.minX - pad)
  const cropY = Math.max(0, bounds.minY - pad)
  const cropW = Math.min(w - cropX, bounds.maxX - bounds.minX + 1 + pad * 2)
  const cropH = Math.min(h - cropY, bounds.maxY - bounds.minY + 1 + pad * 2)

  // Cropped subject canvas
  const subject = document.createElement('canvas')
  subject.width = cropW
  subject.height = cropH
  const sctx = subject.getContext('2d', { willReadFrequently: true })
  if (!sctx) throw new Error('Canvas unavailable')
  sctx.drawImage(work, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

  // White outline via alpha dilation
  const subjectData = sctx.getImageData(0, 0, cropW, cropH)
  const dilated = dilateAlpha(subjectData.data, cropW, cropH, borderPx)
  const outline = document.createElement('canvas')
  outline.width = cropW
  outline.height = cropH
  const octx = outline.getContext('2d')
  if (!octx) throw new Error('Canvas unavailable')
  const outlineData = octx.createImageData(cropW, cropH)
  for (let i = 0; i < dilated.length; i++) {
    const v = dilated[i]
    const p = i * 4
    outlineData.data[p] = 255
    outlineData.data[p + 1] = 255
    outlineData.data[p + 2] = 255
    outlineData.data[p + 3] = v
  }
  octx.putImageData(outlineData, 0, 0)
  // Draw original subject on top of white silhouette
  octx.drawImage(subject, 0, 0)

  // Compose into final square
  const out = document.createElement('canvas')
  out.width = size
  out.height = size
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.clearRect(0, 0, size, size)

  const fit = Math.min(size / cropW, size / cropH) * subjectScale * zoom
  const drawW = cropW * fit
  const drawH = cropH * fit
  const dx = (size - drawW) / 2 + offsetX * size
  const dy = (size - drawH) / 2 + offsetY * size
  ctx.drawImage(outline, dx, dy, drawW, drawH)

  // Prefer PNG for transparency (MVP Data URL). Compress if huge.
  let dataUrl = out.toDataURL('image/png')
  if (dataUrl.length > 900_000) {
    // Slightly smaller working size export as webp when supported
    try {
      dataUrl = out.toDataURL('image/webp', 0.88)
    } catch {
      // keep png
    }
  }
  return dataUrl
}

/** Soft-center crop of a non-transparent photo (fallback path). */
export async function createFallbackAvatar(
  source: Blob | string,
  options: StickerOptions = {},
): Promise<string> {
  // Reuse sticker pipeline — for non-transparent images, bounds = full image,
  // white border still frames the square like a sticker polaroid.
  return createStickerAvatar(source, {
    ...options,
    border: options.border ?? 'standard',
    subjectScale: options.subjectScale ?? 0.88,
  })
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取失败'))
    reader.readAsDataURL(blob)
  })
}
