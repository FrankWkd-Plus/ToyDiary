import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookHeart,
  CalendarHeart,
  Check,
  ChevronDown,
  Flag,
  Globe2,
  History,
  MapPin,
  MapPinned,
  PartyPopper,
  Sparkles,
} from 'lucide-react'
import { companionDays, toyAvatar } from '../archive/archiveUtils'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import type { Entry } from '../types'

const TravelMapView = lazy(() =>
  import('./TravelMapPage').then((m) => ({ default: m.TravelMapView })),
)

type GrowthTab = 'timeline' | 'map'

type TimelineItem =
  | {
      kind: 'milestone'
      id: string
      date: string
      title: string
      desc: string
      tone: string
      icon: ReactNode
      entryId?: string
      path?: string
    }
  | {
      kind: 'entry'
      id: string
      date: string
      entry: Entry
    }

/**
 * Growth hub: timeline (default) + travel map, switched via prominent tabs.
 */
export function GrowthPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentToy, entries, toys, setCurrentToyId, showToast } = useApp()
  const [pickerOpen, setPickerOpen] = useState(false)

  const tab: GrowthTab =
    searchParams.get('tab') === 'map' ? 'map' : 'timeline'

  useEffect(() => {
    if (toys.length > 0 && !toys.some((toy) => toy.id === currentToy?.id)) {
      setCurrentToyId(toys[0].id)
    }
  }, [currentToy?.id, toys, setCurrentToyId])

  const toyIndex = toys.findIndex((t) => t.id === currentToy?.id)
  const days = currentToy ? companionDays(currentToy) : 0

  const items = useMemo(() => {
    const list: TimelineItem[] = entries.map((entry) => ({
      kind: 'entry' as const,
      id: `entry-${entry.id}`,
      date: entry.date,
      entry,
    }))

    for (const m of buildMilestones(entries, days, currentToy?.birthDate)) {
      list.push({
        kind: 'milestone',
        id: m.id,
        date: m.date,
        title: m.title,
        desc: m.desc,
        tone: m.tone,
        icon: m.icon,
        entryId: m.entryId,
        path: m.path,
      })
    }

    return list.sort((a, b) => {
      const byDate = b.date.localeCompare(a.date)
      if (byDate !== 0) return byDate
      if (a.kind !== b.kind) return a.kind === 'milestone' ? -1 : 1
      return 0
    })
  }, [entries, days, currentToy?.birthDate])

  function setTab(next: GrowthTab) {
    if (next === 'timeline') {
      // Default — keep URL clean
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ tab: 'map' }, { replace: true })
    }
  }

  return (
    <div className={tab === 'map' ? 'flex min-h-full flex-col' : 'min-h-full'}>
      <PageHeader title="成长" subtitle="和玩偶一起走过的日子" soft />

      <div className="relative z-20 px-3.5 pt-3">
        <div className="relative mb-3">
          <div className="growth-toy-bubble min-w-0 w-full !max-w-none justify-between pr-1.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <img
                src={toyAvatar(currentToy, toyIndex)}
                alt=""
                className="h-9 w-9 rounded-full object-cover shadow-sm"
              />
              <span className="min-w-0">
                <span className="block text-[10px] text-ink-muted">正在查看</span>
                <strong className="block max-w-[12rem] truncate text-sm text-ink">
                  {currentToy?.name || '请选择玩偶'}
                </strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-matcha-deep shadow-sm ring-1 ring-line/40"
              aria-expanded={pickerOpen}
              aria-label="切换玩偶"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${pickerOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {pickerOpen && (
            <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-[var(--shadow-elevated)]">
              {toys.map((toy) => {
                const selected = toy.id === currentToy?.id
                return (
                  <button
                    key={toy.id}
                    type="button"
                    onClick={() => {
                      setCurrentToyId(toy.id)
                      setPickerOpen(false)
                      showToast(`已切换到 ${toy.name}`)
                    }}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm ${
                      selected
                        ? 'bg-mist-soft font-medium text-matcha-deep'
                        : 'text-ink-soft active:bg-cream'
                    }`}
                  >
                    <img
                      src={toyAvatar(toy, toys.findIndex((t) => t.id === toy.id))}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover"
                    />
                    <span className="min-w-0 flex-1 truncate">{toy.name}</span>
                    {selected && <Check className="h-4 w-4" strokeWidth={2.5} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Prominent timeline / map switcher */}
        <div
          className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-cream p-1 ring-1 ring-line/50"
          role="tablist"
          aria-label="成长视图"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'timeline'}
            onClick={() => setTab('timeline')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all ${
              tab === 'timeline'
                ? 'bg-white text-matcha-deep shadow-[var(--shadow-warm-sm)]'
                : 'text-ink-muted active:bg-white/50'
            }`}
          >
            <History className="h-4 w-4" />
            时间线
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'map'}
            onClick={() => setTab('map')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all ${
              tab === 'map'
                ? 'bg-white text-matcha-deep shadow-[var(--shadow-warm-sm)]'
                : 'text-ink-muted active:bg-white/50'
            }`}
          >
            <Globe2 className="h-4 w-4" />
            地图
          </button>
        </div>
      </div>

      {tab === 'timeline' ? (
        <div className="px-3.5 pb-5" role="tabpanel">
          {!currentToy ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <p className="text-sm text-ink-muted">请先选择玩偶</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <Sparkles className="h-6 w-6 text-matcha-deep" />
              <p className="mt-2 text-sm text-ink-muted">还没有成长轨迹</p>
              <Link to="/compose" className="btn-primary mt-4 px-5 py-2.5 text-sm">
                新建记录
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-3 px-1 text-[11px] text-ink-muted">
                {currentToy.name} · {items.length} 个节点 · 含成长里程碑
              </p>
              <div className="growth-timeline">
                {items.map((item, index) => {
                  const { monthDay, year } = splitDate(item.date)

                  if (item.kind === 'milestone') {
                    return (
                      <article key={item.id} className="growth-row">
                        <div className="growth-date">
                          <time dateTime={item.date}>
                            <span className="block font-display text-[15px] leading-none text-ink">
                              {monthDay}
                            </span>
                            <span className="mt-1 block text-[9px] text-ink-muted">
                              {year}
                            </span>
                          </time>
                        </div>
                        <div
                          className={`growth-dot ${index === 0 ? 'growth-dot-current' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (item.entryId) {
                              navigate(`/entries/${item.entryId}`, {
                                state: { from: 'growth-timeline' },
                              })
                            } else if (item.path) {
                              navigate(item.path)
                            } else {
                              navigate('/growth/stats/companion')
                            }
                          }}
                          className="growth-milestone-card w-full text-left"
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}
                            aria-hidden="true"
                          >
                            {item.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-wide text-terra-deep">
                              <Flag className="h-3 w-3" />
                              里程碑
                            </span>
                            <strong className="mt-0.5 block text-sm text-ink">
                              {item.title}
                            </strong>
                            <span className="mt-0.5 block text-[11px] text-ink-muted">
                              {item.desc}
                            </span>
                          </span>
                        </button>
                      </article>
                    )
                  }

                  const entry = item.entry
                  const location = entry.place?.displayName || entry.location
                  const text = entry.aiDiary?.trim() || entry.userNote?.trim()
                  return (
                    <article key={item.id} className="growth-row">
                      <div className="growth-date">
                        <time dateTime={entry.date}>
                          <span className="block font-display text-[15px] leading-none text-ink">
                            {monthDay}
                          </span>
                          <span className="mt-1 block text-[9px] text-ink-muted">
                            {year}
                          </span>
                        </time>
                      </div>
                      <div
                        className={`growth-dot ${index === 0 ? 'growth-dot-current' : ''}`}
                      />
                      <Link
                        to={`/entries/${entry.id}`}
                        state={{ from: 'growth-timeline' }}
                        className="growth-entry-card"
                      >
                        {entry.imageUrl && (
                          <div className="growth-entry-image">
                            <img
                              src={entry.imageUrl}
                              alt={entry.title || '成长记录'}
                            />
                          </div>
                        )}
                        <div className="p-3.5">
                          <h2 className="font-medium leading-snug text-ink">
                            {entry.title || '这一刻'}
                          </h2>
                          {location && (
                            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-muted">
                              <MapPin className="h-3.5 w-3.5 text-matcha-deep" />
                              {location}
                            </p>
                          )}
                          {text && (
                            <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-ink-soft">
                              {text}
                            </p>
                          )}
                        </div>
                      </Link>
                    </article>
                  )
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1" role="tabpanel">
          <Suspense
            fallback={
              <div className="flex min-h-[40vh] items-center justify-center text-sm text-ink-muted">
                正在展开地图…
              </div>
            }
          >
            <TravelMapView embedded />
          </Suspense>
        </div>
      )}
    </div>
  )
}

function buildMilestones(
  entries: Entry[],
  days: number,
  birthDate?: string,
) {
  const items: {
    id: string
    date: string
    icon: ReactNode
    tone: string
    title: string
    desc: string
    entryId?: string
    path?: string
  }[] = []

  const today = formatToday()
  items.push({
    id: 'milestone-days',
    date: today,
    icon: <CalendarHeart className="h-4 w-4" strokeWidth={1.8} />,
    tone: 'bg-peach-soft text-rose-deep',
    title: `陪伴第 ${days} 天`,
    desc: '每一个普通日子，都算数。',
    path: '/growth/stats/companion',
  })

  const first = [...entries].sort((a, b) => a.date.localeCompare(b.date))[0]
  if (first) {
    items.push({
      id: 'milestone-first',
      date: first.date,
      icon: <BookHeart className="h-4 w-4" strokeWidth={1.8} />,
      tone: 'bg-mustard-soft text-terra-deep',
      title: '第一篇日志',
      desc: first.title || first.location || '开始的故事',
      entryId: first.id,
    })
  }

  const firstTravel = entries
    .filter((e) => e.type === 'travel')
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  if (firstTravel) {
    items.push({
      id: 'milestone-travel',
      date: firstTravel.date,
      icon: <MapPinned className="h-4 w-4" strokeWidth={1.8} />,
      tone: 'bg-mist-soft text-matcha-deep',
      title: '第一次旅行记录',
      desc:
        firstTravel.location ||
        firstTravel.place?.displayName ||
        '远方',
      entryId: firstTravel.id,
    })
  }

  if (days >= 100 && birthDate) {
    items.push({
      id: 'milestone-100',
      date: addDaysIso(birthDate, 99),
      icon: <PartyPopper className="h-4 w-4" strokeWidth={1.8} />,
      tone: 'bg-lavender/60 text-matcha-deep',
      title: '百日纪念',
      desc: '一百个「今天也在一起」。',
      path: '/growth/stats/companion',
    })
  }

  return items
}

function formatToday() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDaysIso(iso: string, daysToAdd: number) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + daysToAdd)
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function splitDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return { year: y, monthDay: `${Number(m)}/${Number(d)}` }
}
