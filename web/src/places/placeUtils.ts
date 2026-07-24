import type { Place } from '../types'

/** Display helper — prefer structured place.displayName. */
export function placeLabel(
  place?: Place | null,
  fallback?: string | null,
): string {
  return place?.displayName?.trim() || fallback?.trim() || ''
}

export function placeCityKey(place: Place): string {
  return (
    place.city ||
    place.district ||
    place.region ||
    place.poi ||
    place.displayName ||
    `${place.lat.toFixed(2)},${place.lng.toFixed(2)}`
  )
}

export function uniqueCities(places: Place[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of places) {
    const key = placeCityKey(p)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

/** Build a Place from Nominatim-like address parts. */
export function placeFromNominatim(raw: {
  place_id?: number | string
  display_name?: string
  lat?: string | number
  lon?: string | number
  address?: Record<string, string>
}): Place | null {
  const lat = Number(raw.lat)
  const lng = Number(raw.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const a = raw.address || {}
  const city =
    a.city || a.town || a.village || a.municipality || a.county || undefined
  const region = a.state || a.province || a.region || undefined
  const district =
    a.suburb || a.district || a.city_district || a.neighbourhood || undefined
  const poi =
    a.tourism ||
    a.attraction ||
    a.amenity ||
    a.building ||
    a.road ||
    undefined
  const displayName =
    raw.display_name?.trim() ||
    [poi, district, city, region, a.country].filter(Boolean).join(' · ') ||
    `${lat.toFixed(4)}, ${lng.toFixed(4)}`

  return {
    country: a.country,
    region,
    city,
    district,
    poi,
    displayName,
    lat,
    lng,
    providerPlaceId:
      raw.place_id != null ? String(raw.place_id) : undefined,
    provider: 'nominatim',
  }
}

export function manualPlace(displayName: string): Place {
  // Rough China centroid fallback so map can still show a pin for free-text.
  return {
    displayName: displayName.trim(),
    lat: 31.2304,
    lng: 121.4737,
    provider: 'manual',
    city: displayName.trim(),
  }
}

/** Known demo seed coordinates for map demos without geocoding. */
export const SEED_PLACES: Record<string, Place> = {
  蓝色海湾: {
    displayName: '蓝色海湾',
    country: '中国',
    region: '海南',
    city: '三亚',
    poi: '蓝色海湾',
    lat: 18.2528,
    lng: 109.5119,
    provider: 'seed',
  },
  阳光海岸: {
    displayName: '阳光海岸',
    country: '中国',
    region: '山东',
    city: '青岛',
    poi: '阳光海岸',
    lat: 36.0671,
    lng: 120.3826,
    provider: 'seed',
  },
  森林瀑布: {
    displayName: '森林瀑布',
    country: '中国',
    region: '四川',
    city: '九寨沟',
    poi: '森林瀑布',
    lat: 33.2600,
    lng: 103.9180,
    provider: 'seed',
  },
  大理: {
    displayName: '大理 · 洱海',
    country: '中国',
    region: '云南',
    city: '大理',
    poi: '洱海',
    lat: 25.6065,
    lng: 100.2676,
    provider: 'seed',
  },
  成都: {
    displayName: '成都',
    country: '中国',
    region: '四川',
    city: '成都',
    lat: 30.5728,
    lng: 104.0668,
    provider: 'seed',
  },
  家: {
    displayName: '家',
    country: '中国',
    region: '上海',
    city: '上海',
    district: '家',
    lat: 31.2304,
    lng: 121.4737,
    provider: 'seed',
  },
  火车上: {
    displayName: '火车上',
    country: '中国',
    region: '旅途中',
    city: '旅途',
    lat: 30.0,
    lng: 114.0,
    provider: 'seed',
  },
  人民公园: {
    displayName: '人民公园',
    country: '中国',
    region: '上海',
    city: '上海',
    poi: '人民公园',
    lat: 31.2317,
    lng: 121.4733,
    provider: 'seed',
  },
  '意大利 · 多洛米蒂': {
    displayName: '意大利 · 多洛米蒂',
    country: '意大利',
    region: '南蒂罗尔',
    city: '富内斯山谷',
    poi: '多洛米蒂山脉',
    lat: 46.6426,
    lng: 11.7247,
    provider: 'seed',
  },
  '法国 · 巴黎 · 卢浮宫': {
    displayName: '法国 · 巴黎 · 卢浮宫',
    country: '法国',
    region: '法兰西岛',
    city: '巴黎',
    district: '第一区',
    poi: '卢浮宫',
    lat: 48.8606,
    lng: 2.3376,
    provider: 'seed',
  },
  京都: {
    displayName: '京都 · 清水寺',
    country: '日本',
    region: '京都府',
    city: '京都',
    poi: '清水寺',
    lat: 34.9949,
    lng: 135.7850,
    provider: 'seed',
  },
  上海武康路: {
    displayName: '上海 · 武康路',
    country: '中国',
    region: '上海',
    city: '上海',
    district: '徐汇',
    poi: '武康路',
    lat: 31.2089,
    lng: 121.4447,
    provider: 'seed',
  },
}

export function seedPlaceForLabel(label?: string): Place | undefined {
  if (!label) return undefined
  if (SEED_PLACES[label]) return { ...SEED_PLACES[label] }
  // partial match
  const hit = Object.entries(SEED_PLACES).find(
    ([k]) => label.includes(k) || k.includes(label),
  )
  return hit ? { ...hit[1] } : undefined
}
