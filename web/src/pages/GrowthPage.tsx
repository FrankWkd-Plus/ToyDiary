import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookHeart,
  CalendarHeart,
  Check,
  ChevronDown,
  ChevronRight,
  Flag,
  Globe2,
  History,
  MapPinned,
  PartyPopper,
} from 'lucide-react'
import { companionDays, toyAvatar } from '../archive/archiveUtils'
import { DayCountNumber } from '../components/DayCountNumber'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import { seedPlaceForLabel, uniqueCities } from '../places/placeUtils'
import type { Entry } from '../types'

export function GrowthPage() {
  const navigate = useNavigate()
  const { currentToy, entries, toys, setCurrentToyId, showToast } = useApp()
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (toys.length > 0 && !toys.some((toy) => toy.id === currentToy?.id)) {
      setCurrentToyId(toys[0].id)
    }
  }, [currentToy?.id, toys, setCurrentToyId])

  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [entries],
  )

  const days = currentToy ? companionDays(currentToy) : 0
  const travelCount = entries.filter((e) => e.type === 'travel').length
  const places = entries
    .map((e) => e.place || seedPlaceForLabel(e.location))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
  const cityCount = uniqueCities(places).length
  const photoMemories = sortedEntries.filter((e) => e.imageUrl).slice(0, 6)
  const milestones = buildMilestones(sortedEntries, days)
  const toyIndex = toys.findIndex((t) => t.id === currentToy?.id)

  function requireToy(path: string) {
    if (!currentToy) {
      showToast('请先选择玩偶')
      return
    }
    navigate(path)
  }

  return (
    <>
      <PageHeader
        title="成长"
        subtitle="和玩偶一起走过的日子"
        soft
        right={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => requireToy('/growth/travel-map')}
              className="flex h-9 items-center gap-1 rounded-full bg-paper/95 px-2.5 text-[10px] font-medium text-matcha-deep shadow-[var(--shadow-warm-sm)] ring-1 ring-line/40"
              aria-label="旅行轨迹地图"
            >
              <Globe2 className="h-3.5 w-3.5" />
              地图
            </button>
            <button
              type="button"
              onClick={() => requireToy('/growth/timeline')}
              className="flex h-9 items-center gap-1 rounded-full bg-paper/95 px-2.5 text-[10px] font-medium text-matcha-deep shadow-[var(--shadow-warm-sm)] ring-1 ring-line/40"
              aria-label="成长时间线"
            >
              <History className="h-3.5 w-3.5" />
              时间线
            </button>
          </div>
        }
      />

      <div className="px-3.5 pb-5 pt-3">
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
            <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-[var(--shadow-elevated)]">
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

        <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <DayCountNumber
            value={days}
            label="陪伴"
            unit="天"
            size="stat"
            onClick={() => requireToy('/growth/stats/companion')}
          />
          <DayCountNumber
            value={travelCount}
            label="旅行"
            unit="次"
            size="stat"
            onClick={() => requireToy('/growth/stats/travel')}
          />
          <DayCountNumber
            value={cityCount}
            label="城市"
            unit="座"
            size="stat"
            onClick={() => requireToy('/growth/stats/cities')}
          />
          <DayCountNumber
            value={entries.length}
            label="瞬间"
            unit="条"
            size="stat"
            onClick={() => requireToy('/growth/stats/moments')}
          />
        </section>

        <section className="mb-4">
          <h2 className="mb-2 flex items-center gap-1.5 px-1 text-base text-ink">
            <Flag className="h-4 w-4 shrink-0 text-terra-deep" />
            <span className="font-semibold tracking-wide">成长里程碑</span>
          </h2>
          <div className="space-y-2">
            {milestones.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  if (m.entryId) {
                    navigate(`/entries/${m.entryId}`, { state: { from: 'growth' } })
                  } else {
                    requireToy(m.path || '/growth/stats/companion')
                  }
                }}
                className="flex w-full items-start gap-3 rounded-2xl bg-white px-3.5 py-3 text-left shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50 active:scale-[0.99]"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${m.tone}`}
                  aria-hidden="true"
                >
                  {m.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm text-ink">{m.title}</strong>
                  <p className="mt-0.5 text-[11px] text-ink-muted">{m.desc}</p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted" />
              </button>
            ))}
          </div>
        </section>

        <section className="mb-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="flex items-center gap-1.5 text-base text-ink">
              <BookHeart className="h-4 w-4 shrink-0 text-rose-deep" />
              {/* Avoid display font for CJK title — some devices render 回 as a black blob */}
              <span className="font-semibold tracking-wide">回忆纪念册</span>
            </h2>
            {photoMemories.length > 0 && (
              <button
                type="button"
                onClick={() => requireToy('/growth/stats/moments')}
                className="text-[10px] font-medium text-matcha-deep"
              >
                全部
              </button>
            )}
          </div>
          {photoMemories.length === 0 ? (
            <div className="rounded-2xl bg-cream px-4 py-6 text-center text-xs text-ink-muted">
              还没有带照片的瞬间，去记下第一张合影吧。
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photoMemories.map((entry) => (
                <Link
                  key={entry.id}
                  to={`/entries/${entry.id}`}
                  state={{ from: 'growth' }}
                  className="group overflow-hidden rounded-2xl bg-cream shadow-sm ring-1 ring-line/40 active:scale-[0.98]"
                >
                  <div className="relative aspect-square">
                    <img
                      src={entry.imageUrl}
                      alt={entry.title || '回忆'}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/55 to-transparent px-1.5 pb-1.5 pt-4 text-[9px] leading-tight text-white">
                      <span className="line-clamp-2">
                        {entry.title ||
                          entry.place?.displayName ||
                          entry.location ||
                          '这一刻'}
                      </span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

function buildMilestones(entries: Entry[], days: number) {
  const items: {
    id: string
    icon: ReactNode
    tone: string
    title: string
    desc: string
    entryId?: string
    path?: string
  }[] = []
  items.push({
    id: 'days',
    icon: <CalendarHeart className="h-5 w-5" strokeWidth={1.8} />,
    tone: 'bg-peach-soft text-rose-deep',
    title: `陪伴第 ${days} 天`,
    desc: '每一个普通日子，都算数。',
    path: '/growth/stats/companion',
  })
  const first = [...entries].sort((a, b) => a.date.localeCompare(b.date))[0]
  if (first) {
    items.push({
      id: 'first',
      icon: <BookHeart className="h-5 w-5" strokeWidth={1.8} />,
      tone: 'bg-mustard-soft text-terra-deep',
      title: '第一篇日志',
      desc: `${first.date} · ${first.title || first.location || '开始的故事'}`,
      entryId: first.id,
    })
  }
  const firstTravel = entries
    .filter((e) => e.type === 'travel')
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  if (firstTravel) {
    items.push({
      id: 'travel',
      icon: <MapPinned className="h-5 w-5" strokeWidth={1.8} />,
      tone: 'bg-mist-soft text-matcha-deep',
      title: '第一次旅行记录',
      desc: `${firstTravel.date} · ${firstTravel.location || firstTravel.place?.displayName || '远方'}`,
      entryId: firstTravel.id,
    })
  }
  if (days >= 100) {
    items.push({
      id: '100',
      icon: <PartyPopper className="h-5 w-5" strokeWidth={1.8} />,
      tone: 'bg-lavender/60 text-matcha-deep',
      title: '百日纪念',
      desc: '一百个「今天也在一起」。',
      path: '/growth/stats/companion',
    })
  }
  return items.slice(0, 4)
}
