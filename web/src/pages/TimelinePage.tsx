import { useMemo, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  Sparkles,
} from 'lucide-react'
import { companionDays, toyAvatar } from '../archive/archiveUtils'
import { useApp } from '../context/AppContext'
import { uniqueCities } from '../places/placeUtils'
import { seedPlaceForLabel } from '../places/placeUtils'

export function TimelinePage() {
  const navigate = useNavigate()
  const { currentToy, toys, entries, setCurrentToyId, showToast } = useApp()
  const [cardIndex, setCardIndex] = useState(() => {
    const i = toys.findIndex((t) => t.id === currentToy?.id)
    return i >= 0 ? i : 0
  })
  const touchStartX = useRef<number | null>(null)

  // Keep card index aligned when toys / current change
  const activeIndex = useMemo(() => {
    if (!toys.length) return 0
    const byCurrent = toys.findIndex((t) => t.id === currentToy?.id)
    if (byCurrent >= 0) return byCurrent
    return Math.min(cardIndex, toys.length - 1)
  }, [toys, currentToy?.id, cardIndex])

  const toy = toys[activeIndex] || currentToy
  const days = toy ? companionDays(toy) : 0
  const milestone = getMilestone(days)
  const avatar = toyAvatar(toy, activeIndex)
  const places = entries
    .map((e) => e.place || seedPlaceForLabel(e.location))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
  const cityCount = uniqueCities(places).length
  const latestMood =
    entries.find((e) => e.mood)?.mood ||
    (toy?.traits.includes('活泼') ? '开心' : '温柔')

  function selectIndex(next: number) {
    if (!toys.length) return
    const i = ((next % toys.length) + toys.length) % toys.length
    setCardIndex(i)
    const t = toys[i]
    if (t) {
      setCurrentToyId(t.id)
      showToast(`正在查看 ${t.name}`)
    }
  }

  function openToyDetail() {
    if (toy) navigate(`/archive/toys/${toy.id}`)
  }

  function onToyCardKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openToyDetail()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      selectIndex(activeIndex - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      selectIndex(activeIndex + 1)
    }
  }

  function onTouchStart(e: TouchEvent) {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null
  }

  function onTouchEnd(e: TouchEvent) {
    if (touchStartX.current == null) return
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 48) return
    if (dx < 0) selectIndex(activeIndex + 1)
    else selectIndex(activeIndex - 1)
  }

  return (
    <div className="min-h-full">
      <header className="header-band sticky top-0 z-10 flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-paper/90 text-lg shadow-[var(--shadow-warm-sm)] ring-1 ring-line/40">
            🧸
          </span>
          <h1 className="font-display text-xl leading-none tracking-wide text-ink">
            Toy Dairy
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/toys/new')}
          className="flex items-center gap-1 rounded-full bg-mustard-soft px-3 py-2 text-[11px] font-semibold text-matcha-deep shadow-[var(--shadow-warm-sm)] ring-1 ring-line/30 transition-transform active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          新增玩偶
        </button>
      </header>

      <main className="space-y-4 px-4 pb-5 pt-4">
        {toy ? (
          <section className="relative">
            <article
              role="button"
              tabIndex={0}
              onClick={openToyDetail}
              onKeyDown={onToyCardKeyDown}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              className="archive-toy-card cursor-pointer transition-transform active:scale-[0.99]"
              aria-label={`查看 ${toy.name} 的玩偶档案，左右滑动切换`}
            >
              <div className="archive-toy-card__accent" />
              <div className="relative flex gap-3.5 p-4">
                <div className="h-[5.6rem] w-[5.6rem] shrink-0 overflow-hidden rounded-[1.25rem] border-2 border-white bg-cream shadow-md">
                  <img
                    src={avatar}
                    alt={toy.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium tracking-wider text-matcha-deep">
                        CURRENT TOY
                      </p>
                      <h2 className="mt-0.5 truncate font-display text-xl text-ink">
                        {toy.name}
                      </h2>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/80 px-2 py-1 text-[10px] text-ink-muted">
                      陪伴 {days} 天
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="rounded-full bg-white/85 px-2 py-0.5 text-[9px] text-matcha-deep">
                      {toy.role}
                    </span>
                    {toy.zodiac && (
                      <span className="rounded-full bg-mustard-soft/90 px-2 py-0.5 text-[9px] text-terra-deep">
                        {toy.zodiac}
                      </span>
                    )}
                    <span className="rounded-full bg-peach-soft px-2 py-0.5 text-[9px] text-rose-deep">
                      心情 · {latestMood}
                    </span>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-muted">
                    <MapPin className="h-3.5 w-3.5 text-matcha-deep" />
                    {toy.birthDate} · {toy.birthPlace}
                  </p>
                </div>
              </div>

              <div className="relative space-y-2.5 border-t border-white/75 px-4 py-3">
                <p className="line-clamp-2 text-xs leading-relaxed text-ink-soft">
                  “{toy.monologue || '今天也想和你一起收藏生活。'}”
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="日志" value={String(entries.length)} />
                  <Stat label="城市" value={String(cityCount)} />
                  <Stat label="陪伴" value={`${days}天`} />
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[10px] text-ink-muted">
                    左右滑动切换 · 点击进入完整档案
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-matcha-deep">
                    <BookOpen className="h-3.5 w-3.5" />
                    打开档案
                  </span>
                </div>
              </div>
            </article>

            {toys.length > 1 && (
              <div className="mt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink-muted shadow-sm ring-1 ring-line/50"
                  onClick={() => selectIndex(activeIndex - 1)}
                  aria-label="上一只玩偶"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1.5">
                  {toys.map((t, i) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-label={`切换到 ${t.name}`}
                      onClick={() => selectIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === activeIndex
                          ? 'w-4 bg-matcha'
                          : 'w-1.5 bg-line'
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink-muted shadow-sm ring-1 ring-line/50"
                  onClick={() => selectIndex(activeIndex + 1)}
                  aria-label="下一只玩偶"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/toys/new')}
            className="card-paper w-full p-6 text-center"
          >
            <span className="text-3xl">🧸</span>
            <p className="mt-2 text-sm font-medium text-ink">先创建一只玩偶</p>
          </button>
        )}

        {toy && (
          <button
            type="button"
            onClick={() => navigate(`/memories/${toy.id}`)}
            className="archive-milestone-card w-full overflow-hidden text-left transition-transform active:scale-[0.99]"
          >
            <div className="relative z-[1] max-w-[65%]">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/65 px-2.5 py-1 text-[10px] font-medium text-terra-deep">
                <Sparkles className="h-3 w-3" />
                陪伴纪念
              </span>
              {milestone.isToday ? (
                <>
                  <p className="mt-3 text-xs font-medium text-ink-soft">
                    今天是我们认识的第 {days} 天
                  </p>
                  <p className="font-display mt-0.5 text-[2.25rem] leading-none text-ink">
                    {days} DAYS
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 font-display text-xl text-ink">下一次纪念</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                    距离相识 {milestone.nextDays} 天还有{' '}
                    <strong>{milestone.countdown}</strong> 天
                  </p>
                </>
              )}
              <span className="mt-3 inline-flex items-center text-[10px] font-semibold text-matcha-deep">
                进入回忆展厅
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="absolute -bottom-5 -right-2 h-36 w-36 rotate-6 overflow-hidden rounded-[2rem] border-[5px] border-white bg-white shadow-lg">
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            </div>
            <Bell className="absolute right-32 top-5 h-4 w-4 rotate-12 text-terra-deep/60" />
          </button>
        )}
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/75 px-2 py-1.5 text-center shadow-sm">
      <strong className="block font-display text-sm text-ink">{value}</strong>
      <span className="text-[9px] text-ink-muted">{label}</span>
    </div>
  )
}

function getMilestone(days: number) {
  const milestones = [30, 100, 365, 500, 1000]
  if (milestones.includes(days)) {
    return { isToday: true, nextDays: days, countdown: 0 }
  }
  const nextDays = milestones.find((value) => value > days) || days + 365
  return { isToday: false, nextDays, countdown: nextDays - days }
}
