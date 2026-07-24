/**
 * Export a dual-perspective diary card as PNG.
 * Layouts: side (左主右偶) | stack (上下对称)
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
  /** location watermark */
  locationWatermark: boolean
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
    locationWatermark,
  } = opts

  const W = 1080
  const H = layout === 'side' ? 1350 : 1600
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')

  const cream = '#f7f0e6'
  const paper = '#fffdf8'
  const ink = '#4a433c'
  const muted = '#8a7563'
  const matcha = '#9a8758'

  // outer bg
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#e8f5ee')
  bg.addColorStop(1, '#fff0eb')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // card
  const pad = 56
  ctx.fillStyle = paper
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 40)
  ctx.fill()

  if (stickerFrame) {
    ctx.strokeStyle = '#f0c96a'
    ctx.lineWidth = 10
    roundRect(ctx, pad + 18, pad + 18, W - pad * 2 - 36, H - pad * 2 - 36, 32)
    ctx.stroke()
    // corner stickers
    const corners = [
      [pad + 36, pad + 48],
      [W - pad - 70, pad + 48],
      [pad + 36, H - pad - 70],
      [W - pad - 70, H - pad - 70],
    ] as const
    ctx.font = '40px serif'
    corners.forEach(([x, y], i) => {
      ctx.fillText(['🌸', '⭐', '🧸', '🍀'][i], x, y)
    })
  }

  // header
  const toyName = toy?.name || '玩偶'
  const days = toy ? companionDays(toy) : 0
  ctx.fillStyle = ink
  ctx.font = '700 40px "ZCOOL XiaoWei", "Noto Sans SC", serif'
  ctx.fillText(entry.title || '今日日记', pad + 48, pad + 90)

  ctx.fillStyle = muted
  ctx.font = '500 24px "Noto Sans SC", sans-serif'
  ctx.fillText(
    `${entry.date}${entry.mood ? ` · ${entry.mood}` : ''}`,
    pad + 48,
    pad + 132,
  )

  if (showDayCount) {
    ctx.fillStyle = matcha
    ctx.font = '700 28px "Noto Sans SC", sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`DAY ${days}`, W - pad - 48, pad + 100)
    ctx.font = '500 20px "Noto Sans SC", sans-serif'
    ctx.fillText('正数日', W - pad - 48, pad + 132)
    ctx.textAlign = 'left'
  }

  // photo
  let contentTop = pad + 170
  if (entry.imageUrl) {
    const img = await loadImage(entry.imageUrl)
    if (img) {
      const photoH = 360
      const photoW = W - pad * 2 - 80
      const photoX = pad + 40
      ctx.save()
      roundRect(ctx, photoX, contentTop, photoW, photoH, 28)
      ctx.clip()
      const scale = Math.max(photoW / img.width, photoH / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      ctx.drawImage(
        img,
        photoX + (photoW - dw) / 2,
        contentTop + (photoH - dh) / 2,
        dw,
        dh,
      )
      ctx.restore()
      contentTop += photoH + 36
    }
  }

  const ownerText =
    entry.userNote?.trim() ||
    entry.title?.trim() ||
    (entry.location
      ? `今天和 ${toyName} 一起去了${entry.location}。`
      : `今天想把这一刻写给 ${toyName}。`)
  const toyText =
    entry.aiDiary?.trim() ||
    `我是${toyName}。${entry.location ? `在${entry.location}，` : ''}和 ${ownerName} 的这一天，我想记住。`

  const avatarImg = toy ? await loadImage(toyAvatar(toy, 0)) : null

  if (layout === 'side') {
    const colW = (W - pad * 2 - 100) / 2
    const leftX = pad + 40
    const rightX = leftX + colW + 20
    const boxY = contentTop
    const boxH = H - boxY - pad - 100

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
    const boxW = W - pad * 2 - 80
    const boxX = pad + 40
    const gap = 28
    const boxH = (H - contentTop - pad - 100 - gap) / 2
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

  if (locationWatermark && entry.location) {
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.rotate(-Math.PI / 8)
    ctx.fillStyle = 'rgba(154,135,88,0.12)'
    ctx.font = '700 64px "Noto Sans SC", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(entry.location, 0, 0)
    ctx.restore()
    ctx.textAlign = 'left'
  }

  ctx.fillStyle = muted
  ctx.font = '500 20px "Noto Sans SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Toy Dairy · 双视角日记', W / 2, H - pad - 28)
  ctx.textAlign = 'left'

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) throw new Error('生成图片失败')
  return blob
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
  roundRect(ctx, x, y, w, h, 24)
  ctx.fill()
  ctx.strokeStyle = 'rgba(232,228,220,0.95)'
  ctx.lineWidth = 2
  roundRect(ctx, x, y, w, h, 24)
  ctx.stroke()

  let titleX = x + 24
  if (avatar) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x + 36, y + 36, 20, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(avatar, x + 16, y + 16, 40, 40)
    ctx.restore()
    titleX = x + 68
  }

  ctx.fillStyle = ink
  ctx.font = '700 24px "Noto Sans SC", sans-serif'
  ctx.fillText(title, titleX, y + 44)

  ctx.fillStyle = muted
  ctx.font = '400 22px "Noto Sans SC", sans-serif'
  const lines = wrapText(ctx, body, w - 48, Math.floor((h - 80) / 30))
  lines.forEach((line, i) => {
    ctx.fillText(line, x + 24, y + 86 + i * 30)
  })
}
