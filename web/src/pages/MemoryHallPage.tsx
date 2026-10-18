import { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Pause,
  Play,
  Share2,
  Sparkles,
} from 'lucide-react'
import {
  archivePhotos,
  companionDays,
  toyAvatar,
} from '../archive/archiveUtils'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { MemoryShareSheet } from '../components/MemoryShareSheet'
import { useApp } from '../context/AppContext'

/**
 * Memory hall: slideshow + header share icon.
 * Share sheet builds an editorial keepsake from the current toy and its entries.
 */
export function MemoryHallPage() {
  const { id } = useParams()
  const location = useLocation()
  const backTo =
    (location.state as { from?: string } | null)?.from === 'me'
      ? '/me'
      : '/archive'
  const { toys, showToast } = useApp()
  const toy = toys.find((item) => item.id === id)
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof api.listEntries>>>([])
  const [slide, setSlide] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    if (!id) {
      setEntries([])
      return
    }
    let cancelled = false
    void api.listEntries(id).then((list) => {
      if (!cancelled) setEntries(list)
    })
    return () => {
      cancelled = true
    }
  }, [id])

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

  const photos = useMemo(() => archivePhotos(entries), [entries])

  useEffect(() => {
    setSlide((current) => Math.min(current, Math.max(0, photos.length - 1)))
  }, [photos.length])

  useEffect(() => {
    if (!playing || shareOpen || photos.length < 2) return
    const timer = window.setInterval(
      () => setSlide((current) => (current + 1) % photos.length),
      3600,
    )
    return () => window.clearInterval(timer)
  }, [photos.length, playing, shareOpen])

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
        {currentPhoto ? (
          <section className="memory-stage">
            <img src={currentPhoto.src} alt={currentPhoto.title} />
            <div className="memory-stage__shade" />
            <div className="absolute inset-x-0 top-0 z-[2] flex items-center justify-between p-3">
              <span className="rounded-full bg-black/25 px-2.5 py-1 text-[9px] tracking-widest text-white backdrop-blur-sm">
                {slide + 1} / {photos.length}
              </span>

            </div>
            <div className="absolute inset-x-0 bottom-0 z-[2] p-4 text-white">
              <p className="text-[10px] text-white/75">
                {currentPhoto.date} · {currentPhoto.location}
              </p>
              <h2 className="mt-1 font-display text-xl">{currentPhoto.title}</h2>
              <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-white/90">
                {currentPhoto.narration}
              </p>
            </div>
          </section>
        ) : (
          <section className="rounded-[1.75rem] border border-dashed border-line bg-cream/60 px-6 py-12 text-center">
            <ImagePlus className="mx-auto h-8 w-8 text-terra-deep" />
            <h2 className="mt-3 font-display text-lg text-ink">展厅还在等待第一张照片</h2>
            <p className="mt-2 text-xs leading-5 text-ink-muted">
              玩偶头像只属于档案。通过「+」保存带照片的日志后，照片才会进入回忆展厅。
            </p>
          </section>
        )}

        {currentPhoto && <div className="flex items-center justify-center gap-4">
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
        </div>}

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

      {shareOpen && (
        <MemoryShareSheet
          key={toy.id}
          toy={toy}
          entries={entries}
          initialPhotoId={currentPhoto?.entryId}
          onClose={() => setShareOpen(false)}
          showToast={showToast}
        />
      )}
    </>
  )
}
