import { useEffect, useMemo, useState } from 'react'
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
import { ChevronLeft, MapPin } from 'lucide-react'
import { api } from '../api/client'
import { toyAvatar } from '../archive/archiveUtils'
import { useApp } from '../context/AppContext'
import type { TravelMapPoint, TravelMapResponse } from '../types'
import 'leaflet/dist/leaflet.css'

function FitBounds({ points }: { points: TravelMapPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    const bounds = L.latLngBounds(points.map((p) => [p.place.lat, p.place.lng]))
    map.fitBounds(bounds.pad(0.22), { animate: true, maxZoom: 11 })
  }, [map, points])
  return null
}

function makeAvatarIcon(avatarUrl: string, label: string) {
  return L.divIcon({
    className: 'toy-map-marker',
    html: `<div class="toy-map-marker__bubble" title="${label}"><img src="${avatarUrl}" alt="" /><span class="toy-map-marker__pin"></span></div>`,
    iconSize: [44, 52],
    iconAnchor: [22, 48],
    popupAnchor: [0, -42],
  })
}

export function TravelMapPage() {
  const navigate = useNavigate()
  const { currentToy, toys, showToast } = useApp()
  const [data, setData] = useState<TravelMapResponse | null>(null)
  const [year, setYear] = useState<'all' | number>('all')
  const [loading, setLoading] = useState(true)

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
  }, [toyId, showToast])

  const filtered = useMemo(() => {
    const points = data?.points || []
    if (year === 'all') return points
    return points.filter((p) => Number(p.date.slice(0, 4)) === year)
  }, [data, year])

  // Aggregate same-city counts for badge clarity
  const cityCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of filtered) {
      const key = p.place.city || p.place.displayName
      map.set(key, (map.get(key) || 0) + 1)
    }
    return map
  }, [filtered])

  const linePositions = filtered.map(
    (p) => [p.place.lat, p.place.lng] as [number, number],
  )

  if (!currentToy) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-ink-muted">请先选择一只玩偶</p>
        <button
          type="button"
          className="btn-primary mt-4 px-4 py-2 text-sm"
          onClick={() => navigate('/archive')}
        >
          返回档案
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col overflow-hidden bg-cream">
      <header className="z-20 flex items-center gap-2 border-b border-line/60 bg-white/95 px-3 py-2.5 backdrop-blur">
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
            {currentToy.name} 的旅行轨迹
          </h1>
          <p className="text-[10px] text-ink-muted">
            {filtered.length} 个足迹
            {data ? ` · ${data.cityCount} 座城市` : ''}
          </p>
        </div>
      </header>

      <div className="z-20 flex gap-2 overflow-x-auto border-b border-line/40 bg-white/90 px-3 py-2 [scrollbar-width:none]">
        <YearChip
          active={year === 'all'}
          onClick={() => setYear('all')}
          label="全部"
        />
        {(data?.years || []).map((y) => (
          <YearChip
            key={y}
            active={year === y}
            onClick={() => setYear(y)}
            label={String(y)}
          />
        ))}
      </div>

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
            <FitBounds points={filtered} />
            {linePositions.length > 1 && (
              <Polyline
                positions={linePositions}
                pathOptions={{
                  color: '#9a8758',
                  weight: 3,
                  dashArray: '8 10',
                  opacity: 0.75,
                }}
              />
            )}
            {filtered.map((point, index) => {
              const city = point.place.city || point.place.displayName
              const count = cityCounts.get(city) || 1
              return (
                <Marker
                  key={point.entryId}
                  position={[point.place.lat, point.place.lng]}
                  icon={makeAvatarIcon(avatar, `${index + 1}. ${city}`)}
                >
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
        © OpenStreetMap contributors · 轨迹按 event_date 排序虚线连接
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
