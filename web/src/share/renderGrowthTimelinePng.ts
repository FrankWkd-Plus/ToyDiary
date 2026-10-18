/**
 * Render a scrapbook-style growth timeline image for sharing.
 */
import { companionDays, toyAvatar } from '../archive/archiveUtils'
import type { Entry, Toy } from '../types'
import { loadImage, roundRect, wrapText } from './shareHelpers'

export async function renderGrowthTimelinePng(opts: {
  toys: Toy[]
  entries: Entry[]
  currentToy: Toy | null
}): Promise<Blob> {
  const { toys, entries, currentToy } = opts
  const toy = currentToy || toys[0]
  const toyEntries = (toy
    ? entries.filter((e) => e.toyId === toy.id)
    : entries
  )
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)

  const W = 1080
  const rowH = 168
  const headerH = 320
  const footerH = 120
  const H = headerH + Math.max(1, toyEntries.length) * rowH + footerH + 40

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')

  // Background
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#f3f8ee')
  grad.addColorStop(0.45, '#fffaf3')
  grad.addColorStop(1, '#e8f5ee')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Soft paper card
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  roundRect(ctx, 48, 48, W - 96, H - 96, 48)
  ctx.fill()

  // Header band
  const headerGrad = ctx.createLinearGradient(48, 48, W - 48, 260)
  headerGrad.addColorStop(0, '#d4ecc8')
  headerGrad.addColorStop(1, '#fff6e0')
  ctx.fillStyle = headerGrad
  roundRect(ctx, 48, 48, W - 96, 220, 48)
  ctx.fill()
  // square bottom of header band
  ctx.fillRect(48, 200, W - 96, 68)

  const avatarUrl = toy ? toyAvatar(toy, 0) : ''
  const avatarImg = await loadImage(avatarUrl)
  if (avatarImg) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(160, 160, 64, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(avatarImg, 96, 96, 128, 128)
    ctx.restore()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(160, 160, 64, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.fillStyle = '#4a433c'
  ctx.font = '700 44px "ZCOOL XiaoWei", "Noto Sans SC", serif'
  ctx.fillText(toy ? `${toy.name} 的成长轨迹` : '成长轨迹', 260, 140)

  ctx.fillStyle = '#6b635a'
  ctx.font = '500 26px "Noto Sans SC", sans-serif'
  const days = toy ? companionDays(toy) : 0
  ctx.fillText(
    `陪伴 ${days} 天 · ${toyEntries.length} 条共同记录`,
    260,
    186,
  )
  ctx.fillStyle = '#9a8758'
  ctx.font = '500 22px "Noto Sans SC", sans-serif'
  ctx.fillText('Toy Diary · 把陪伴写进时间里', 260, 226)

  // Timeline spine
  const spineX = 150
  const startY = headerH + 20
  ctx.strokeStyle = '#c4b08a'
  ctx.lineWidth = 4
  ctx.setLineDash([10, 12])
  ctx.beginPath()
  ctx.moveTo(spineX, startY)
  ctx.lineTo(
    spineX,
    startY + Math.max(1, toyEntries.length) * rowH - 40,
  )
  ctx.stroke()
  ctx.setLineDash([])

  if (!toyEntries.length) {
    ctx.fillStyle = '#9a9186'
    ctx.font = '500 28px "Noto Sans SC", sans-serif'
    ctx.fillText('还没有日记，去记一笔再来分享吧', 220, startY + 60)
  }

  for (let i = 0; i < toyEntries.length; i++) {
    const e = toyEntries[i]
    const y = startY + i * rowH

    // node
    ctx.fillStyle = '#b5a06a'
    ctx.beginPath()
    ctx.arc(spineX, y + 36, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(spineX, y + 36, 6, 0, Math.PI * 2)
    ctx.fill()

    // card
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, 200, y, W - 280, rowH - 24, 24)
    ctx.fill()
    ctx.strokeStyle = 'rgba(232,228,220,0.9)'
    ctx.lineWidth = 2
    roundRect(ctx, 200, y, W - 280, rowH - 24, 24)
    ctx.stroke()

    // thumb
    if (e.imageUrl) {
      const img = await loadImage(e.imageUrl)
      if (img) {
        ctx.save()
        roundRect(ctx, 220, y + 16, 112, 112, 18)
        ctx.clip()
        ctx.drawImage(img, 220, y + 16, 112, 112)
        ctx.restore()
      }
    } else {
      ctx.fillStyle = '#f3f8ee'
      roundRect(ctx, 220, y + 16, 112, 112, 18)
      ctx.fill()
      ctx.font = '48px serif'
      ctx.fillText('🧸', 246, y + 90)
    }

    const textX = 360
    ctx.fillStyle = '#9a9186'
    ctx.font = '500 22px "Noto Sans SC", sans-serif'
    ctx.fillText(
      `${e.date}${e.location ? ` · ${e.location}` : ''}`,
      textX,
      y + 42,
    )
    ctx.fillStyle = '#4a433c'
    ctx.font = '700 30px "Noto Sans SC", sans-serif'
    const title = e.title || e.userNote?.slice(0, 18) || '未命名瞬间'
    ctx.fillText(title.slice(0, 22), textX, y + 82)

    const snippet =
      e.aiDiary?.split('\n').find((l) => l.trim()) ||
      e.userNote ||
      '这一天也被好好收藏了。'
    ctx.fillStyle = '#6b635a'
    ctx.font = '400 22px "Noto Sans SC", sans-serif'
    const lines = wrapText(ctx, snippet, W - 420, 2)
    lines.forEach((line, li) => {
      ctx.fillText(line, textX, y + 116 + li * 28)
    })
  }

  // Footer
  ctx.fillStyle = '#9a9186'
  ctx.font = '500 22px "Noto Sans SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(
    `导出于 ${new Date().toLocaleDateString('zh-CN')} · toydairy.pages.dev`,
    W / 2,
    H - 70,
  )
  ctx.textAlign = 'left'

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) throw new Error('生成图片失败')
  return blob
}
