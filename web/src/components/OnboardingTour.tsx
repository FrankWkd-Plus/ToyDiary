import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { markOnboardingSeen } from '../onboarding/onboarding'

interface Slide {
  image: string
  title: string
  body: string
}

const SLIDES: Slide[] = [
  {
    image: '/toy-cards/profile.jpg',
    title: '把陪伴写成日记',
    body: '给玩偶一张角色卡，记下地点、照片和当时的心情。日子会慢慢长成一本只属于你们的书。',
  },
  {
    image: '/toy-cards/highlight-1.jpg',
    title: '同一段旅程，两种视角',
    body: '你写下当天发生的事；玩偶会用自己的口吻，回望那段记忆。',
  },
  {
    image: '/toy-cards/geese-trip-1.jpg',
    title: '把走过的路串起来',
    body: '旅行地图会点亮去过的城市，成长页帮你数清一起陪伴了多少天。',
  },
  {
    image: '/toy-cards/highlight-2.jpg',
    title: '还有一个小小的宇宙',
    body: '和玩偶聊天、收藏照片、分享日常。现在，去写下第一段故事吧。',
  },
]

/**
 * First-launch swipeable tour. Mounted once in `AppLayout`; Settings replays
 * it by dispatching `ONBOARDING_EVENT`.
 */
export function OnboardingTour({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  function finish() {
    markOnboardingSeen()
    onClose()
  }

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, next))
    const track = trackRef.current
    setIndex(clamped)
    if (!track) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    track.scrollTo({
      left: clamped * track.clientWidth,
      behavior: reduce ? 'auto' : 'smooth',
    })
  }

  // Reset + lock the page behind the overlay.
  useEffect(() => {
    if (!open) return
    setIndex(0)
    trackRef.current?.scrollTo({ left: 0 })
    rootRef.current?.focus({ preventScroll: true })
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  // Keyboard: arrows page, Escape skips.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        finish()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        goTo(index + 1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goTo(index - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // `finish`/`goTo` are recreated per render; index is what has to be fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index])

  if (!open) return null

  const last = index === SLIDES.length - 1

  return createPortal(
    <div
      ref={rootRef}
      className="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="新手导览"
      tabIndex={-1}
    >
      <div className="onboarding-frame">
        <div className="flex items-center justify-end px-5 pb-2 pt-[calc(var(--safe-top)+8px)]">
          <button
            type="button"
            onClick={finish}
            className="rounded-full px-3 py-1.5 text-xs text-ink-muted active:bg-cream"
          >
            跳过
          </button>
        </div>

        <div
          ref={trackRef}
          className="onboarding-track"
          onScroll={() => {
            const track = trackRef.current
            if (!track || !track.clientWidth) return
            const next = Math.round(track.scrollLeft / track.clientWidth)
            if (next !== index) setIndex(next)
          }}
        >
          {SLIDES.map((slide, i) => (
            <section
              key={slide.title}
              className="onboarding-slide"
              aria-roledescription="slide"
              aria-label={`第 ${i + 1} 页，共 ${SLIDES.length} 页`}
            >
              <img
                src={slide.image}
                alt=""
                draggable={false}
                className="onboarding-photo"
              />
              <h2 className="mt-6 font-display text-[1.35rem] font-semibold leading-snug tracking-wide text-ink">
                {slide.title}
              </h2>
              <p className="mt-2.5 max-w-[19rem] text-[13px] leading-relaxed text-ink-muted">
                {slide.body}
              </p>
            </section>
          ))}
        </div>

        <div className="onboarding-footer">
          <div className="flex items-center justify-center gap-1">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.title}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`第 ${i + 1} 页`}
                aria-current={i === index ? 'step' : undefined}
                className="flex h-8 w-8 items-center justify-center"
              >
                <span
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-4 bg-matcha-deep' : 'w-1.5 bg-cream-dark'
                  }`}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => (last ? finish() : goTo(index + 1))}
            className="btn-primary mt-2 min-h-11 w-full text-sm"
          >
            {last ? '开始使用' : '下一步'}
          </button>
        </div>

        <p className="sr-only" aria-live="polite">
          第 {index + 1} 页，共 {SLIDES.length} 页
        </p>
      </div>
    </div>,
    document.body,
  )
}
