import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import {
  ChevronLeft,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Square,
} from 'lucide-react'
import { api } from '../api/client'
import { toyAvatar } from '../archive/archiveUtils'
import { useApp } from '../context/AppContext'
import type { TravelMapPoint, TravelMapResponse } from '../types'
import 'leaflet/dist/leaflet.css'

function FitBounds({
  points,
  active = true,
  version = 0,
}: {
  points: TravelMapPoint[]
  /** When false, do nothing (replay is driving the camera). */
  active?: boolean
  /** Bump to re-run fit (e.g. after replay ends). */
  version?: number
}) {
  const map = useMap()
  useEffect(() => {
    if (!active || !points.length) return
    const bounds = L.latLngBounds(points.map((p) => [p.place.lat, p.place.lng]))
    map.fitBounds(bounds.pad(0.22), { animate: true, maxZoom: 11 })
  }, [map, points, active, version])
  return null
}

function FlyToStop({
  point,
  active,
}: {
  point: TravelMapPoint | null
  active: boolean
}) {
  const map = useMap()
  useEffect(() => {
    if (!active || !point) return
    map.flyTo([point.place.lat, point.place.lng], Math.max(map.getZoom(), 8), {
      duration: 1.1,
    })
  }, [active, point, map])
  return null
}

function OpenPopupWhenActive({
  active,
  entryId,
  markerRefs,
}: {
  active: boolean
  entryId: string
  markerRefs: React.MutableRefObject<Record<string, L.Marker | null>>
}) {
  useEffect(() => {
    if (!active) return
    const t = window.setTimeout(() => {
      markerRefs.current[entryId]?.openPopup()
    }, 400)
    return () => window.clearTimeout(t)
  }, [active, entryId, markerRefs])
  return null
}

function makeAvatarIcon(avatarUrl: string, label: string, active: boolean) {
  return L.divIcon({
    className: `toy-map-marker${active ? ' toy-map-marker--active' : ''}`,
    html: `<div class="toy-map-marker__bubble${active ? ' is-active' : ''}" title="${label}"><img src="${avatarUrl}" alt="" /><span class="toy-map-marker__pin"></span></div>`,
    iconSize: [44, 52],
    iconAnchor: [22, 48],
    popupAnchor: [0, -42],
  })
}

/** Standalone route — redirects conceptually to growth map tab, keeps deep links. */
export function TravelMapPage() {
  return <TravelMapView embedded={false} />
}

/**
 * Travel map body. When `embedded`, omits the back header (used inside Growth tabs).
 */
export function TravelMapView({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const { currentToy, toys, showToast } = useApp()
  const [data, setData] = useState<TravelMapResponse | null>(null)
  const [year, setYear] = useState<'all' | number>('all')
  const [loading, setLoading] = useState(true)
  const [replaying, setReplaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [replayIndex, setReplayIndex] = useState(-1)
  /** Increment to force overview fitBounds after replay ends */
  const [overviewTick, setOverviewTick] = useState(0)
  const markerRefs = useRef<Record<string, L.Marker | null>>({})
  const endHoldTimer = useRef<number | null>(null)

  const toyIndex = toys.findIndex((t) => t.id === currentToy?.id)
  const avatar = toyAvatar(currentToy, toyIndex)

  const toyId = currentToy?.id

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!toyId) {
        setData(null)
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await api.getTravelMap(toyId)
        if (!cancelled) {
          setData(res)
          setYear('all')
          stopReplay()
        }
      } catch (err) {
        if (!cancelled) {
          showToast(err instanceof Error ? err.message : '地图加载失败')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toyId, showToast])

  const filtered = useMemo(() => {
    const points = data?.points || []
    // chronological for replay
    const list =
      year === 'all'
        ? points.slice()
        : points.filter((p) => Number(p.date.slice(0, 4)) === year)
    return list.sort((a, b) => a.date.localeCompare(b.date))
  }, [data, year])

  const cityCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of filtered) {
      const key = p.place.city || p.place.displayName
      map.set(key, (map.get(key) || 0) + 1)
    }
    return map
  }, [filtered])

  const visiblePoints = useMemo(() => {
    if (!replaying || replayIndex < 0) return filtered
    return filtered.slice(0, replayIndex + 1)
  }, [filtered, replaying, replayIndex])

  const linePositions = visiblePoints.map(
    (p) => [p.place.lat, p.place.lng] as [number, number],
  )

  const activePoint =
    replaying && replayIndex >= 0 ? filtered[replayIndex] ?? null : null

  useEffect(() => {
    if (!replaying || paused) return
    if (!filtered.length) return

    // Last stop reached: hold the close-up briefly, then overview + auto-stop
    if (replayIndex >= filtered.length - 1) {
      if (endHoldTimer.current) window.clearTimeout(endHoldTimer.current)
      endHoldTimer.current = window.setTimeout(() => {
        setReplaying(false)
        setPaused(false)
        setReplayIndex(-1)
        setOverviewTick((n) => n + 1)
        showToast('重温结束 · 已回到全览')
      }, 1800)
      return () => {
        if (endHoldTimer.current) window.clearTimeout(endHoldTimer.current)
      }
    }

    const timer = window.setTimeout(() => {
      setReplayIndex((i) => Math.min(i + 1, filtered.length - 1))
    }, 2600)
    return () => window.clearTimeout(timer)
  }, [replaying, paused, replayIndex, filtered.length, showToast])

  function startReplay() {
    if (filtered.length < 1) {
      showToast('还没有可重播的足迹')
      return
    }
    if (endHoldTimer.current) window.clearTimeout(endHoldTimer.current)
    setReplaying(true)
    setPaused(false)
    setReplayIndex(0)
    showToast('开始重温旅行…')
  }

  function stopReplay() {
    if (endHoldTimer.current) window.clearTimeout(endHoldTimer.current)
    setReplaying(false)
    setPaused(false)
    setReplayIndex(-1)
    // Snap back to full route overview
    setOverviewTick((n) => n + 1)
  }

  function togglePause() {
    if (!replaying) return
    setPaused((p) => !p)
  }

  if (!currentToy) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-ink-muted">请先选择一只玩偶</p>
        {!embedded && (
          <button
            type="button"
            className="btn-primary mt-4 px-4 py-2 text-sm"
            onClick={() => navigate('/archive')}
          >
            返回档案
          </button>
        )}
      </div>
    )
  }

  const shellClass = embedded
    ? 'flex h-[calc(100dvh-14.5rem)] min-h-[22rem] flex-col overflow-hidden bg-cream'
    : 'flex h-[calc(100dvh-5.5rem)] flex-col overflow-hidden bg-cream'

  return (
    <div className={shellClass}>
      {!embedded && (
        <header className="z-20 flex items-center gap-2 border-b border-line/60 bg-white/95 px-3 py-2.5 backdrop-blur">
          <button
            type="button"
            onClick={() => navigate('/growth?tab=map')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-ink-soft"
            aria-label="返回成长"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-ink">
              {currentToy.name} 的旅行轨迹
            </h1>
            <p className="text-[10px] text-ink-muted">
              {filtered.length} 个足迹
              {data ? ` · ${data.cityCount} 座城市` : ''}
              {replaying
                ? ` · 重温 ${Math.max(replayIndex + 1, 0)}/${filtered.length}`
                : ''}
            </p>
          </div>
        </header>
      )}

      {embedded && (
        <div className="z-20 border-b border-line/40 bg-white/90 px-3.5 py-2">
          <p className="text-[11px] text-ink-muted">
            <span className="font-medium text-ink-soft">{currentToy.name}</span>
            {' · '}
            {filtered.length} 个足迹
            {data ? ` · ${data.cityCount} 座城市` : ''}
            {replaying
              ? ` · 重温 ${Math.max(replayIndex + 1, 0)}/${filtered.length}`
              : ''}
          </p>
        </div>
      )}

      <div className="z-20 flex gap-2 overflow-x-auto border-b border-line/40 bg-white/90 px-3 py-2 [scrollbar-width:none]">
        <YearChip
          active={year === 'all'}
          onClick={() => {
            stopReplay()
            setYear('all')
          }}
          label="全部"
        />
        {(data?.years || []).map((y) => (
          <YearChip
            key={y}
            active={year === y}
            onClick={() => {
              stopReplay()
              setYear(y)
            }}
            label={String(y)}
          />
        ))}
      </div>

      {/* Replay controls */}
      <div className="z-20 flex items-center gap-2 border-b border-line/40 bg-white/95 px-3 py-2">
        {!replaying ? (
          <button
            type="button"
            onClick={startReplay}
            disabled={filtered.length < 1 || loading}
            className="btn-primary inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            开启旅行重温
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={togglePause}
              className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-mist-soft px-3 py-2 text-xs font-semibold text-matcha-deep"
            >
              {paused ? (
                <>
                  <Play className="h-3.5 w-3.5" /> 继续
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5" /> 暂停
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setPaused(false)
                setReplayIndex(0)
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-cream text-ink-soft ring-1 ring-line/50"
              aria-label="从头重播"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={stopReplay}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-cream text-ink-soft ring-1 ring-line/50"
              aria-label="结束重温"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {replaying && activePoint && (
        <div className="z-20 border-b border-line/40 bg-mustard-soft/70 px-3 py-2">
          <p className="text-[11px] font-medium text-terra-deep">
            📍 抵达 {activePoint.place.displayName}
            {activePoint.title ? ` · ${activePoint.title}` : ''}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[10px] text-ink-soft">
            {activePoint.aiDiary?.split('\n').filter(Boolean)[0] ||
              activePoint.userNote ||
              '这一站也被好好记住了。'}
          </p>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-muted">
            正在展开地图…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <MapPin className="h-6 w-6 text-matcha-deep" />
            <p className="text-sm text-ink-muted">
              还没有带地点的足迹。去记一条旅行或日常吧。
            </p>
            <button
              type="button"
              className="btn-primary mt-2 px-4 py-2 text-sm"
              onClick={() => navigate('/compose')}
            >
              新增记录
            </button>
          </div>
        ) : (
          <MapContainer
            center={[filtered[0].place.lat, filtered[0].place.lng]}
            zoom={5}
            className="h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds
              points={filtered}
              active={!replaying}
              version={overviewTick}
            />
            <FlyToStop point={activePoint} active={replaying && !paused} />
            {linePositions.length > 1 && (
              <Polyline
                positions={linePositions}
                pathOptions={{
                  color: replaying ? '#c4957a' : '#9a8758',
                  weight: replaying ? 4 : 3,
                  dashArray: replaying ? undefined : '8 10',
                  opacity: 0.85,
                }}
              />
            )}
            {visiblePoints.map((point, index) => {
              const city = point.place.city || point.place.displayName
              const count = cityCounts.get(city) || 1
              const isActive =
                replaying && filtered[replayIndex]?.entryId === point.entryId
              const globalIndex = filtered.findIndex(
                (p) => p.entryId === point.entryId,
              )
              return (
                <Marker
                  key={point.entryId}
                  position={[point.place.lat, point.place.lng]}
                  icon={makeAvatarIcon(
                    avatar,
                    `${(globalIndex >= 0 ? globalIndex : index) + 1}. ${city}`,
                    isActive,
                  )}
                  ref={(ref) => {
                    markerRefs.current[point.entryId] = ref
                  }}
                  eventHandlers={{
                    add: (e) => {
                      markerRefs.current[point.entryId] = e.target
                    },
                  }}
                >
                  <OpenPopupWhenActive
                    active={isActive}
                    entryId={point.entryId}
                    markerRefs={markerRefs}
                  />
                  <Popup className="polaroid-popup" maxWidth={240}>
                    <PolaroidCard point={point} cityCount={count} />
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        )}
      </div>

      <p className="border-t border-line/50 bg-white/95 px-3 py-1.5 text-center text-[9px] text-ink-muted">
        © OpenStreetMap · 开启「旅行重温」可动态回放轨迹并弹出景点记录
      </p>
    </div>
  )
}

function YearChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-[11px] ${
        active
          ? 'bg-matcha text-white'
          : 'bg-cream text-ink-soft ring-1 ring-line/60'
      }`}
    >
      {label}
    </button>
  )
}

function PolaroidCard({
  point,
  cityCount,
}: {
  point: TravelMapPoint
  cityCount: number
}) {
  return (
    <div className="polaroid-card">
      {point.imageUrl ? (
        <img src={point.imageUrl} alt="" className="polaroid-card__photo" />
      ) : (
        <div className="polaroid-card__photo polaroid-card__photo--empty">🧸</div>
      )}
      <div className="polaroid-card__body">
        <strong className="block text-[12px] text-ink">
          {point.title || point.place.displayName}
        </strong>
        <span className="mt-0.5 block text-[10px] text-ink-muted">
          {point.date}
          {point.mood ? ` · ${point.mood}` : ''}
          {cityCount > 1 ? ` · 同城 ${cityCount} 次` : ''}
        </span>
        <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-ink-soft">
          {point.aiDiary?.split('\n').filter(Boolean)[0] ||
            point.userNote ||
            point.place.displayName}
        </p>
        <Link
          to={`/entries/${point.entryId}`}
          className="mt-2 inline-flex text-[10px] font-semibold text-matcha-deep"
        >
          查看完整日志 →
        </Link>
      </div>
    </div>
  )
}
