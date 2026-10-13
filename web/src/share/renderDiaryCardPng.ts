/**
 * Export a dual-perspective diary card as PNG.
 *
 * v2 design goals (2026-10):
 *  - Photo is shown FULLY (no center-crop): card height adapts to the
 *    photo's real aspect ratio. Portrait 9:16 shots are never sliced.
 *  - Card height adapts to text length (no truncation, no giant blanks).
 *  - Layout "side" = chat-bubble pair (yours: paper; toy's: theme tint
 *    + avatar) so the two voices are instantly distinguishable.
 *  - Layout "stack" = letter style: your note on top, dashed divider,
 *    toy's reply in a soft tinted block below.
 *  - Palette follows the active theme via CSS variables (with fallbacks),
 *    so exported cards match whatever theme the user picked in-app.
 */
import { companionDays, toyAvatar } from '../archive/archiveUtils'
import type { Entry, Toy } from '../types'
import { loadImage, roundRect, wrapText } from './shareHelpers'

export type DiaryCardLayout = 'side' | 'stack'

export interface DiaryCardOptions {
  entry: Entry
  toy?: Toy | null
  layout: DiaryCardLayout
  /** decorative sticker frame */
  stickerFrame: boolean
  /** show companion day count */
  showDayCount: boolean
  /** show location as visible grey text + pin under the title */
  showLocation: boolean
}

interface Palette {
  bgFrom: string
  bgTo: string
  paper: string
  ink: string
  muted: string
  accent: string
  accentDeep: string
  bubbleMine: string
  bubbleToy: string
  line: string
}

function cssVar(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim()
    return v || fallback
  } catch {
    return fallback
  }
}

function readPalette(): Palette {
  return {
    bgFrom: cssVar('--color-mist-soft', '#e8f5ee'),
    bgTo: cssVar('--color-peach-soft', '#fff0eb'),
    paper: cssVar('--color-paper', '#fffdf8'),
    ink: cssVar('--color-ink', '#4a433c'),
    muted: cssVar('--color-ink-muted', '#8a7563'),
    accent: cssVar('--color-matcha', '#b5a06a'),
    accentDeep: cssVar('--color-matcha-deep', '#9a8758'),
    bubbleMine: cssVar('--color-paper', '#fffdf8'),
    bubbleToy: cssVar('--color-mustard-soft', '#fff6e0'),
    line: cssVar('--color-line', '#e8e4dc'),
  }
}

export async function renderDiaryCardPng(
  opts: DiaryCardOptions,
): Promise<Blob> {
  const { entry, toy, layout, stickerFrame, showDayCount, showLocation } = opts

  const W = 720
  const pad = 32
  const inner = 24 // card inner side padding (photo/boxes inset)
  const palette = readPalette()

  // ---- preload images in parallel before any measuring/painting ----
  const [entryImg, avatarImg] = await Promise.all([
    entry.imageUrl ? loadImage(entry.imageUrl) : Promise.resolve(null),
    toy ? loadImage(toyAvatar(toy, 0)) : Promise.resolve(null),
  ])

  const toyName = toy?.name || '玩偶'
  const days = toy ? companionDays(toy) : 0
  const locationText =
    entry.place?.displayName?.trim() || entry.location?.trim() || ''

  const ownerText =
    entry.userNote?.trim() ||
    entry.title?.trim() ||
    (locationText
      ? `今天和 ${toyName} 一起去了${locationText}。`
      : `今天想把这一刻写给 ${toyName}。`)
  const toyText =
    entry.aiDiary?.trim() ||
    `我是${toyName}。${locationText ? `在${locationText}，` : ''}和你一起经历的这一天，我想记住。`

  // ---- measuring pass (dummy context with fonts set) ----
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('Canvas 不可用')
  const fontBody = '400 15px "Noto Sans SC", sans-serif'
  const lineH = 24
  const maxBodyLines = 12

  measure.font = fontBody
  const wrapBody = (text: string, maxW: number): string[] => {
    const lines = wrapText(measure, text, maxW, maxBodyLines)
    // mark truncation with an ellipsis (wrapText silently cuts at maxLines)
    const rawLines = wrapText(measure, text, maxW, 9999)
    if (rawLines.length > lines.length && lines.length > 0) {
      const last = lines[lines.length - 1]
      lines[lines.length - 1] =
        last.length > 2 ? last.slice(0, -2) + '…' : last + '…'
    }
    return lines
  }

  // ---- photo block: FULL image, aspect-true, capped ----
  const photoW = W - pad * 2 - inner * 2
  let photoH = 0
  let drawPhotoW = photoW
  if (entryImg && entryImg.width && entryImg.height) {
    const r = entryImg.width / entryImg.height
    const naturalH = photoW / r
    photoH = Math.min(naturalH, 620)
    if (naturalH > photoH) drawPhotoW = photoH * r // too tall → fit by height
  }

  // ---- header block height ----
  const headerH = 86 + (showLocation && locationText ? 30 : 0)

  // ---- perspective blocks heights ----
  let blocksH = 0
  let sideLinesOwner: string[] = []
  let sideLinesToy: string[] = []
  let stackLinesOwner: string[] = []
  let stackLinesToy: string[] = []
  const dividerH = 44

  if (layout === 'side') {
    const colW = (W - pad * 2 - inner * 2 - 16) / 2
    sideLinesOwner = wrapBody(ownerText, colW - 30)
    sideLinesToy = wrapBody(toyText, colW - 30)
    const rows = Math.max(sideLinesOwner.length, sideLinesToy.length, 3)
    blocksH = 52 + rows * lineH + 24
  } else {
    const boxW = W - pad * 2 - inner * 2
    stackLinesOwner = wrapBody(ownerText, boxW - 36)
    stackLinesToy = wrapBody(toyText, boxW - 36)
    blocksH =
      34 + stackLinesOwner.length * lineH + 14 + // your letter part
      dividerH +
      52 + stackLinesToy.length * lineH + 24 // toy reply block
  }

  const footerH = 58
  const H = Math.round(
    pad +
      headerH +
      (entryImg ? photoH + 22 : 0) +
      blocksH +
      footerH +
      pad,
  )

  // ---- paint ----
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas 不可用')

  // outer bg — follows theme
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, palette.bgFrom)
  bg.addColorStop(1, palette.bgTo)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // card sheet
  ctx.fillStyle = palette.paper
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 26)
  ctx.fill()

  if (stickerFrame) {
    ctx.strokeStyle = palette.accent
    ctx.lineWidth = 6
    roundRect(ctx, pad + 10, pad + 10, W - pad * 2 - 20, H - pad * 2 - 20, 20)
    ctx.stroke()
    const corners = [
      [pad + 22, pad + 34],
      [W - pad - 46, pad + 34],
      [pad + 22, H - pad - 42],
      [W - pad - 46, H - pad - 42],
    ] as const
    ctx.font = '26px serif'
    ;['🌸', '⭐', '🧸', '🍀'].forEach((g, i) => {
      ctx.fillText(g, corners[i][0], corners[i][1])
    })
  }

  const contentX = pad + inner
  const contentW = W - pad * 2 - inner * 2

  // header: title
  ctx.fillStyle = palette.ink
  ctx.textAlign = 'left'
  ctx.font = '700 30px "Noto Sans SC", sans-serif'
  let title = entry.title || '今日日记'
  while (ctx.measureText(title).width > contentW - (showDayCount ? 120 : 0) && title.length > 2) {
    title = title.slice(0, -2) + '…'
  }
  ctx.fillText(title, contentX, pad + 50)

  // header: date + mood
  ctx.fillStyle = palette.muted
  ctx.font = '500 16px "Noto Sans SC", sans-serif'
  ctx.fillText(
    `${entry.date}${entry.mood ? ` · ${entry.mood}` : ''}`,
    contentX,
    pad + 80,
  )

  // day counter
  if (showDayCount) {
    ctx.fillStyle = palette.accentDeep
    ctx.font = '700 22px "Noto Sans SC", sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`DAY ${days}`, W - pad - inner, pad + 50)
    ctx.font = '500 13px "Noto Sans SC", sans-serif'
    ctx.fillText('正数日', W - pad - inner, pad + 72)
    ctx.textAlign = 'left'
  }

  // location line with pin
  if (showLocation && locationText) {
    drawPinLine(ctx, {
      x: contentX,
      y: pad + 108,
      text: locationText,
      color: palette.muted,
      maxWidth: contentW,
    })
  }

  // photo — FULL aspect-true rendering
  let cursorY = pad + headerH
  if (entryImg) {
    ctx.save()
    roundRect(
      ctx,
      contentX + (contentW - drawPhotoW) / 2,
      cursorY,
      drawPhotoW,
      photoH,
      18,
    )
    ctx.clip()
    ctx.drawImage(
      entryImg,
      contentX + (contentW - drawPhotoW) / 2,
      cursorY,
      drawPhotoW,
      photoH,
    )
    ctx.restore()
    cursorY += photoH + 22
  }

  // ---- perspective blocks ----
  if (layout === 'side') {
    // Chat-bubble pair: left = yours (paper + border), right = toy's (tint + avatar)
    const colW = (contentW - 16) / 2
    const boxH = blocksH
    const leftX = contentX
    const rightX = contentX + colW + 16

    // yours
    drawBubble(ctx, {
      x: leftX,
      y: cursorY,
      w: colW,
      h: boxH,
      label: '你写下的话',
      lines: sideLinesOwner,
      fill: palette.bubbleMine,
      stroke: palette.line,
      ink: palette.ink,
      muted: palette.muted,
      lineH,
    })

    // toy's
    drawBubble(ctx, {
      x: rightX,
      y: cursorY,
      w: colW,
      h: boxH,
      label: `玩偶视角 · ${toyName}`,
      lines: sideLinesToy,
      fill: palette.bubbleToy,
      stroke: palette.line,
      ink: palette.ink,
      muted: palette.muted,
      lineH,
      avatar: avatarImg,
    })

    // tiny heart between the two bubbles
    ctx.fillStyle = palette.accent
    ctx.font = '18px serif'
    ctx.textAlign = 'center'
    ctx.fillText('♥', W / 2, cursorY + boxH / 2 + 6)
    ctx.textAlign = 'left'
  } else {
    // Letter style: your note → dashed divider → toy's reply block
    // your note (no box, just a small label + body text)
    ctx.fillStyle = palette.muted
    ctx.font = '600 14px "Noto Sans SC", sans-serif'
    ctx.fillText('你写下的话', contentX + 2, cursorY + 18)
    ctx.fillStyle = palette.ink
    ctx.font = fontBody
    stackLinesOwner.forEach((line, i) => {
      ctx.fillText(line, contentX + 2, cursorY + 40 + i * lineH)
    })
    cursorY += 34 + stackLinesOwner.length * lineH + 14

    // dashed divider with three dots
    const midY = cursorY + dividerH / 2
    ctx.strokeStyle = palette.line
    ctx.lineWidth = 1.5
    ctx.setLineDash([7, 7])
    ctx.beginPath()
    ctx.moveTo(contentX, midY)
    ctx.lineTo(W / 2 - 26, midY)
    ctx.moveTo(W / 2 + 26, midY)
    ctx.lineTo(contentX + contentW, midY)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = palette.accent
    for (let d = 0; d < 3; d++) {
      ctx.beginPath()
      ctx.arc(W / 2 - 14 + d * 14, midY, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    cursorY += dividerH

    // toy reply block
    drawBubble(ctx, {
      x: contentX,
      y: cursorY,
      w: contentW,
      h: 52 + stackLinesToy.length * lineH + 24,
      label: `玩偶视角 · ${toyName}`,
      lines: stackLinesToy,
      fill: palette.bubbleToy,
      stroke: palette.line,
      ink: palette.ink,
      muted: palette.muted,
      lineH,
      avatar: avatarImg,
    })
  }

  // footer
  ctx.fillStyle = palette.muted
  ctx.font = '500 14px "Noto Sans SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Toy Diary · 双视角日记', W / 2, H - pad - 20)
  ctx.textAlign = 'left'

  // JPEG is much faster to encode than PNG on mobile
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.86),
  )
  if (!blob) throw new Error('生成图片失败')
  return blob
}

/** Small label bubble used by both layouts. */
function drawBubble(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number
    y: number
    w: number
    h: number
    label: string
    lines: string[]
    fill: string
    stroke: string
    ink: string
    muted: string
    lineH: number
    avatar?: HTMLImageElement | null
  },
) {
  const { x, y, w, h, label, lines, fill, stroke, ink, muted, lineH, avatar } =
    opts

  ctx.fillStyle = fill
  roundRect(ctx, x, y, w, h, 18)
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1.5
  roundRect(ctx, x, y, w, h, 18)
  ctx.stroke()

  let textX = x + 16
  if (avatar) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x + 26, y + 26, 13, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(avatar, x + 13, y + 13, 26, 26)
    ctx.restore()
    textX = x + 46
  }

  // label
  ctx.fillStyle = ink
  ctx.font = '600 14px "Noto Sans SC", sans-serif'
  let shown = label
  while (ctx.measureText(shown).width > w - (textX - x) - 14 && shown.length > 2) {
    shown = shown.slice(0, -2) + '…'
  }
  ctx.fillText(shown, textX, y + 31)

  // body
  ctx.fillStyle = muted
  ctx.font = '400 15px "Noto Sans SC", sans-serif'
  lines.forEach((line, i) => {
    ctx.fillText(line, x + 16, y + 58 + i * lineH)
  })
}

/** Location line: pin glyph + grey text, never a watermark. */
function drawPinLine(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number
    y: number
    text: string
    color: string
    maxWidth: number
  },
) {
  const { x, y, text, color, maxWidth } = opts
  const pinR = 5
  const pinCx = x + pinR
  const pinCy = y - 6
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(pinCx, pinCy, pinR, Math.PI * 0.15, Math.PI * 0.85, true)
  ctx.lineTo(pinCx, pinCy + pinR + 6)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#fffdf8'
  ctx.beginPath()
  ctx.arc(pinCx, pinCy - 1, 2.2, 0, Math.PI * 2)
  ctx.fill()

  const pinW = pinR * 2 + 8
  ctx.fillStyle = color
  ctx.font = '500 16px "Noto Sans SC", sans-serif'
  let line = text
  while (ctx.measureText(line).width > maxWidth - pinW && line.length > 1) {
    line = line.slice(0, -2) + '…'
  }
  ctx.fillText(line, x + pinW, y)
}
