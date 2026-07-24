/**
 * Export Days Matter–style companion / count-up card as PNG.
 * Background / font / palette apply ONLY to this export — never mutates site theme.
 */
import { companionDays, toyAvatar } from '../archive/archiveUtils'
import {
  DAY_COUNT_FONTS,
  DAY_COUNT_PALETTES,
  type DayCountFont,
  type DayCountPalette,
} from '../daysmatter/dayCountTheme'
import type { Toy } from '../types'
import { loadImage, roundRect } from './shareHelpers'

export interface DayCountCardExportOptions {
  toy: Toy
  days: number
  isFuture?: boolean
  daysUntil?: number
  /** Export-only background image (data URL or path). Does not touch site CSS. */
  backgroundUrl?: string
  palette?: DayCountPalette
  font?: DayCountFont
  title?: string
}

function paletteColors(id: DayCountPalette = 'matcha') {
  return DAY_COUNT_PALETTES.find((p) => p.id === id) || DAY_COUNT_PALETTES[0]
}

function fontFamily(id: DayCountFont = 'display') {
  return DAY_COUNT_FONTS.find((f) => f.id === id)?.family || 'serif'
}

export async function renderDayCountCardPng(
  opts: DayCountCardExportOptions,
): Promise<Blob> {
  const W = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')

  const pal = paletteColors(opts.palette)
  const numberValue = opts.isFuture
    ? Math.max(0, opts.daysUntil ?? 0)
    : Math.max(0, opts.days)
  const headerText = opts.isFuture ? '还有' : '已经'
  const title =
    opts.title ||
    (opts.isFuture
      ? `距离与 ${opts.toy.name} 相遇`
      : `和 ${opts.toy.name} 相遇`)

  // Background: custom photo or soft gradient — export only
  if (opts.backgroundUrl) {
    const bgImg = await loadImage(opts.backgroundUrl)
    if (bgImg) {
      const scale = Math.max(W / bgImg.width, H / bgImg.height)
      const bw = bgImg.width * scale
      const bh = bgImg.height * scale
      ctx.drawImage(bgImg, (W - bw) / 2, (H - bh) / 2, bw, bh)
      ctx.fillStyle = 'rgba(255,255,255,0.42)'
      ctx.fillRect(0, 0, W, H)
    } else {
      fillFallbackBg(ctx, W, H)
    }
  } else {
    fillFallbackBg(ctx, W, H)
  }

  // Card
  const cardX = 90
  const cardY = 220
  const cardW = W - 180
  const cardH = 860
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, cardX, cardY, cardW, cardH, 36)
  ctx.fill()
  ctx.shadowColor = 'transparent'

  // Header bar (Days Matter style)
  ctx.fillStyle = pal.number
  roundRect(ctx, cardX, cardY, cardW, 120, 36)
  ctx.fill()
  // square bottom of header
  ctx.fillRect(cardX, cardY + 60, cardW, 60)

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.font = '600 40px "Noto Sans SC", sans-serif'
  ctx.fillText(`${title}  ${headerText}`, W / 2, cardY + 72)

  // Big number
  ctx.fillStyle = '#2a2622'
  ctx.font = `700 220px ${fontFamily(opts.font)}`
  ctx.fillText(String(numberValue), W / 2, cardY + 420)
  ctx.fillStyle = pal.unit
  ctx.font = '600 48px "Noto Sans SC", sans-serif'
  ctx.fillText('天', W / 2, cardY + 500)

  // Footer meta
  ctx.strokeStyle = '#ece6dc'
  ctx.lineWidth = 2
  ctx.setLineDash([8, 10])
  ctx.beginPath()
  ctx.moveTo(cardX + 48, cardY + 720)
  ctx.lineTo(cardX + cardW - 48, cardY + 720)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = '#8a7563'
  ctx.font = '28px "Noto Sans SC", sans-serif'
  const birth = opts.toy.birthDate
  ctx.fillText(
    opts.isFuture
      ? `相遇日: ${birth}`
      : `相遇日: ${birth} · 第 ${numberValue} 天`,
    W / 2,
    cardY + 780,
  )

  // Avatar chip
  const av = await loadImage(toyAvatar(opts.toy))
  if (av) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(W / 2, cardY + cardH + 70, 48, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(av, W / 2 - 48, cardY + cardH + 22, 96, 96)
    ctx.restore()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(W / 2, cardY + cardH + 70, 48, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.fillStyle = pal.number
  ctx.font = '600 26px "Noto Sans SC", sans-serif'
  ctx.fillText('Toy Dairy · 把陪伴写进时间里', W / 2, H - 70)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  )
  if (!blob) throw new Error('导出失败')
  return blob
}

function fillFallbackBg(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
) {
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#f3e6d0')
  g.addColorStop(0.5, '#e8f0e4')
  g.addColorStop(1, '#f7efe4')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // wood-ish lines subtle
  ctx.strokeStyle = 'rgba(120,90,60,0.06)'
  ctx.lineWidth = 2
  for (let y = 0; y < H; y += 28) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y + 8)
    ctx.stroke()
  }
}

export async function renderMemorialSharePng(opts: {
  toy: Toy
  days: number
  photoSrc: string
  caption?: string
  backgroundUrl?: string
  palette?: DayCountPalette
  font?: DayCountFont
}): Promise<Blob> {
  return renderDayCountCardPng({
    toy: opts.toy,
    days: opts.days,
    backgroundUrl: opts.backgroundUrl || opts.photoSrc,
    palette: opts.palette,
    font: opts.font,
    title: opts.caption || `和 ${opts.toy.name} 相遇`,
  })
}

// keep companionDays import used for callers convenience re-export
export { companionDays }
