/** Photo-led diary keepsake. Preview and download share this exact renderer. */
import type { Entry, Toy } from '../types'
import { diaryExcerpt } from './memoryShareContent'
import { loadImage } from './shareHelpers'

export interface DiaryCardOptions {
  entry: Entry
  toy?: Toy | null
}

const SERIF = '"Songti SC", "Noto Serif SC", "ZCOOL XiaoWei", Georgia, serif'
const INK = '#38291f'
const MUTED = '#87796c'

/** Compact place copy for a poster; the full address remains on the diary page. */
export function diaryPosterLocation(entry: Entry) {
  const place = entry.place
  const structured = [place?.city, place?.poi || place?.district || place?.region]
    .map((part) => part?.trim()).filter((part): part is string => Boolean(part))
  if (structured.length) return [...new Set(structured)].join(' · ')
  return (place?.displayName || entry.location || '').split(/[,，·]/)
    .map((part) => part.trim()).filter(Boolean).slice(0, 2).join(' · ')
}

function lines(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number) {
  const result: string[] = []
  const chars = Array.from(text.replace(/\s+/g, ' ').trim())
  let row = ''
  let index = 0
  while (index < chars.length && result.length < maxLines) {
    if (row && ctx.measureText(row + chars[index]).width > width) {
      // Carry the previous character forward rather than start a line with punctuation.
      if (/^[，。！？、；：）》”’]$/.test(chars[index]) && Array.from(row).length > 1) {
        const last = Array.from(row).pop()!
        result.push(Array.from(row).slice(0, -1).join(''))
        row = last
      } else {
        result.push(row)
        row = ''
      }
    } else {
      row += chars[index++]
    }
  }
  if (row && result.length < maxLines) result.push(row)
  if (index < chars.length && result.length) {
    let last = result[result.length - 1]
    while (last && ctx.measureText(`${last}…`).width > width) last = Array.from(last).slice(0, -1).join('')
    result[result.length - 1] = `${last}…`
  }
  return result
}

function singleLine(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number) {
  ctx.fillText(lines(ctx, text, width, 1)[0] || '', x, y)
}

async function photoForPoster(src?: string) {
  if (!src) return null
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      loadImage(src),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 8000) }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

export async function renderDiaryCardPng({ entry, toy }: DiaryCardOptions): Promise<Blob> {
  const image = await photoForPoster(entry.imageUrl)
  if (entry.imageUrl && !image) throw new Error('照片暂时无法载入，请稍后重试')
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas 不可用')
  const W = 1080
  const paperX = 64
  const contentX = 112
  const contentW = W - contentX * 2
  const photoY = 168
  const ratio = image ? image.naturalWidth / image.naturalHeight : 1
  const photoH = image ? Math.min(contentW / ratio, 1480) : 0
  const photoW = image ? photoH * ratio : 0
  const title = entry.title?.trim() || entry.userNote?.trim() || '一起收藏的这一天'
  const note = entry.userNote?.trim() && entry.userNote.trim() !== title ? entry.userNote.trim() : ''
  const excerpt = entry.aiDiary?.trim() ? diaryExcerpt({ ...entry, userNote: undefined }) : ''
  ctx.font = `500 62px ${SERIF}`
  const titleLines = lines(ctx, title, contentW, 2)
  ctx.font = `400 32px ${SERIF}`
  const noteLines = lines(ctx, note, contentW, 2)
  const excerptLines = lines(ctx, excerpt, contentW, 4)
  const textY = image ? photoY + photoH + 48 : photoY + 24
  const titleY = textY + 44
  const noteY = titleY + titleLines.length * 84 + 22
  const excerptY = noteY + (noteLines.length ? noteLines.length * 48 + 32 : 0)
  const textBottom = excerptY + (excerptLines.length ? 70 + excerptLines.length * 48 : 0)
  const footerY = textBottom + 64
  const H = Math.ceil(Math.max(footerY + 128, 780))
  canvas.width = W
  canvas.height = H

  // Downsample before enlarging: soft background works even when WebKit lacks canvas filters.
  ctx.fillStyle = '#ead9c4'
  ctx.fillRect(0, 0, W, H)
  if (image) {
    const wash = document.createElement('canvas')
    wash.width = 24
    wash.height = Math.ceil(24 * H / W)
    const washCtx = wash.getContext('2d')!
    const scale = Math.max(wash.width / image.naturalWidth, wash.height / image.naturalHeight)
    const width = image.naturalWidth * scale
    const height = image.naturalHeight * scale
    washCtx.drawImage(image, (wash.width - width) / 2, (wash.height - height) / 2, width, height)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(wash, 0, 0, W, H)
    ctx.fillStyle = 'rgba(244,232,213,0.55)'
    ctx.fillRect(0, 0, W, H)
  }
  ctx.save()
  ctx.shadowColor = 'rgba(55,36,20,0.14)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 12
  ctx.fillStyle = '#fffcf6'
  ctx.fillRect(paperX, 64, W - paperX * 2, H - 128)
  ctx.restore()
  // Subtle paper grain; all photo pixels are drawn untouched above this layer.
  ctx.fillStyle = 'rgba(112,84,54,0.035)'
  for (let i = 0; i < 1800; i++) {
    const x = paperX + ((i * 137) % (W - paperX * 2))
    const y = 64 + ((i * 193) % (H - 128))
    ctx.fillRect(x, y, 1, 1)
  }

  ctx.textBaseline = 'top'
  ctx.fillStyle = INK
  ctx.font = `400 27px ${SERIF}`
  singleLine(ctx, `${toy?.name || '玩偶'} · 陪伴日记`, contentX, 108, 570)
  ctx.textAlign = 'right'
  ctx.fillText(entry.date.replace(/-/g, '.'), W - contentX, 108)
  ctx.textAlign = 'left'
  if (image) ctx.drawImage(image, (W - photoW) / 2, photoY, photoW, photoH)

  ctx.fillStyle = MUTED
  ctx.font = '400 21px Georgia, serif'
  ctx.fillText('A  L I T T L E  M O M E N T', contentX, textY)
  ctx.fillStyle = INK
  ctx.font = `500 62px ${SERIF}`
  titleLines.forEach((line, i) => ctx.fillText(line, contentX, titleY + i * 84))
  ctx.font = `400 32px ${SERIF}`
  noteLines.forEach((line, i) => ctx.fillText(line, contentX, noteY + i * 48))
  if (excerptLines.length) {
    ctx.fillStyle = MUTED
    ctx.font = `400 25px ${SERIF}`
    singleLine(ctx, `${toy?.name || '玩偶'}记得`, contentX, excerptY, contentW)
    ctx.fillRect(contentX, excerptY + 42, 46, 1)
    ctx.fillStyle = INK
    ctx.font = `400 32px ${SERIF}`
    excerptLines.forEach((line, i) => ctx.fillText(line, contentX, excerptY + 70 + i * 48))
  }
  ctx.fillStyle = MUTED
  ctx.fillRect(contentX, footerY, contentW, 1)
  ctx.font = `400 24px ${SERIF}`
  singleLine(ctx, diaryPosterLocation(entry), contentX, footerY + 30, 580)
  ctx.font = '400 20px Georgia, serif'
  ctx.textAlign = 'right'
  ctx.fillText('T O Y  D I A R Y', W - contentX, footerY + 32)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.94))
  if (!blob) throw new Error('生成图片失败')
  return blob
}
