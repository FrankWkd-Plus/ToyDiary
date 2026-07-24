import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookHeart,
  Check,
  ChevronDown,
  ChevronRight,
  Flag,
  Globe2,
  MapPin,
  Sparkles,
} from 'lucide-react'
import { companionDays, toyAvatar } from '../archive/archiveUtils'
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
      <PageHeader title="成长" subtitle="和玩偶一起走过的日子" soft />

      <div className="px-3.5 pb-5 pt-3">
        {/* Toy card with integrated switch arrow */}
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
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-matcha-deep shadow-sm ring-1 ring-line/40 transition-transform active:scale-95"
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

        {/* Clickable overview stats */}
        <section className="mb-4 grid grid-cols-4 gap-2">
          <OverviewStat
            icon="📅"
            label="陪伴"
            value={`${days}`}
            unit="天"
            onClick={() => requireToy('/growth/stats/companion')}
          />
          <OverviewStat
            icon="✈️"
            label="旅行"
            value={`${travelCount}`}
            unit="次"
            onClick={() => requireToy('/growth/stats/travel')}
          />
          <OverviewStat
            icon="🏙️"
            label="城市"
            value={`${cityCount}`}
            unit="座"
            onClick={() => requireToy('/growth/stats/cities')}
          />
          <OverviewStat
            icon="✨"
            label="瞬间"
            value={`${entries.length}`}
            unit="条"
            onClick={() => requireToy('/growth/stats/moments')}
          />
        </section>

        <div className="mb-4 space-y-2.5">
          <SecondaryMenuButton
            icon={<Globe2 className="growth-globe-spin h-5 w-5" />}
            title="旅行轨迹地图"
            subtitle="按日期串起每一次出发 · OpenStreetMap"
            onClick={() => requireToy('/growth/travel-map')}
            trailing={<MapPin className="h-4 w-4 text-matcha-deep" />}
            gradient="from-mist-soft via-white to-mustard-soft"
          />
          <SecondaryMenuButton
            icon={<Sparkles className="h-5 w-5" />}
            title="成长时间线"
            subtitle="按时间回顾每一篇日志与瞬间"
            onClick={() => requireToy('/growth/timeline')}
            trailing={<ChevronRight className="h-4 w-4 text-matcha-deep" />}
            gradient="from-mustard-soft via-white to-mist-soft"
          />
        </div>

        {/* Milestones */}
        <section className="mb-4">
          <h2 className="mb-2 flex items-center gap-1.5 px-1 font-display text-base text-ink">
            <Flag className="h-4 w-4 text-terra-deep" />
            成长里程碑
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
                className="flex w-full items-start gap-3 rounded-2xl bg-white px-3.5 py-3 text-left shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50 transition-transform active:scale-[0.99]"
              >
                <span className="text-lg">{m.emoji}</span>
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm text-ink">{m.title}</strong>
                  <p className="mt-0.5 text-[11px] text-ink-muted">{m.desc}</p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted" />
              </button>
            ))}
          </div>
        </section>

        {/* Memory album — each photo opens entry detail */}
        <section className="mb-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="flex items-center gap-1.5 font-display text-base text-ink">
              <BookHeart className="h-4 w-4 text-rose-deep" />
              回忆纪念册
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
                      className="h-full w-full object-cover transition-transform group-active:scale-105"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/55 to-transparent px-1.5 pb-1.5 pt-4 text-[9px] leading-tight text-white">
                      <span className="line-clamp-2">
                        {entry.title || entry.place?.displayName || entry.location || '这一刻'}
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

function SecondaryMenuButton({
  icon,
  title,
  subtitle,
  onClick,
  trailing,
  gradient,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick: () => void
  trailing: React.ReactNode
  gradient: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[1.25rem] bg-gradient-to-r ${gradient} p-3.5 text-left shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50 transition-transform active:scale-[0.99]`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-matcha-deep shadow-sm">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block font-display text-sm text-ink">{title}</strong>
        <span className="mt-0.5 block text-[10px] text-ink-muted">{subtitle}</span>
      </span>
      {trailing}
    </button>
  )
}

function OverviewStat({
  icon,
  label,
  value,
  unit,
  onClick,
}: {
  icon: string
  label: string
  value: string
  unit: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl bg-white px-1.5 py-2.5 text-center shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50 transition-transform active:scale-95"
    >
      <span className="text-sm">{icon}</span>
      <strong className="mt-0.5 block font-display text-base leading-none text-ink">
        {value}
        <span className="ml-0.5 text-[9px] font-sans text-ink-muted">{unit}</span>
      </strong>
      <span className="mt-1 block text-[9px] text-ink-muted">{label}</span>
    </button>
  )
}

function buildMilestones(entries: Entry[], days: number) {
  const items: {
    id: string
    emoji: string
    title: string
    desc: string
    entryId?: string
    path?: string
  }[] = []
  items.push({
    id: 'days',
    emoji: '🧸',
    title: `陪伴第 ${days} 天`,
    desc: '每一个普通日子，都算数。',
    path: '/growth/stats/companion',
  })
  const first = [...entries].sort((a, b) => a.date.localeCompare(b.date))[0]
  if (first) {
    items.push({
      id: 'first',
      emoji: '📖',
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
      emoji: '✈️',
      title: '第一次旅行记录',
      desc: `${firstTravel.date} · ${firstTravel.location || firstTravel.place?.displayName || '远方'}`,
      entryId: firstTravel.id,
    })
  }
  if (days >= 100) {
    items.push({
      id: '100',
      emoji: '🎉',
      title: '百日纪念',
      desc: '一百个「今天也在一起」。',
      path: '/growth/stats/companion',
    })
  }
  return items.slice(0, 4)
}
