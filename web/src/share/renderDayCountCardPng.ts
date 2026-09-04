/**
 * Export Days Matter–style companion / count-up card as PNG.
 * Background / font / palette apply ONLY to this export — never mutates site theme.
 *
 * Layout is intentionally compact: the white card should not dominate the whole image.
 */
import { toyAvatar } from '../archive/archiveUtils'
import {
  resolvePaletteForCanvas,
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

/** Canvas-safe font stack (no CSS variables — canvas cannot resolve them). */
function fontFamily(id: DayCountFont = 'display') {
  switch (id) {
    case 'display':
      // ZCOOL XiaoWei is the site display face; pad with bold serif fallbacks for digits
      return '"ZCOOL XiaoWei", "Noto Serif SC", "Songti SC", Georgia, serif'
    case 'rounded':
      return '"Nunito", "Noto Sans SC", ui-rounded, system-ui, sans-serif'
    case 'mono':
      return '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
    case 'serif':
      return 'Georgia, "Noto Serif SC", "Songti SC", serif'
    default:
      return '"Noto Sans SC", system-ui, sans-serif'
  }
}

/** Display / serif faces render optically smaller — bump their size. */
function numberFontSize(id: DayCountFont, digits: number) {
  const base =
    digits >= 4 ? 148 : digits === 3 ? 176 : digits === 1 ? 220 : 200
  if (id === 'display' || id === 'serif') return Math.round(base * 1.12)
  if (id === 'mono') return Math.round(base * 0.96)
  return base
}

export async function renderDayCountCardPng(
  opts: DayCountCardExportOptions,
): Promise<Blob> {
  // Compact canvas — easier to share, faster encode
  const W = 900
  const H = 1120
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas 不可用')

  // Best-effort: wait for display fonts so canvas measures correctly
  try {
    if (document.fonts?.ready) await document.fonts.ready
    // Nudge load of XiaoWei if registered
    await document.fonts.load('700 160px "ZCOOL XiaoWei"')
  } catch {
    /* ignore font load failures */
  }

  // Resolve live theme tokens so export matches current site palette
  const pal = resolvePaletteForCanvas(opts.palette)
  const numberValue = opts.isFuture
    ? Math.max(0, opts.daysUntil ?? 0)
    : Math.max(0, opts.days)
  const headerText = opts.isFuture ? '还有' : '已经'
  const title =
    opts.title ||
    (opts.isFuture
      ? `距离与 ${opts.toy.name} 相遇`
      : `和 ${opts.toy.name} 相遇`)
  const fontId = opts.font || 'display'

  // Background: custom photo or soft gradient — export only
  if (opts.backgroundUrl) {
    const bgImg = await loadImage(opts.backgroundUrl)
    if (bgImg) {
      const scale = Math.max(W / bgImg.width, H / bgImg.height)
      const bw = bgImg.width * scale
      const bh = bgImg.height * scale
      ctx.drawImage(bgImg, (W - bw) / 2, (H - bh) / 2, bw, bh)
      ctx.fillStyle = 'rgba(255,255,255,0.38)'
      ctx.fillRect(0, 0, W, H)
    } else {
      fillFallbackBg(ctx, W, H, pal)
    }
  } else {
    fillFallbackBg(ctx, W, H, pal)
  }

  // Compact centered card (not full-bleed)
  const cardW = 620
  const cardH = 700
  const cardX = (W - cardW) / 2
  const cardY = 150
  const headerH = 88
  const radius = 28

  // Soft drop shadow under card
  ctx.save()
  ctx.shadowColor = 'rgba(60, 48, 36, 0.18)'
  ctx.shadowBlur = 28
  ctx.shadowOffsetY = 10
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, cardX, cardY, cardW, cardH, radius)
  ctx.fill()
  ctx.restore()

  // Header bar — theme accent
  ctx.fillStyle = pal.number
  roundRect(ctx, cardX, cardY, cardW, headerH, radius)
  ctx.fill()
  // square off bottom of header so only top corners stay rounded
  ctx.fillRect(cardX, cardY + headerH / 2, cardW, headerH / 2 + 2)

  // Header title — may truncate long toy names
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.font = '600 26px "Noto Sans SC", sans-serif'
  const headerLine = `${title}  ${headerText}`
  let shown = headerLine
  while (ctx.measureText(shown).width > cardW - 48 && shown.length > 4) {
    shown = `${shown.slice(0, -4)}…`
  }
  ctx.fillText(shown, W / 2, cardY + 54)

  // Big number — optically balanced per font face
  const digits = String(numberValue)
  let numberSize = numberFontSize(fontId, digits.length)
  const family = fontFamily(fontId)
  ctx.fillStyle = pal.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 ${numberSize}px ${family}`

  // Fit-to-card: grow until width approaches card (display fonts often under-size)
  const maxWidth = cardW - 80
  let metrics = ctx.measureText(digits)
  // If too narrow (common with XiaoWei / missing glyph fallback), bump size
  if (metrics.width < maxWidth * 0.42) {
    numberSize = Math.min(Math.round(numberSize * 1.28), 240)
    ctx.font = `700 ${numberSize}px ${family}`
    metrics = ctx.measureText(digits)
  }
  // Cap if overflow
  while (ctx.measureText(digits).width > maxWidth && numberSize > 96) {
    numberSize -= 4
    ctx.font = `700 ${numberSize}px ${family}`
  }

  // Vertically center the number block in the upper-mid card area
  const numberBaseline = cardY + 200 + numberSize * 0.72
  ctx.fillText(digits, W / 2, numberBaseline)

  ctx.fillStyle = pal.unit
  ctx.font = '600 34px "Noto Sans SC", sans-serif'
  ctx.fillText('天', W / 2, numberBaseline + 48)

  // Divider
  const divY = cardY + cardH - 160
  ctx.strokeStyle = pal.creamDark
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 8])
  ctx.beginPath()
  ctx.moveTo(cardX + 40, divY)
  ctx.lineTo(cardX + cardW - 40, divY)
  ctx.stroke()
  ctx.setLineDash([])

  // Footer meta inside card
  ctx.fillStyle = pal.labelColor
  ctx.font = '500 18px "Noto Sans SC", sans-serif'
  const birth = opts.toy.birthDate
  ctx.fillText(
    opts.isFuture
      ? `相遇日: ${birth}`
      : `相遇日: ${birth} · 第 ${numberValue} 天`,
    W / 2,
    divY + 36,
  )

  // Avatar sits on the bottom edge of the card (half in / half out)
  const avR = 36
  const avCy = cardY + cardH
  const av = await loadImage(toyAvatar(opts.toy))
  if (av) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(W / 2, avCy, avR, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(av, W / 2 - avR, avCy - avR, avR * 2, avR * 2)
    ctx.restore()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(W / 2, avCy, avR, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = pal.border
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(W / 2, avCy, avR + 1, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Brand line under card
  ctx.fillStyle = pal.number
  ctx.font = '600 18px "Noto Sans SC", sans-serif'
  ctx.fillText('Toy Diary · 把陪伴写进时间里', W / 2, H - 56)

  // JPEG is smaller/faster; PNG kept if caller expects transparency — solid bg so JPEG ok
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9),
  )
  if (!blob) throw new Error('导出失败')
  return blob
}

function fillFallbackBg(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pal: ReturnType<typeof resolvePaletteForCanvas>,
) {
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, pal.mustardSoft)
  g.addColorStop(0.45, pal.headerMid)
  g.addColorStop(1, pal.cream)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = pal.border
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
