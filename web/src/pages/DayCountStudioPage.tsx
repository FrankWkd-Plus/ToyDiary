import { useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ImagePlus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { broadcastDayCountStyle } from '../components/DayCountNumber'
import { DayCountNumber } from '../components/DayCountNumber'
import { useApp } from '../context/AppContext'
import { companionDays } from '../archive/archiveUtils'
import {
  DAY_COUNT_BGS,
  DAY_COUNT_FONTS,
  DAY_COUNT_PALETTES,
  loadDayCountStyle,
  saveDayCountStyle,
  type DayCountBg,
  type DayCountFont,
  type DayCountPalette,
  type DayCountStyle,
} from '../daysmatter/dayCountTheme'

/**
 * 正数日样式工坊 — 配色 / 背景（含相册上传）/ 数字字体
 * 视觉参考 Days Matter：大数字卡片 + 背景图 + 字体色板
 */
export function DayCountStudioPage() {
  const navigate = useNavigate()
  const { currentToy, entries, toys, showToast } = useApp()
  const [style, setStyle] = useState<DayCountStyle>(() => loadDayCountStyle())
  const albumRef = useRef<HTMLInputElement>(null)

  const previewDays = currentToy ? companionDays(currentToy) : 100
  const photoUrl =
    style.customBgUrl || entries.find((e) => e.imageUrl)?.imageUrl

  const previewLabel = useMemo(
    () => (currentToy ? `和 ${currentToy.name} 相遇` : '正数日预览'),
    [currentToy],
  )

  function patch(next: Partial<DayCountStyle>) {
    setStyle((prev) => {
      const merged = { ...prev, ...next }
      saveDayCountStyle(merged)
      broadcastDayCountStyle()
      return merged
    })
  }

  function persistAndToast(msg: string) {
    saveDayCountStyle(style)
    broadcastDayCountStyle()
    showToast(msg)
  }

  function onAlbumPick(file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片')
      return
    }
    if (file.size > 6 * 1024 * 1024) {
      showToast('背景图请小于 6MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      if (!dataUrl.startsWith('data:')) {
        showToast('读取图片失败')
        return
      }
      void compressDataUrl(dataUrl, 1280)
        .then((url) => {
          patch({ bg: 'custom', customBgUrl: url })
          showToast('已设置相册背景')
        })
        .catch(() => {
          patch({ bg: 'custom', customBgUrl: dataUrl })
          showToast('已设置相册背景')
        })
    }
    reader.onerror = () => showToast('读取图片失败')
    reader.readAsDataURL(file)
  }

  function clearCustomBg() {
    patch({
      customBgUrl: undefined,
      bg: style.bg === 'custom' ? 'mesh' : style.bg,
    })
    showToast('已清除自定义背景')
  }

  return (
    <div className="min-h-full bg-cream/40">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line/60 bg-white/95 px-3 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-ink-soft"
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-base text-ink">正数日</h1>
          <p className="text-[10px] text-ink-muted">
            Days Matter 风格 · 相册背景 / 配色 / 字体
          </p>
        </div>
        <button
          type="button"
          onClick={() => persistAndToast('正数日样式已保存')}
          className="rounded-full bg-matcha px-3 py-1.5 text-[11px] font-medium text-white"
        >
          完成
        </button>
      </header>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
        <DayCountNumber
          value={previewDays}
          label={previewLabel}
          unit="天"
          size="hero"
          style={style}
          photoUrl={photoUrl}
          sublabel={
            currentToy
              ? `目标日参照：${currentToy.birthDate} · 已相遇`
              : '已经一起走过的日子'
          }
        />

        <Section title="选择背景图片">
          <input
            ref={albumRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              e.target.value = ''
              onAlbumPick(f)
            }}
          />
          <button
            type="button"
            onClick={() => albumRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-2xl bg-white px-3.5 py-3.5 text-left ring-1 ring-line/50 active:bg-cream"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mist-soft text-matcha-deep">
              <ImagePlus className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-sm text-ink">从相册中选择照片</strong>
              <span className="mt-0.5 block text-[10px] text-ink-muted">
                用作正数日卡片背景（本地保存）
              </span>
            </span>
          </button>
          {style.customBgUrl && (
            <div className="mt-2 flex items-center gap-2">
              <img
                src={style.customBgUrl}
                alt="自定义背景预览"
                className="h-12 w-12 rounded-xl object-cover ring-1 ring-line/50"
              />
              <span className="min-w-0 flex-1 text-[11px] text-ink-muted">
                已设置自定义背景
              </span>
              <button
                type="button"
                onClick={clearCustomBg}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-ink-muted"
                aria-label="清除背景"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="mt-2.5 flex flex-wrap gap-2">
            {DAY_COUNT_BGS.map((b) => {
              const active = style.bg === b.id
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    if (b.id === 'custom' && !style.customBgUrl) {
                      albumRef.current?.click()
                      return
                    }
                    patch({ bg: b.id as DayCountBg })
                  }}
                  className={active ? 'chip chip-active' : 'chip'}
                >
                  {b.label}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[10px] text-ink-muted">
            「照片晕」用最近日志图；「相册」用你上传的自定义图。
          </p>
        </Section>

        <Section title="事件颜色">
          <div className="grid grid-cols-3 gap-2">
            {DAY_COUNT_PALETTES.map((p) => {
              const active = style.palette === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => patch({ palette: p.id as DayCountPalette })}
                  className={`relative overflow-hidden rounded-2xl px-2 py-3 text-center ring-1 transition-transform active:scale-95 ${
                    active
                      ? 'ring-2 ring-matcha shadow-[var(--shadow-warm-sm)]'
                      : 'ring-line/50'
                  }`}
                  style={{ background: p.surface }}
                >
                  <span
                    className="block text-xl leading-none"
                    style={{
                      color: p.number,
                      fontFamily: getFontPreview(style.font),
                    }}
                  >
                    88
                  </span>
                  <span className="mt-1 block text-[10px] text-ink-muted">
                    {p.label}
                  </span>
                  {active && (
                    <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-matcha-deep" />
                  )}
                </button>
              )
            })}
          </div>
        </Section>

        <Section title="数字字体">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {DAY_COUNT_FONTS.map((f) => {
              const active = style.font === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => patch({ font: f.id as DayCountFont })}
                  className={`shrink-0 rounded-2xl px-3 py-2.5 ring-1 transition-transform active:scale-95 ${
                    active
                      ? 'bg-mist-soft ring-matcha'
                      : 'bg-white ring-line/50'
                  }`}
                >
                  <span
                    className="block text-2xl leading-none text-ink"
                    style={{ fontFamily: f.family }}
                  >
                    23
                  </span>
                  <span className="mt-1 block text-center text-[9px] text-ink-muted">
                    {f.label}
                  </span>
                </button>
              )
            })}
          </div>
        </Section>

        <div className="grid grid-cols-2 gap-2">
          <DayCountNumber
            value={entries.length}
            label="日记"
            unit="篇"
            size="stat"
            style={style}
            photoUrl={photoUrl}
          />
          <DayCountNumber
            value={toys.length}
            label="玩偶"
            unit="只"
            size="stat"
            style={style}
            photoUrl={photoUrl}
          />
          <DayCountNumber
            value={entries.filter((e) => e.imageUrl).length}
            label="照片"
            unit="张"
            size="stat"
            style={style}
            photoUrl={photoUrl}
          />
          <DayCountNumber
            value={previewDays}
            label="陪伴"
            unit="天"
            size="stat"
            style={style}
            photoUrl={photoUrl}
          />
        </div>

        <p className="pb-4 text-center text-[10px] text-ink-muted">
          样式保存在本机，档案 / 我的 / 成长页的数字会同步更新。
        </p>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="card-paper space-y-2.5 p-4">
      <h2 className="text-xs font-medium text-ink-muted">{title}</h2>
      {children}
    </section>
  )
}

function getFontPreview(id: DayCountFont) {
  return DAY_COUNT_FONTS.find((f) => f.id === id)?.family
}

async function compressDataUrl(dataUrl: string, maxSide: number) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('decode failed'))
    el.src = dataUrl
  })
  const scale = Math.min(
    1,
    maxSide / Math.max(img.naturalWidth, img.naturalHeight),
  )
  if (scale >= 0.95) return dataUrl
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  try {
    return canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return dataUrl
  }
}
