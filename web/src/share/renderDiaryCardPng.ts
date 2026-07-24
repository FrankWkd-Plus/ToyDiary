/**
 * Export a dual-perspective diary card as PNG.
 * Layouts: side (左主右偶) | stack (上下对称)
 * Location is drawn as a clear grey label with a pin glyph (not a faint watermark).
 */
import { companionDays, toyAvatar } from '../archive/archiveUtils'
import type { Entry, Toy } from '../types'
import { loadImage, roundRect, wrapText } from './shareHelpers'

export type DiaryCardLayout = 'side' | 'stack'

export interface DiaryCardOptions {
  entry: Entry
  toy?: Toy | null
  ownerName: string
  layout: DiaryCardLayout
  /** decorative sticker frame */
  stickerFrame: boolean
  /** show companion day count */
  showDayCount: boolean
  /** show location as visible grey text + pin under the title */
  showLocation: boolean
}

export async function renderDiaryCardPng(
  opts: DiaryCardOptions,
): Promise<Blob> {
  const {
    entry,
    toy,
    ownerName,
    layout,
    stickerFrame,
    showDayCount,
    showLocation,
  } = opts

  // Compact canvas + JPEG keeps mobile encode under ~300ms
  const W = 720
  const H = layout === 'side' ? 900 : 1060
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas 不可用')

  const cream = '#f7f0e6'
  const paper = '#fffdf8'
  const ink = '#4a433c'
  const muted = '#8a7563'
  const matcha = '#9a8758'
  // Clear readable grey — not a watermark
  const locationGrey = '#5c554e'

  const pad = 32

  // Preload images in parallel before paint work
  const [entryImg, avatarImg] = await Promise.all([
    entry.imageUrl ? loadImage(entry.imageUrl) : Promise.resolve(null),
    toy ? loadImage(toyAvatar(toy, 0)) : Promise.resolve(null),
  ])

  // outer bg
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#e8f5ee')
  bg.addColorStop(1, '#fff0eb')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // card
  ctx.fillStyle = paper
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 26)
  ctx.fill()

  if (stickerFrame) {
    ctx.strokeStyle = '#f0c96a'
    ctx.lineWidth = 6
    roundRect(ctx, pad + 10, pad + 10, W - pad * 2 - 20, H - pad * 2 - 20, 20)
    ctx.stroke()
    const corners = [
      [pad + 22, pad + 32],
      [W - pad - 44, pad + 32],
      [pad + 22, H - pad - 44],
      [W - pad - 44, H - pad - 44],
    ] as const
    ctx.font = '26px serif'
    corners.forEach(([x, y], i) => {
      ctx.fillText(['🌸', '⭐', '🧸', '🍀'][i], x, y)
    })
  }

  const toyName = toy?.name || '玩偶'
  const days = toy ? companionDays(toy) : 0
  const locationText =
    entry.place?.displayName?.trim() || entry.location?.trim() || ''

  // header title
  ctx.fillStyle = ink
  ctx.textAlign = 'left'
  ctx.font = '700 28px "Noto Sans SC", sans-serif'
  ctx.fillText(entry.title || '今日日记', pad + 28, pad + 56)

  // date + mood (grey, clear)
  ctx.fillStyle = muted
  ctx.font = '500 16px "Noto Sans SC", sans-serif'
  ctx.fillText(
    `${entry.date}${entry.mood ? ` · ${entry.mood}` : ''}`,
    pad + 28,
    pad + 84,
  )

  // location as explicit grey line with pin icon (NOT a watermark)
  let metaBottom = pad + 84
  if (showLocation && locationText) {
    metaBottom = pad + 112
    drawLocationLine(ctx, {
      x: pad + 28,
      y: metaBottom,
      text: locationText,
      color: locationGrey,
      maxWidth: W - pad * 2 - 56 - (showDayCount ? 100 : 0),
    })
  }

  if (showDayCount) {
    ctx.fillStyle = matcha
    ctx.font = '700 20px "Noto Sans SC", sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`DAY ${days}`, W - pad - 28, pad + 56)
    ctx.font = '500 14px "Noto Sans SC", sans-serif'
    ctx.fillText('正数日', W - pad - 28, pad + 78)
    ctx.textAlign = 'left'
  }

  // photo
  let contentTop = metaBottom + 20
  if (entryImg) {
    const photoH = 220
    const photoW = W - pad * 2 - 48
    const photoX = pad + 24
    ctx.save()
    roundRect(ctx, photoX, contentTop, photoW, photoH, 18)
    ctx.clip()
    const scale = Math.max(photoW / entryImg.width, photoH / entryImg.height)
    const dw = entryImg.width * scale
    const dh = entryImg.height * scale
    ctx.drawImage(
      entryImg,
      photoX + (photoW - dw) / 2,
      contentTop + (photoH - dh) / 2,
      dw,
      dh,
    )
    ctx.restore()
    contentTop += photoH + 20
  }

  const ownerText =
    entry.userNote?.trim() ||
    entry.title?.trim() ||
    (locationText
      ? `今天和 ${toyName} 一起去了${locationText}。`
      : `今天想把这一刻写给 ${toyName}。`)
  const toyText =
    entry.aiDiary?.trim() ||
    `我是${toyName}。${locationText ? `在${locationText}，` : ''}和 ${ownerName} 的这一天，我想记住。`

  if (layout === 'side') {
    const colW = (W - pad * 2 - 56) / 2
    const leftX = pad + 24
    const rightX = leftX + colW + 12
    const boxY = contentTop
    const boxH = H - boxY - pad - 52

    drawPerspectiveBox(ctx, {
      x: leftX,
      y: boxY,
      w: colW,
      h: boxH,
      title: `我的视角 · ${ownerName}`,
      body: ownerText,
      tint: cream,
      ink,
      muted,
    })
    drawPerspectiveBox(ctx, {
      x: rightX,
      y: boxY,
      w: colW,
      h: boxH,
      title: `玩偶视角 · ${toyName}`,
      body: toyText,
      tint: '#fff6e0',
      ink,
      muted,
      avatar: avatarImg,
    })
  } else {
    const boxW = W - pad * 2 - 48
    const boxX = pad + 24
    const gap = 14
    const boxH = (H - contentTop - pad - 52 - gap) / 2
    drawPerspectiveBox(ctx, {
      x: boxX,
      y: contentTop,
      w: boxW,
      h: boxH,
      title: `我的视角 · ${ownerName}`,
      body: ownerText,
      tint: cream,
      ink,
      muted,
    })
    drawPerspectiveBox(ctx, {
      x: boxX,
      y: contentTop + boxH + gap,
      w: boxW,
      h: boxH,
      title: `玩偶视角 · ${toyName}`,
      body: toyText,
      tint: '#fff6e0',
      ink,
      muted,
      avatar: avatarImg,
    })
  }

  ctx.fillStyle = muted
  ctx.font = '500 14px "Noto Sans SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Toy Dairy · 双视角日记', W / 2, H - pad - 16)
  ctx.textAlign = 'left'

  // JPEG is much faster to encode than PNG on mobile
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.86),
  )
  if (!blob) throw new Error('生成图片失败')
  return blob
}

function drawLocationLine(
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
  // Map-pin glyph drawn with path (always visible grey, never a watermark)
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

function drawPerspectiveBox(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number
    y: number
    w: number
    h: number
    title: string
    body: string
    tint: string
    ink: string
    muted: string
    avatar?: HTMLImageElement | null
  },
) {
  const { x, y, w, h, title, body, tint, ink, muted, avatar } = opts
  ctx.fillStyle = tint
  roundRect(ctx, x, y, w, h, 16)
  ctx.fill()
  ctx.strokeStyle = 'rgba(232,228,220,0.95)'
  ctx.lineWidth = 1.5
  roundRect(ctx, x, y, w, h, 16)
  ctx.stroke()

  let titleX = x + 14
  if (avatar) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x + 24, y + 24, 12, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(avatar, x + 12, y + 12, 24, 24)
    ctx.restore()
    titleX = x + 42
  }

  ctx.fillStyle = ink
  ctx.font = '700 15px "Noto Sans SC", sans-serif'
  // Truncate long titles in narrow columns
  let shown = title
  while (ctx.measureText(shown).width > w - (titleX - x) - 12 && shown.length > 2) {
    shown = shown.slice(0, -2) + '…'
  }
  ctx.fillText(shown, titleX, y + 28)

  ctx.fillStyle = muted
  ctx.font = '400 14px "Noto Sans SC", sans-serif'
  const lineH = 20
  const lines = wrapText(ctx, body, w - 28, Math.max(2, Math.floor((h - 48) / lineH)))
  lines.forEach((line, i) => {
    ctx.fillText(line, x + 14, y + 52 + i * lineH)
  })
}
