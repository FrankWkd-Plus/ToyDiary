import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImagePlus,
  Pause,
  Play,
  Share2,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import {
  archivePhotos,
  companionDays,
  toyAvatar,
} from '../archive/archiveUtils'
import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import {
  DAY_COUNT_FONTS,
  DAY_COUNT_PALETTES,
  type DayCountFont,
  type DayCountPalette,
} from '../daysmatter/dayCountTheme'
import { renderDayCountCardPng } from '../share/renderDayCountCardPng'
import { isMobileClient, shareOrDownloadFile } from '../share/shareHelpers'

/**
 * Memory hall: slideshow + header share icon.
 * Share sheet includes export-only day-count styling (does not affect site theme).
 */
export function MemoryHallPage() {
  const { id } = useParams()
  const location = useLocation()
  const backTo =
    (location.state as { from?: string } | null)?.from === 'me'
      ? '/me'
      : '/archive'
  const { toys, currentToy, entries, setCurrentToyId, showToast } = useApp()
  const { prefs, updatePrefs } = useAuth()
  const toy = toys.find((item) => item.id === id)
  const [slide, setSlide] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [musicOn, setMusicOn] = useState(() => prefs.memorySound)
  const [shareOpen, setShareOpen] = useState(false)
  const [exportPalette, setExportPalette] =
    useState<DayCountPalette>('matcha')
  const [exportFont, setExportFont] = useState<DayCountFont>('display')
  const [exportBg, setExportBg] = useState<string | undefined>()
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [rendering, setRendering] = useState(false)
  const albumRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMusicOn(prefs.memorySound)
  }, [prefs.memorySound])

  // Prevent background page-scroll while share sheet is open
  useEffect(() => {
    if (!shareOpen) return
    const scrollEl = document.querySelector('.page-scroll') as HTMLElement | null
    const prevBody = document.body.style.overflow
    const prevScroll = scrollEl?.style.overflow ?? ''
    document.body.style.overflow = 'hidden'
    if (scrollEl) scrollEl.style.overflow = 'hidden'
    const blockTouch = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('[data-export-sheet]')) return
      e.preventDefault()
    }
    document.addEventListener('touchmove', blockTouch, { passive: false })
    return () => {
      document.body.style.overflow = prevBody
      if (scrollEl) scrollEl.style.overflow = prevScroll
      document.removeEventListener('touchmove', blockTouch)
    }
  }, [shareOpen])

  const ready = Boolean(toy && currentToy?.id === toy.id)
  const photos = useMemo(
    () => (ready ? archivePhotos(entries) : []),
    [entries, ready],
  )

  useEffect(() => {
    if (toy && currentToy?.id !== toy.id) setCurrentToyId(toy.id)
  }, [currentToy?.id, setCurrentToyId, toy])

  useEffect(() => {
    if (!playing || photos.length < 2) return
    const timer = window.setInterval(
      () => setSlide((current) => (current + 1) % photos.length),
      3600,
    )
    return () => window.clearInterval(timer)
  }, [photos.length, playing])

  // Live preview when share sheet open — export only, never writes site daycount style
  useEffect(() => {
    if (!shareOpen || !toy) return
    let cancelled = false
    setRendering(true)
    void renderDayCountCardPng({
      toy,
      days: companionDays(toy),
      backgroundUrl: exportBg || photos[slide]?.src,
      palette: exportPalette,
      font: exportFont,
      title: `和 ${toy.name} 相遇`,
    })
      .then(async (blob) => {
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      })
      .catch(() => {
        if (!cancelled) showToast('预览生成失败')
      })
      .finally(() => {
        if (!cancelled) setRendering(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    shareOpen,
    toy,
    exportBg,
    exportPalette,
    exportFont,
    photos,
    slide,
    showToast,
  ])

  if (!toy) {
    return (
      <>
        <PageHeader title="回忆展厅" back={backTo} soft />
        <div className="px-4 py-16 text-center text-sm text-ink-muted">
          这段回忆暂时找不到了
        </div>
      </>
    )
  }

  const days = companionDays(toy)
  const currentPhoto = photos[slide] || photos[0]
  const cities = Array.from(
    new Set(
      entries
        .map((entry) => entry.location)
        .filter((place): place is string => Boolean(place && place !== '家')),
    ),
  )
  const photoCount = entries.filter((entry) => entry.imageUrl).length

  function moveSlide(direction: number) {
    setSlide((current) => (current + direction + photos.length) % photos.length)
  }

  async function saveOrShareCard(mode: 'save' | 'share') {
    if (!toy) return
    try {
      setRendering(true)
      const blob = await renderDayCountCardPng({
        toy,
        days,
        backgroundUrl: exportBg || currentPhoto?.src,
        palette: exportPalette,
        font: exportFont,
        title: `和 ${toy.name} 相遇`,
      })
      const filename = `Toy-Diary-${days}-days.jpg`
      if (mode === 'share') {
        const result = await shareOrDownloadFile({
          blob,
          filename,
          title: `${days} DAYS 陪伴纪念`,
          text: `我和 ${toy.name} 已经认识 ${days} 天了。`,
        })
        showToast(
          result === 'shared'
            ? '已打开系统分享（可存到相册）'
            : '纪念卡片已下载',
        )
      } else {
        const result = await shareOrDownloadFile({
          blob,
          filename,
          title: `${days} DAYS 陪伴纪念`,
          text: `我和 ${toy.name} 的陪伴纪念`,
        })
        showToast(
          result === 'shared' ? '请选择「存储图像」保存到相册' : '纪念卡片已下载',
        )
      }
    } catch {
      showToast('生成失败，请重试')
    } finally {
      setRendering(false)
    }
  }

  function onPickExportBg(file: File | null) {
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
      // Export-only — does NOT call saveDayCountStyle / site theme
      setExportBg(String(reader.result || ''))
      showToast('已设置导出背景（不影响网站样式）')
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <PageHeader
        title="回忆展厅"
        subtitle={`我和 ${toy.name} 的 ${days} 天`}
        back={backTo}
        soft
        right={
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-paper/95 text-matcha-deep shadow-[var(--shadow-warm-sm)] ring-1 ring-line/40"
            aria-label="分享纪念图片"
            title="分享图片"
          >
            <Share2 className="h-[18px] w-[18px]" />
          </button>
        }
      />
      <main className="space-y-5 px-4 pb-5 pt-4">
        <section className="memory-stage">
          <img src={currentPhoto.src} alt={currentPhoto.title} />
          <div className="memory-stage__shade" />
          <div className="absolute inset-x-0 top-0 z-[2] flex items-center justify-between p-3">
            <span className="rounded-full bg-black/25 px-2.5 py-1 text-[9px] tracking-widest text-white backdrop-blur-sm">
              {slide + 1} / {photos.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setMusicOn((value) => {
                  const next = !value
                  updatePrefs({ memorySound: next })
                  showToast(next ? '已开启回忆展厅声音' : '已关闭回忆展厅声音')
                  return next
                })
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm"
              aria-label={musicOn ? '关闭背景音乐' : '开启背景音乐'}
            >
              {musicOn ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-[2] p-4 text-white">
            <p className="text-[10px] text-white/75">
              {currentPhoto.date} · {currentPhoto.location}
              {musicOn ? ' · ♪ 声音开' : ' · 静音'}
            </p>
            <h2 className="mt-1 font-display text-xl">{currentPhoto.title}</h2>
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-white/90">
              {currentPhoto.narration}
            </p>
          </div>
        </section>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => moveSlide(-1)}
            className="memory-control"
            aria-label="上一张"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            className="memory-control memory-control--main"
            aria-label={playing ? '暂停幻灯片' : '播放幻灯片'}
          >
            {playing ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="ml-0.5 h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => moveSlide(1)}
            className="memory-control"
            aria-label="下一张"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <section className="card-paper border border-line/60 p-4">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-matcha-deep">
            <Sparkles className="h-3.5 w-3.5" />
            自动生成的阶段回忆
          </span>
          <h2 className="mt-2 font-display text-xl text-ink">
            这 {days} 天，我们一起……
          </h2>
          <div className="mt-3 space-y-2 text-xs leading-6 text-ink-soft">
            <p>
              写下了 <strong className="text-ink">{entries.length}</strong>{' '}
              次心事，留下了 <strong className="text-ink">{photoCount}</strong>{' '}
              张照片。
            </p>
            <p>
              去过 <strong className="text-ink">{cities.length}</strong> 个地方
              {cities.length > 0
                ? `：${cities.slice(0, 3).join('、')}。`
                : '，下一段旅程正在等待我们。'}
            </p>
          </div>
        </section>

        <section className="memory-letter">
          <img
            src={toyAvatar(toy, toys.indexOf(toy))}
            alt=""
            className="h-12 w-12 rounded-2xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base text-ink">
              {toy.name} 写给你
            </p>
            <p className="mt-2 text-xs leading-6 text-ink-soft">
              “这 {days}{' '}
              天里，我看过你开心，也陪过你难过。谢谢你每次出门都愿意把我装进包里。以后也让我继续待在你身边吧。”
            </p>
          </div>
        </section>
      </main>

      {shareOpen &&
        createPortal(
          <div
            className="export-sheet-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="分享纪念图"
            onClick={() => setShareOpen(false)}
          >
            <div
              data-export-sheet
              className="export-sheet-panel"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-lg text-ink">分享纪念图</p>
                  <p className="text-[10px] text-ink-muted">
                    正数日样式仅用于导出，不会改网站背景
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShareOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-cream"
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="memory-share-preview mt-3 overflow-hidden rounded-2xl bg-cream">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="分享预览"
                    className="max-h-72 w-full object-contain"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center text-xs text-ink-muted">
                    {rendering ? '正在生成预览…' : '预览'}
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-medium text-ink-muted">
                  导出背景（可选相册）
                </p>
                <input
                  ref={albumRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    onPickExportBg(e.target.files?.[0] ?? null)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => albumRef.current?.click()}
                  className="flex w-full items-center gap-2 rounded-xl border border-line/70 bg-cream/50 px-3 py-2.5 text-left text-xs"
                >
                  <ImagePlus className="h-4 w-4 text-matcha-deep" />
                  从相册选择导出背景
                </button>
                {exportBg && (
                  <button
                    type="button"
                    onClick={() => setExportBg(undefined)}
                    className="text-[10px] text-ink-muted underline"
                  >
                    清除自定义导出背景
                  </button>
                )}
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-medium text-ink-muted">
                  事件颜色
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_COUNT_PALETTES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setExportPalette(p.id)}
                      className={`rounded-full px-2.5 py-1 text-[10px] ${
                        exportPalette === p.id
                          ? 'bg-matcha text-white'
                          : 'bg-cream text-ink-soft'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-medium text-ink-muted">
                  数字字体
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_COUNT_FONTS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setExportFont(f.id)}
                      className={`rounded-full px-2.5 py-1 text-[10px] ${
                        exportFont === f.id
                          ? 'bg-matcha text-white'
                          : 'bg-cream text-ink-soft'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={rendering}
                  onClick={() => void saveOrShareCard('save')}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-mist-soft py-2.5 text-xs font-semibold text-matcha-deep disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {isMobileClient() ? '保存到相册' : '下载图片'}
                </button>
                <button
                  type="button"
                  disabled={rendering}
                  onClick={() => void saveOrShareCard('share')}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-mustard-soft py-2.5 text-xs font-semibold text-terra-deep disabled:opacity-50"
                >
                  <Share2 className="h-4 w-4" />
                  分享
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
