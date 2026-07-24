import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  Plane,
  Sparkles,
} from 'lucide-react'
import { companionDays } from '../archive/archiveUtils'
import { useApp } from '../context/AppContext'
import {
  placeCityKey,
  seedPlaceForLabel,
} from '../places/placeUtils'
import type { Entry, Place } from '../types'
import { ENTRY_TYPE_LABEL } from '../types'

type StatKind = 'companion' | 'travel' | 'cities' | 'moments'

const META: Record<
  StatKind,
  { title: string; subtitle: (n: number) => string; icon: string }
> = {
  companion: {
    title: '陪伴天数',
    subtitle: (n) => `已经一起走过 ${n} 天`,
    icon: '📅',
  },
  travel: {
    title: '旅行记录',
    subtitle: (n) => `${n} 次出发`,
    icon: '✈️',
  },
  cities: {
    title: '到访城市',
    subtitle: (n) => `${n} 座城市留下脚印`,
    icon: '🏙️',
  },
  moments: {
    title: '记录瞬间',
    subtitle: (n) => `共 ${n} 条成长瞬间`,
    icon: '✨',
  },
}

export function GrowthStatsPage() {
  const { kind } = useParams<{ kind: string }>()
  const navigate = useNavigate()
  const { currentToy, entries } = useApp()
  const statKind = (['companion', 'travel', 'cities', 'moments'] as const).includes(
    kind as StatKind,
  )
    ? (kind as StatKind)
    : null

  const days = currentToy ? companionDays(currentToy) : 0
  const travelEntries = useMemo(
    () =>
      entries
        .filter((e) => e.type === 'travel')
        .sort((a, b) => b.date.localeCompare(a.date)),
    [entries],
  )
  const momentEntries = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries],
  )
  const cityGroups = useMemo(() => groupByCity(entries), [entries])

  if (!statKind) {
    return (
      <Empty message="页面不存在" onBack={() => navigate('/growth')} />
    )
  }
  if (!currentToy) {
    return (
      <Empty message="请先选择玩偶" onBack={() => navigate('/growth')} />
    )
  }

  const meta = META[statKind]
  const count =
    statKind === 'companion'
      ? days
      : statKind === 'travel'
        ? travelEntries.length
        : statKind === 'cities'
          ? cityGroups.length
          : momentEntries.length

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-line/60 bg-white/95 px-3 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/growth')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-ink-soft"
            aria-label="返回成长"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base text-ink">
              {meta.icon} {meta.title}
            </h1>
            <p className="text-[10px] text-ink-muted">
              {currentToy.name} · {meta.subtitle(count)}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-3 px-3.5 py-4">
        <section className="rounded-[1.35rem] bg-gradient-to-br from-mist-soft via-white to-mustard-soft p-4 shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50">
          <p className="text-[10px] font-medium tracking-wider text-matcha-deep">
            {currentToy.name}
          </p>
          <p className="mt-1 font-display text-3xl text-ink">
            {count}
            <span className="ml-1 text-sm text-ink-muted">
              {statKind === 'companion'
                ? '天'
                : statKind === 'travel'
                  ? '次'
                  : statKind === 'cities'
                    ? '座'
                    : '条'}
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-soft">{meta.subtitle(count)}</p>
        </section>

        {statKind === 'companion' && (
          <CompanionDetail
            days={days}
            birthDate={currentToy.birthDate}
            birthPlace={currentToy.birthPlace}
            entryCount={entries.length}
            firstEntry={momentEntries[momentEntries.length - 1]}
          />
        )}

        {statKind === 'travel' && (
          <EntryList
            entries={travelEntries}
            empty="还没有旅行记录，去记一次出发吧。"
            emptyIcon={<Plane className="h-6 w-6 text-matcha-deep" />}
          />
        )}

        {statKind === 'cities' && (
          <CityList groups={cityGroups} />
        )}

        {statKind === 'moments' && (
          <EntryList
            entries={momentEntries}
            empty="还没有瞬间记录。"
            emptyIcon={<Sparkles className="h-6 w-6 text-matcha-deep" />}
          />
        )}
      </div>
    </div>
  )
}

function CompanionDetail({
  days,
  birthDate,
  birthPlace,
  entryCount,
  firstEntry,
}: {
  days: number
  birthDate: string
  birthPlace: string
  entryCount: number
  firstEntry?: Entry
}) {
  return (
    <div className="space-y-2">
      <InfoRow label="相识 / 出生日期" value={birthDate} />
      <InfoRow label="出生地" value={birthPlace} />
      <InfoRow label="累计日志" value={`${entryCount} 条`} />
      {firstEntry && (
        <Link
          to={`/entries/${firstEntry.id}`}
          state={{ from: 'growth-stats' }}
          className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50 active:bg-cream"
        >
          <Heart className="h-4 w-4 shrink-0 text-rose-deep" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-ink">第一篇日志</span>
            <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
              {firstEntry.date} · {firstEntry.title || '开始的故事'}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-ink-muted" />
        </Link>
      )}
      <p className="px-1 pt-2 text-[11px] leading-relaxed text-ink-muted">
        从 {birthDate} 到今天，已经一起度过 {days} 天。继续记录，下一次纪念会自己长出来。
      </p>
    </div>
  )
}

function EntryList({
  entries,
  empty,
  emptyIcon,
}: {
  entries: Entry[]
  empty: string
  emptyIcon: React.ReactNode
}) {
  if (!entries.length) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
        {emptyIcon}
        <p className="text-xs text-ink-muted">{empty}</p>
        <Link to="/compose" className="btn-primary mt-2 px-4 py-2 text-sm">
          去记录
        </Link>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry) => {
        const location = entry.place?.displayName || entry.location
        return (
          <li key={entry.id}>
            <Link
              to={`/entries/${entry.id}`}
              state={{ from: 'growth-stats' }}
              className="flex gap-3 overflow-hidden rounded-2xl bg-white p-2.5 shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50 active:scale-[0.99]"
            >
              {entry.imageUrl ? (
                <img
                  src={entry.imageUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-cream text-xl">
                  📝
                </span>
              )}
              <span className="min-w-0 flex-1 py-0.5">
                <strong className="block truncate text-sm text-ink">
                  {entry.title || '这一刻'}
                </strong>
                <span className="mt-0.5 block text-[10px] text-ink-muted">
                  {entry.date}
                  {ENTRY_TYPE_LABEL[entry.type]
                    ? ` · ${ENTRY_TYPE_LABEL[entry.type]}`
                    : ''}
                </span>
                {location && (
                  <span className="mt-1 flex items-center gap-1 text-[11px] text-ink-soft">
                    <MapPin className="h-3 w-3 text-matcha-deep" />
                    <span className="truncate">{location}</span>
                  </span>
                )}
              </span>
              <ChevronRight className="mt-5 h-4 w-4 shrink-0 text-ink-muted" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function CityList({
  groups,
}: {
  groups: { key: string; place: Place; entries: Entry[] }[]
}) {
  if (!groups.length) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
        <MapPin className="h-6 w-6 text-matcha-deep" />
        <p className="text-xs text-ink-muted">还没有到访城市，给记录加上地点吧。</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {groups.map((g) => (
        <li
          key={g.key}
          className="rounded-2xl bg-white p-3.5 shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50"
        >
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-matcha-deep" />
            <div className="min-w-0 flex-1">
              <strong className="block text-sm text-ink">{g.key}</strong>
              <p className="mt-0.5 text-[10px] text-ink-muted">
                {[g.place.region, g.place.country].filter(Boolean).join(' · ') ||
                  g.place.displayName}
                {' · '}
                {g.entries.length} 次
              </p>
              <div className="mt-2 space-y-1">
                {g.entries.slice(0, 4).map((e) => (
                  <Link
                    key={e.id}
                    to={`/entries/${e.id}`}
                    state={{ from: 'growth-stats' }}
                    className="flex items-center justify-between gap-2 rounded-xl bg-cream/80 px-2.5 py-1.5 text-[11px] active:bg-cream"
                  >
                    <span className="min-w-0 truncate text-ink-soft">
                      {e.date} · {e.title || '记录'}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function groupByCity(entries: Entry[]) {
  const map = new Map<string, { key: string; place: Place; entries: Entry[] }>()
  for (const entry of entries) {
    const place = entry.place || seedPlaceForLabel(entry.location)
    if (!place) continue
    const key = placeCityKey(place)
    const existing = map.get(key)
    if (existing) existing.entries.push(entry)
    else map.set(key, { key, place, entries: [entry] })
  }
  return [...map.values()]
    .map((g) => ({
      ...g,
      entries: g.entries.sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => b.entries.length - a.entries.length)
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white px-3.5 py-3 shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  )
}

function Empty({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-ink-muted">{message}</p>
      <button type="button" className="btn-primary mt-4 px-4 py-2 text-sm" onClick={onBack}>
        返回成长
      </button>
    </div>
  )
}