import { companionStartDate } from '../archive/archiveUtils'
import { companionDayStatus, toySignature } from '../archive/archiveUtils'
import type { Entry, Toy } from '../types'
import { diaryExcerpt, type MemorySharePhoto } from './memoryShareContent'
import { loadImage } from './shareHelpers'

const SERIF = '"Songti SC", "Noto Serif SC", "ZCOOL XiaoWei", Georgia, serif'
const SANS = '"Noto Sans SC", system-ui, sans-serif'
const INK = '#38291f'
const MUTED = '#87796c'

export interface MemoryShareCardOptions {
  toy: Toy
  photos: (MemorySharePhoto | undefined)[]
  diary?: Entry
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, size: number, width: number, family = SERIF) {
  ctx.font = `500 ${size}px ${family}`
  while (ctx.measureText(text).width > width && size > 14) {
    size -= 2
    ctx.font = `500 ${size}px ${family}`
  }
  return size
}

/** Wrap Chinese/Latin copy and ellipsize the final line instead of drawing over photos. */
function textBlock(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, size: number, maxLines: number, leading: number) {
  ctx.font = `500 ${size}px ${SERIF}`
  const chars = Array.from(text.replace(/\s+/g, ' ').trim())
  const lines: string[] = []
  let line = ''
  let index = 0
  while (index < chars.length && lines.length < maxLines) {
    const next = line + chars[index]
    if (ctx.measureText(next).width > width && line) {
      lines.push(line)
      line = ''
    } else {
      line = next
      index++
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  if (index < chars.length && lines.length) {
    let last = lines[lines.length - 1]
    while (ctx.measureText(`${last}…`).width > width && last) last = Array.from(last).slice(0, -1).join('')
    lines[lines.length - 1] = `${last}…`
  }
  lines.forEach((value, i) => ctx.fillText(value, x, y + i * leading))
}

function dateLabel(date: string) {
  return date.replace(/-/g, '.')
}

function localDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function posterImage(src: string) {
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

/** One renderer for both preview and the shared file: no interface controls in the poster. */
export async function renderMemoryShareCard(opts: MemoryShareCardOptions): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1440
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas 不可用')

  const images = await Promise.all(opts.photos.map((photo) => photo ? posterImage(photo.src) : Promise.resolve(null)))
  const status = companionDayStatus(opts.toy)
  const today = localDate()
  ctx.fillStyle = '#fffcf7'
  ctx.fillRect(0, 0, 1080, 1440)
  ctx.textBaseline = 'top'
  ctx.fillStyle = MUTED
  ctx.font = `500 19px ${SANS}`
  ctx.fillText('T O Y   D I A R Y', 64, 54)
  ctx.textAlign = 'right'
  ctx.fillText(today.slice(0, 7).replace('-', ' / '), 1016, 54)
  ctx.textAlign = 'left'
  ctx.fillStyle = INK
  const name = `${opts.toy.name}的`
  const nameSize = fitFont(ctx, name, 78, 418)
  if (nameSize >= 48) ctx.fillText(name, 64, 154)
  else textBlock(ctx, name, 64, 154, 418, 48, 2, 62)
  fitFont(ctx, '陪伴日记', 80, 418)
  ctx.fillText('陪伴日记', 64, 342)
  ctx.fillStyle = MUTED
  fitFont(ctx, 'OUR LITTLE MOMENTS', 20, 418, SANS)
  ctx.fillText('OUR LITTLE MOMENTS', 66, 442)

  ctx.fillStyle = INK
  const count = String(status.isFuture ? status.daysUntil : status.days).padStart(2, '0')
  let numberSize = fitFont(ctx, count, 172, 418, 'Georgia, serif')
  // WebKit's top baseline metrics differ from desktop fonts. Position by the
  // actual glyph bounds so the day label never overlaps the exported digits.
  ctx.textBaseline = 'alphabetic'
  let numberMetrics = ctx.measureText(count)
  while (numberMetrics.actualBoundingBoxAscent + numberMetrics.actualBoundingBoxDescent > 172 && numberSize > 16) {
    numberSize -= 2
    ctx.font = `500 ${numberSize}px Georgia, serif`
    numberMetrics = ctx.measureText(count)
  }
  const numberTop = 526
  ctx.fillText(count, 60, numberTop + numberMetrics.actualBoundingBoxAscent)
  const numberBottom = numberTop + numberMetrics.actualBoundingBoxAscent + numberMetrics.actualBoundingBoxDescent
  ctx.textBaseline = 'top'
  ctx.font = `500 37px ${SERIF}`
  ctx.fillText(status.isFuture ? '天后相遇' : '天的陪伴', 66, numberBottom + 24)
  ctx.fillRect(66, 775, 48, 2)
  ctx.fillStyle = MUTED
  ctx.font = `400 23px ${SANS}`
  ctx.fillText(`${status.isFuture ? '相遇日' : '相遇于'} ${dateLabel(companionStartDate(opts.toy))}`, 66, 799)

  ctx.fillStyle = INK
  textBlock(ctx, toySignature(opts.toy), 66, 880, 410, 32, 3, 46)
  ctx.fillStyle = MUTED
  ctx.font = `400 23px ${SANS}`
  ctx.fillText(opts.diary ? `日记摘录 / ${dateLabel(opts.diary.date)}` : '日记摘录', 66, 1060)
  ctx.fillStyle = INK
  const excerpt = diaryExcerpt(opts.diary)
  textBlock(ctx, excerpt ? `“${excerpt}”` : '下一篇陪伴日记，等你来写。', 66, 1107, 410, 30, 4, 44)

  for (let i = 0; i < 3; i++) {
    const x = 540
    const y = 112 + i * 414
    const width = 476
    const height = 396
    const image = images[i]
    if (image) {
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
      const cropWidth = width / scale
      const cropHeight = height / scale
      ctx.drawImage(image, (image.naturalWidth - cropWidth) / 2, (image.naturalHeight - cropHeight) / 2, cropWidth, cropHeight, x, y, width, height)
    } else {
      ctx.fillStyle = '#f1ece4'
      ctx.fillRect(x, y, width, height)
      ctx.fillStyle = MUTED
      ctx.textAlign = 'center'
      ctx.font = `400 27px ${SERIF}`
      ctx.fillText(opts.photos[i] ? '这一刻，藏在回忆里' : '下一段回忆', x + width / 2, y + 165)
      ctx.font = `400 18px ${SANS}`
      ctx.fillText(opts.photos[i] ? '照片暂时无法载入' : '等我们一起记录', x + width / 2, y + 212)
      ctx.textAlign = 'left'
    }
  }

  ctx.fillStyle = MUTED
  ctx.font = `400 19px ${SANS}`
  fitFont(ctx, status.isFuture ? `相遇日 ${dateLabel(companionStartDate(opts.toy))}` : `${dateLabel(companionStartDate(opts.toy))} — ${dateLabel(today)}`, 19, 418, SANS)
  ctx.fillText(status.isFuture ? `相遇日 ${dateLabel(companionStartDate(opts.toy))}` : `${dateLabel(companionStartDate(opts.toy))} — ${dateLabel(today)}`, 66, 1374)
  ctx.font = '400 19px Georgia, serif'
  ctx.textAlign = 'right'
  ctx.fillText('O U R   M E M O R I E S', 1016, 1374)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.94))
  if (!blob) throw new Error('纪念图生成失败')
  return blob
}
