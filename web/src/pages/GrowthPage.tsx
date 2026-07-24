import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookHeart,
  Check,
  ChevronDown,
  Flag,
  Globe2,
  Heart,
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

  return (
    <>
      <PageHeader title="成长" subtitle="和玩偶一起走过的日子" soft />

      <div className="px-3.5 pb-5 pt-3">
        <div className="relative mb-3 flex items-center justify-between gap-3">
          <div className="growth-toy-bubble min-w-0 flex-1">
            <img
              src={toyAvatar(currentToy, toyIndex)}
              alt=""
              className="h-8 w-8 rounded-full object-cover shadow-sm"
            />
            <span className="min-w-0">
              <span className="block text-[10px] text-ink-muted">正在查看</span>
              <strong className="block max-w-[9rem] truncate text-xs text-ink">
                {currentToy?.name || '请选择玩偶'}
              </strong>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!currentToy) {
                  showToast('请先选择玩偶')
                  return
                }
                navigate('/growth/travel-map')
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-mist-soft text-matcha-deep shadow-[var(--shadow-warm-sm)] ring-1 ring-line/40"
              aria-label="打开旅行轨迹地图"
              title="旅行轨迹"
            >
              <Globe2 className="growth-globe-spin h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              className="flex items-center gap-1 rounded-full border border-line bg-white px-3 py-2 text-xs font-medium text-matcha-deep shadow-[var(--shadow-warm-sm)]"
              aria-expanded={pickerOpen}
            >
              切换
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${pickerOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {pickerOpen && (
            <div className="absolute right-0 top-12 z-20 w-48 overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-[var(--shadow-elevated)]">
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
                      selected ? 'bg-mist-soft font-medium text-matcha-deep' : 'text-ink-soft'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{toy.name}</span>
                    {selected && <Check className="h-4 w-4" strokeWidth={2.5} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Overview stats */}
        <section className="mb-4 grid grid-cols-4 gap-2">
          <OverviewStat icon="📅" label="陪伴" value={`${days}`} unit="天" />
          <OverviewStat icon="✈️" label="旅行" value={`${travelCount}`} unit="次" />
          <OverviewStat icon="🏙️" label="城市" value={`${cityCount}`} unit="座" />
          <OverviewStat icon="✨" label="瞬间" value={`${entries.length}`} unit="条" />
        </section>

        <button
          type="button"
          onClick={() => navigate('/growth/travel-map')}
          className="mb-4 flex w-full items-center gap-3 rounded-[1.25rem] bg-gradient-to-r from-mist-soft via-white to-mustard-soft p-3.5 text-left shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50 active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-matcha-deep shadow-sm">
            <Globe2 className="growth-globe-spin h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block font-display text-sm text-ink">旅行轨迹地图</strong>
            <span className="mt-0.5 block text-[10px] text-ink-muted">
              按日期串起每一次出发 · OpenStreetMap
            </span>
          </span>
          <MapPin className="h-4 w-4 text-matcha-deep" />
        </button>

        {/* Milestones */}
        <section className="mb-4">
          <h2 className="mb-2 flex items-center gap-1.5 px-1 font-display text-base text-ink">
            <Flag className="h-4 w-4 text-terra-deep" />
            成长里程碑
          </h2>
          <div className="space-y-2">
            {milestones.map((m) => (
              <div
                key={m.id}
                className="flex items-start gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50"
              >
                <span className="text-lg">{m.emoji}</span>
                <div className="min-w-0">
                  <strong className="block text-sm text-ink">{m.title}</strong>
                  <p className="mt-0.5 text-[11px] text-ink-muted">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Memory album */}
        <section className="mb-4">
          <h2 className="mb-2 flex items-center gap-1.5 px-1 font-display text-base text-ink">
            <BookHeart className="h-4 w-4 text-rose-deep" />
            回忆纪念册
          </h2>
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
                  className="overflow-hidden rounded-2xl bg-cream shadow-sm ring-1 ring-line/40 active:scale-[0.98]"
                >
                  <img
                    src={entry.imageUrl}
                    alt={entry.title || '回忆'}
                    className="aspect-square w-full object-cover"
                  />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Timeline list */}
        <h2 className="mb-2 flex items-center gap-1.5 px-1 font-display text-base text-ink">
          <Sparkles className="h-4 w-4 text-matcha-deep" />
          成长时间线
        </h2>
        {sortedEntries.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center text-center">
            <Heart className="h-6 w-6 text-matcha-deep" />
            <p className="mt-2 text-sm text-ink-muted">还没有成长轨迹</p>
            <Link to="/compose" className="btn-primary mt-4 px-5 py-2.5 text-sm">
              新建记录
            </Link>
          </div>
        ) : (
          <div className="growth-timeline">
            {sortedEntries.map((entry, index) => (
              <TimelineItem key={entry.id} entry={entry} isFirst={index === 0} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function OverviewStat({
  icon,
  label,
  value,
  unit,
}: {
  icon: string
  label: string
  value: string
  unit: string
}) {
  return (
    <div className="rounded-2xl bg-white px-1.5 py-2.5 text-center shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50">
      <span className="text-sm">{icon}</span>
      <strong className="mt-0.5 block font-display text-base leading-none text-ink">
        {value}
        <span className="ml-0.5 text-[9px] font-sans text-ink-muted">{unit}</span>
      </strong>
      <span className="mt-1 block text-[9px] text-ink-muted">{label}</span>
    </div>
  )
}

function buildMilestones(entries: Entry[], days: number) {
  const items: { id: string; emoji: string; title: string; desc: string }[] = []
  items.push({
    id: 'days',
    emoji: '🧸',
    title: `陪伴第 ${days} 天`,
    desc: '每一个普通日子，都算数。',
  })
  const first = [...entries].sort((a, b) => a.date.localeCompare(b.date))[0]
  if (first) {
    items.push({
      id: 'first',
      emoji: '📖',
      title: '第一篇日志',
      desc: `${first.date} · ${first.title || first.location || '开始的故事'}`,
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
    })
  }
  if (days >= 100) {
    items.push({
      id: '100',
      emoji: '🎉',
      title: '百日纪念',
      desc: '一百个「今天也在一起」。',
    })
  }
  return items.slice(0, 4)
}

function TimelineItem({ entry, isFirst }: { entry: Entry; isFirst: boolean }) {
  const { monthDay, year } = splitDate(entry.date)
  const hasImage = Boolean(entry.imageUrl)
  const text = entry.aiDiary?.trim() || entry.userNote?.trim()
  const location = entry.place?.displayName || entry.location

  return (
    <article className="growth-row">
      <div className="growth-date">
        <time dateTime={entry.date}>
          <span className="block font-display text-[15px] leading-none text-ink">
            {monthDay}
          </span>
          <span className="mt-1 block text-[9px] text-ink-muted">{year}</span>
        </time>
      </div>
      <div className={`growth-dot ${isFirst ? 'growth-dot-current' : ''}`} />
      <Link
        to={`/entries/${entry.id}`}
        state={{ from: 'growth' }}
        className="growth-entry-card"
      >
        {hasImage && (
          <div className="growth-entry-image">
            <img src={entry.imageUrl} alt={entry.title || '成长记录'} />
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
            <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
              {text}
            </p>
          )}
        </div>
      </Link>
    </article>
  )
}

function splitDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return { year: y, monthDay: `${Number(m)}/${Number(d)}` }
}
