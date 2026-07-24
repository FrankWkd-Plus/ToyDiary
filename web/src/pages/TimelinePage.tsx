import { useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  MapPin,
  MessageCircle,
  PenLine,
  Sparkles,
} from 'lucide-react'
import { companionDays, toyAvatar } from '../archive/archiveUtils'
import { RecordMethodSheet } from '../components/RecordMethodSheet'
import { useApp } from '../context/AppContext'

export function TimelinePage() {
  const navigate = useNavigate()
  const {
    currentToy,
    toys,
    setCurrentToyId,
    showToast,
  } = useApp()
  const [toyPickerOpen, setToyPickerOpen] = useState(false)
  const [recordSheetOpen, setRecordSheetOpen] = useState(false)
  const days = currentToy ? companionDays(currentToy) : 0
  const milestone = getMilestone(days)
  const currentToyIndex = toys.findIndex((toy) => toy.id === currentToy?.id)
  const avatar = toyAvatar(currentToy, currentToyIndex)

  function openToyDetail() {
    if (currentToy) navigate(`/archive/toys/${currentToy.id}`)
  }

  function onToyCardKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openToyDetail()
    }
  }

  return (
    <div className="min-h-full">
      <header className="header-band sticky top-0 z-10 flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-paper/90 text-lg shadow-[var(--shadow-warm-sm)] ring-1 ring-line/40">
            🧸
          </span>
          <div>
            <h1 className="font-display text-xl leading-none tracking-wide text-ink">
              Toy Dairy
            </h1>
            <p className="mt-0.5 text-[10px] tracking-widest text-ink-muted">
              玩偶手帐
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/conversation')}
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-mustard-soft text-matcha-deep shadow-[var(--shadow-warm-sm)] ring-1 ring-line/30 transition-transform active:scale-95"
          aria-label="进入玩偶对话"
        >
          <MessageCircle className="h-5 w-5 fill-white/70" />
          <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full border-2 border-white bg-rose" />
        </button>
      </header>

      <main className="space-y-4 px-4 pb-5 pt-4">
        {currentToy ? (
          <section className="relative">
            <article
              role="button"
              tabIndex={0}
              onClick={openToyDetail}
              onKeyDown={onToyCardKeyDown}
              className="archive-toy-card cursor-pointer active:scale-[0.99] transition-transform"
              aria-label={`查看 ${currentToy.name} 的玩偶档案`}
            >
              <div className="archive-toy-card__accent" />
              <div className="relative flex gap-3.5 p-4">
                <div className="h-[5.6rem] w-[5.6rem] shrink-0 overflow-hidden rounded-[1.25rem] border-2 border-white bg-cream shadow-md">
                  <img
                    src={avatar}
                    alt={currentToy.name}
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
                        {currentToy.name}
                      </h2>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/80 px-2 py-1 text-[10px] text-ink-muted">
                      陪伴 {days} 天
                    </span>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-muted">
                    <MapPin className="h-3.5 w-3.5 text-matcha-deep" />
                    出生于 {currentToy.birthPlace}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-soft">
                    “{currentToy.monologue || '今天也想和你一起收藏生活。'}”
                  </p>
                </div>
              </div>

              <div className="relative flex items-center justify-between border-t border-white/75 px-4 py-2.5">
                <span className="text-[10px] text-ink-muted">
                  点击查看完整玩偶档案
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setToyPickerOpen((open) => !open)
                  }}
                  className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-matcha-deep shadow-sm"
                  aria-expanded={toyPickerOpen}
                >
                  切换玩偶
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${toyPickerOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
            </article>

            {toyPickerOpen && (
              <div className="absolute inset-x-2 top-full z-20 mt-2 rounded-2xl border border-line bg-white p-1.5 shadow-[var(--shadow-elevated)]">
                {toys.map((toy, index) => {
                  const selected = toy.id === currentToy.id
                  return (
                    <button
                      key={toy.id}
                      type="button"
                      onClick={() => {
                        setCurrentToyId(toy.id)
                        setToyPickerOpen(false)
                        showToast(`已切换到 ${toy.name} 的档案`)
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left ${
                        selected ? 'bg-mist-soft' : 'active:bg-cream'
                      }`}
                    >
                      <img
                        src={toyAvatar(toy, index)}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {toy.name}
                      </span>
                      {selected && (
                        <Check className="h-4 w-4 text-matcha-deep" strokeWidth={2.5} />
                      )}
                    </button>
                  )
                })}
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

        <button
          type="button"
          onClick={() => setRecordSheetOpen(true)}
          className="archive-quick-record group w-full text-left active:scale-[0.99] transition-transform"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-matcha-deep shadow-sm">
            <PenLine className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block font-display text-lg text-ink">记下此刻</strong>
            <span className="mt-0.5 block text-[11px] text-ink-muted">
              照片、拍摄或一句想对玩偶说的话
            </span>
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha text-white transition-transform group-active:translate-x-0.5">
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>

        {currentToy && (
          <button
            type="button"
            onClick={() => navigate(`/memories/${currentToy.id}`)}
            className="archive-milestone-card w-full overflow-hidden text-left active:scale-[0.99] transition-transform"
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
                  <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
                    谢谢你把每一个普通日子，都变成我们的纪念日。
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 font-display text-xl text-ink">下一次纪念</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                    距离我们相识 {milestone.nextDays} 天还有{' '}
                    <strong>{milestone.countdown}</strong> 天
                  </p>
                  <p className="mt-2 text-[10px] text-ink-muted">
                    继续记录，我们会一起抵达。
                  </p>
                </>
              )}
              <span className="mt-3 inline-flex items-center text-[10px] font-semibold text-matcha-deep">
                进入回忆展厅
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="absolute -bottom-5 -right-2 h-36 w-36 rotate-6 overflow-hidden rounded-[2rem] border-[5px] border-white bg-white shadow-lg">
              <img
                src={avatar}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <Bell className="absolute right-32 top-5 h-4 w-4 rotate-12 text-terra-deep/60" />
          </button>
        )}
      </main>

      <RecordMethodSheet
        open={recordSheetOpen}
        onClose={() => setRecordSheetOpen(false)}
      />
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
