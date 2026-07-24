import { useState } from 'react'
import { LoaderCircle, MapPin, Navigation, Search, X } from 'lucide-react'
import type { Place } from '../types'
import { reverseGeocode, searchPlaces } from '../places/placeService'
import { manualPlace } from '../places/placeUtils'

/**
 * Place picker: button-triggered Nominatim search (no per-keystroke autocomplete),
 * reverse geocode for current position, and free-text manual fallback.
 */
export function PlacePicker({
  value,
  onChange,
  required,
  label = '地点',
}: {
  value?: Place | null
  onChange: (place: Place | undefined) => void
  required?: boolean
  label?: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string>()

  async function runSearch() {
    const q = query.trim()
    if (!q) {
      setError('请输入地点关键词，再点搜索')
      return
    }
    setSearching(true)
    setError(undefined)
    try {
      const places = await searchPlaces(q)
      setResults(places)
      if (!places.length) {
        setError('没有搜到结果，可直接「使用输入文字」作为地点')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败')
    } finally {
      setSearching(false)
    }
  }

  async function locateCurrentPosition() {
    if (!navigator.geolocation) {
      setError('当前浏览器不支持定位')
      return
    }
    setLocating(true)
    setError(undefined)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 60_000,
        })
      })
      const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
      if (place) {
        onChange({ ...place, provider: place.provider || 'geolocation' })
        setQuery(place.displayName)
        setResults([])
      } else {
        setError('无法解析当前位置')
      }
    } catch {
      setError('定位失败，请检查权限或改用搜索')
    } finally {
      setLocating(false)
    }
  }

  function useManual() {
    const q = query.trim()
    if (!q) {
      setError('请先输入地点名称')
      return
    }
    onChange(manualPlace(q))
    setResults([])
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-soft">
          {label}
          {required ? (
            <span className="ml-1 text-rose-deep">*旅行必填</span>
          ) : (
            <span className="ml-1 text-ink-muted">（可选）</span>
          )}
        </span>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(undefined)
              setQuery('')
              setResults([])
            }}
            className="flex items-center gap-1 text-[10px] text-ink-muted"
          >
            <X className="h-3 w-3" />
            清除
          </button>
        )}
      </div>

      {value ? (
        <div className="flex items-start gap-2 rounded-2xl bg-mist-soft/80 px-3 py-2.5 text-xs text-matcha-deep ring-1 ring-line/50">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <strong className="block truncate text-ink">{value.displayName}</strong>
            <span className="mt-0.5 block text-[10px] text-ink-muted">
              {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
              {value.provider ? ` · ${value.provider}` : ''}
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            className="input !rounded-2xl !pl-10"
            placeholder="城市 / 景点 / 地址"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void runSearch()
              }
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => void runSearch()}
          disabled={searching}
          className="btn-secondary shrink-0 !rounded-2xl px-3 text-xs"
        >
          {searching ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          搜索
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void locateCurrentPosition()}
          disabled={locating}
          className="flex items-center gap-1 rounded-full bg-cream px-3 py-1.5 text-[10px] text-ink-soft ring-1 ring-line/60"
        >
          {locating ? (
            <LoaderCircle className="h-3 w-3 animate-spin" />
          ) : (
            <Navigation className="h-3 w-3" />
          )}
          当前位置
        </button>
        <button
          type="button"
          onClick={useManual}
          className="rounded-full bg-cream px-3 py-1.5 text-[10px] text-ink-soft ring-1 ring-line/60"
        >
          使用输入文字
        </button>
      </div>

      {error && (
        <p className="text-[10px] leading-relaxed text-terra-deep">{error}</p>
      )}

      {results.length > 0 && (
        <ul className="max-h-44 overflow-y-auto rounded-2xl border border-line/70 bg-white p-1.5 shadow-[var(--shadow-warm-sm)]">
          {results.map((place) => (
            <li key={`${place.providerPlaceId || place.displayName}-${place.lat}`}>
              <button
                type="button"
                onClick={() => {
                  onChange(place)
                  setQuery(place.displayName)
                  setResults([])
                  setError(undefined)
                }}
                className="flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left text-xs active:bg-cream"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-matcha-deep" />
                <span className="min-w-0">
                  <span className="block leading-snug text-ink">{place.displayName}</span>
                  <span className="mt-0.5 block text-[9px] text-ink-muted">
                    {[place.city, place.region, place.country].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[9px] text-ink-muted">
        地图数据 © OpenStreetMap contributors · 搜索点击按钮触发（非逐字补全）
      </p>
    </div>
  )
}
