/** Browser share / download helpers for demo PNG + JSON exports. */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

/**
 * Prefer Web Share API (files) when available — e.g. iOS share sheet → 微信/朋友圈/相册.
 * Falls back to download.
 */
export async function shareOrDownloadFile(opts: {
  blob: Blob
  filename: string
  title: string
  text?: string
}): Promise<'shared' | 'downloaded'> {
  const file = new File([opts.blob], opts.filename, {
    type: opts.blob.type || 'application/octet-stream',
  })
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }
  try {
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({
        files: [file],
        title: opts.title,
        text: opts.text,
      })
      return 'shared'
    }
    if (nav.share && !opts.blob.type.startsWith('image/')) {
      // text-only share fallback (JSON)
      await nav.share({ title: opts.title, text: opts.text })
      return 'shared'
    }
  } catch (err) {
    // User cancel → still allow silent return without download
    if (err instanceof Error && err.name === 'AbortError') {
      return 'shared'
    }
  }
  downloadBlob(opts.blob, opts.filename)
  return 'downloaded'
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = []
  const paragraphs = text.replace(/\r/g, '').split('\n')
  for (const para of paragraphs) {
    if (lines.length >= maxLines) break
    if (!para) {
      lines.push('')
      continue
    }
    let line = ''
    for (const ch of para) {
      const test = line + ch
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = ch
        if (lines.length >= maxLines) break
      } else {
        line = test
      }
    }
    if (lines.length < maxLines && line) lines.push(line)
  }
  if (lines.length > maxLines) return lines.slice(0, maxLines)
  return lines
}
