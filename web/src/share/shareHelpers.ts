/** Browser share / download helpers for demo PNG + JSON exports. */

export function isMobileClient() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    ua,
  )
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

/**
 * Mobile: open system share sheet so the user can save to Photos.
 * Desktop: always download the file (never try "save to library").
 */
export async function shareOrDownloadFile(opts: {
  blob: Blob
  filename: string
  title: string
  text?: string
}): Promise<'shared' | 'downloaded'> {
  // Desktop path first — never open share sheet / photo-library UX on PC
  if (!isMobileClient()) {
    downloadBlob(opts.blob, opts.filename)
    return 'downloaded'
  }

  const file = new File([opts.blob], opts.filename, {
    type: opts.blob.type || 'image/jpeg',
  })
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }

  if (nav.share) {
    try {
      const payload: ShareData = {
        files: [file],
        title: opts.title,
        text: opts.text,
      }
      // Prefer files share when supported (saves cleanly to Photos)
      if (!nav.canShare || nav.canShare({ files: [file] })) {
        await nav.share(payload)
        return 'shared'
      }
    } catch (err) {
      // User cancelled share sheet — treat as handled, don't force-download
      if (err instanceof Error && err.name === 'AbortError') {
        return 'shared'
      }
      // fall through to download fallback
    }
  }

  // Mobile fallback when Web Share is unavailable
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
    // data URLs / same-origin don't need CORS; skip for speed when possible
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous'
    }
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
