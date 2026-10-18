/**
 * Place lookup upstreams + edge cache.
 *
 * There is no Cloudflare-hosted geocoder, so this stays a thin, keyless proxy:
 *   - Nominatim (OSM) primary — best Chinese labels, strict 1 req/s policy
 *   - Photon (Komoot, OSM-based) fallback — different infra, still keyless
 *
 * Both are cached in the Cloudflare edge cache (per colo, free) so repeated
 * searches never hit upstream again. Nominatim calls inside one isolate are
 * serialized to respect its usage policy.
 */

import { errorText, json } from './http'

export type PlaceProvider = 'nominatim' | 'photon'

export type Place = {
  country?: string
  region?: string
  city?: string
  district?: string
  poi?: string
  displayName: string
  lat: number
  lng: number
  providerPlaceId?: string
  provider: PlaceProvider
}

export type PlaceLookupResult = {
  places: Place[]
  provider?: PlaceProvider
  failures: string[]
}

export type ReverseLookupResult = {
  place: Place | null
  failures: string[]
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const PHOTON_BASE = 'https://photon.komoot.io'
const USER_AGENT = 'ToyDiary/1.0 (Cloudflare Pages; https://toydiary.pages.dev)'

export const SEARCH_CACHE_SECONDS = 60 * 60 * 24 * 7
export const REVERSE_CACHE_SECONDS = 60 * 60 * 24 * 30

export function normalizeLang(raw: string | null): 'zh' | 'en' {
  return (raw ?? '').toLowerCase().startsWith('en') ? 'en' : 'zh'
}

export function acceptLanguageFor(lang: 'zh' | 'en'): string {
  return lang === 'en'
    ? 'en,en-US;q=0.9,zh;q=0.3'
    : 'zh-CN,zh;q=0.9,en;q=0.4'
}

// ---------------------------------------------------------------- upstreams

let nominatimChain: Promise<unknown> = Promise.resolve()
let lastNominatimAt = 0

/** Serialize Nominatim requests per isolate and keep ~1.1s between calls. */
function callNominatim(
  url: string,
  acceptLanguage: string,
  timeoutMs = 8000,
): Promise<Response> {
  const task = async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastNominatimAt))
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait))
    }
    lastNominatimAt = Date.now()

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': acceptLanguage,
          'User-Agent': USER_AGENT,
        },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  const pending = nominatimChain.then(task, task)
  nominatimChain = pending.catch(() => undefined)
  return pending
}

async function callPhoton(
  url: string,
  acceptLanguage: string,
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': acceptLanguage,
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function searchPlacesUpstream(
  query: string,
  limit: number,
  lang: 'zh' | 'en',
): Promise<PlaceLookupResult> {
  const acceptLanguage = acceptLanguageFor(lang)
  const failures: string[] = []

  try {
    const url =
      `${NOMINATIM_BASE}/search?format=jsonv2&addressdetails=1` +
      `&limit=${limit}&q=${encodeURIComponent(query)}`
    const res = await callNominatim(url, acceptLanguage)
    const body = await res.text()
    if (!res.ok) {
      failures.push(`nominatim HTTP ${res.status}: ${body.slice(0, 200)}`)
    } else {
      const rows = JSON.parse(body) as Array<Record<string, unknown>>
      const places = rows
        .map((row) => mapNominatimRow(row))
        .filter((place): place is Place => Boolean(place))
      if (places.length) return { places, provider: 'nominatim', failures }
      failures.push('nominatim returned no results')
    }
  } catch (err) {
    failures.push(`nominatim: ${errorText(err)}`)
  }

  try {
    // Photon only ships de/en/fr/it label translations; omit `lang` for zh so
    // it returns the local (Chinese) names instead of English ones.
    const langParam = lang === 'en' ? '&lang=en' : ''
    const url =
      `${PHOTON_BASE}/api/?q=${encodeURIComponent(query)}` +
      `&limit=${limit}${langParam}`
    const res = await callPhoton(url, acceptLanguage)
    const body = await res.text()
    if (!res.ok) {
      failures.push(`photon HTTP ${res.status}: ${body.slice(0, 200)}`)
    } else {
      const parsed = JSON.parse(body) as { features?: unknown }
      const features = Array.isArray(parsed.features) ? parsed.features : []
      const places = features
        .map((feature) => mapPhotonFeature(feature))
        .filter((place): place is Place => Boolean(place))
      if (places.length) return { places, provider: 'photon', failures }
      failures.push('photon returned no results')
    }
  } catch (err) {
    failures.push(`photon: ${errorText(err)}`)
  }

  return { places: [], failures }
}

export async function reversePlaceUpstream(
  lat: number,
  lng: number,
  lang: 'zh' | 'en',
): Promise<ReverseLookupResult> {
  const acceptLanguage = acceptLanguageFor(lang)
  const failures: string[] = []

  try {
    const url =
      `${NOMINATIM_BASE}/reverse?format=jsonv2&addressdetails=1` +
      `&lat=${lat}&lon=${lng}`
    const res = await callNominatim(url, acceptLanguage)
    const body = await res.text()
    if (!res.ok) {
      failures.push(`nominatim HTTP ${res.status}: ${body.slice(0, 200)}`)
    } else {
      const row = JSON.parse(body) as Record<string, unknown>
      const place = mapNominatimRow(row, lat, lng)
      if (place?.displayName) return { place, failures }
      failures.push('nominatim returned no address')
    }
  } catch (err) {
    failures.push(`nominatim: ${errorText(err)}`)
  }

  try {
    const langParam = lang === 'en' ? '&lang=en' : ''
    const url = `${PHOTON_BASE}/reverse?lat=${lat}&lon=${lng}${langParam}`
    const res = await callPhoton(url, acceptLanguage)
    const body = await res.text()
    if (!res.ok) {
      failures.push(`photon HTTP ${res.status}: ${body.slice(0, 200)}`)
    } else {
      const parsed = JSON.parse(body) as { features?: unknown }
      const features = Array.isArray(parsed.features) ? parsed.features : []
      for (const feature of features) {
        const place = mapPhotonFeature(feature)
        if (place?.displayName) return { place, failures }
      }
      failures.push('photon returned no address')
    }
  } catch (err) {
    failures.push(`photon: ${errorText(err)}`)
  }

  return { place: null, failures }
}

// ---------------------------------------------------------------- mapping

export function mapNominatimRow(
  row: Record<string, unknown>,
  fallbackLat?: number,
  fallbackLng?: number,
): Place | null {
  const lat = firstFinite(row.lat, fallbackLat)
  const lng = firstFinite(row.lon, fallbackLng)
  if (lat === undefined || lng === undefined) return null

  const address =
    row.address && typeof row.address === 'object'
      ? (row.address as Record<string, unknown>)
      : {}
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = address[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return undefined
  }

  const city = pick('city', 'town', 'village', 'municipality', 'county')
  const region = pick('state', 'province', 'region')
  const district = pick('suburb', 'district', 'city_district', 'neighbourhood')
  const poi = pick('tourism', 'attraction', 'amenity', 'building', 'road')

  return {
    country: pick('country'),
    region,
    city,
    district,
    poi,
    displayName: compactDisplayName(
      poi,
      district,
      city,
      region,
      row.display_name,
    ),
    lat,
    lng,
    providerPlaceId:
      row.place_id != null ? String(row.place_id) : undefined,
    provider: 'nominatim',
  }
}

export function mapPhotonFeature(feature: unknown): Place | null {
  if (!feature || typeof feature !== 'object') return null
  const geo = feature as {
    geometry?: { coordinates?: unknown }
    properties?: Record<string, unknown>
  }

  const coords = geo.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) return null
  const lng = Number(coords[0])
  const lat = Number(coords[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const props = geo.properties ?? {}
  const str = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined

  const country = str(props.country)
  const region = str(props.state)
  const city =
    str(props.city) ?? str(props.town) ?? str(props.village) ?? str(props.county)
  const district =
    str(props.district) ?? str(props.locality) ?? str(props.suburb)
  const poi = str(props.name) ?? str(props.street)
  const displayName = compactDisplayName(
    poi,
    district,
    city,
    region,
    props.name ?? props.street,
  )
  if (!displayName) return null

  return {
    country,
    region,
    city,
    district,
    poi,
    displayName,
    lat,
    lng,
    providerPlaceId: props.osm_id != null ? String(props.osm_id) : undefined,
    provider: 'photon',
  }
}

/**
 * Build a compact 3-level display name: "POI · 区 · 市".
 * Nominatim's raw display_name is a full mailing address (house numbers,
 * postcode like "100193") — too specific for a diary card.
 * NOTE: keep in sync with web/src/places/placeUtils.ts placeFromNominatim.
 */
export function compactDisplayName(
  poi?: string,
  district?: string,
  city?: string,
  region?: string,
  raw?: unknown,
): string {
  const seen = new Set<string>()
  const parts = [poi, district, city].filter((part): part is string => {
    if (!part || seen.has(part)) return false
    seen.add(part)
    return true
  })
  if (parts.length) return parts.join(' · ')
  if (region) return region
  return String(raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !/^\d{4,6}$/.test(part))
    .slice(0, 3)
    .join(' · ')
}

function firstFinite(...values: unknown[]): number | undefined {
  for (const value of values) {
    const num = Number(value)
    if (Number.isFinite(num)) return num
  }
  return undefined
}

// ---------------------------------------------------------------- edge cache

type EdgeCache = {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

export function getEdgeCache(): EdgeCache | null {
  try {
    const storage = (globalThis as { caches?: { default?: EdgeCache } }).caches
    return storage?.default ?? null
  } catch {
    return null
  }
}

export function placeCacheKey(
  origin: string,
  path: string,
  params: Record<string, string>,
): string {
  const url = new URL(path, origin)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

export async function readCachedJson<T>(
  cache: EdgeCache | null,
  keyUrl: string,
): Promise<T | null> {
  if (!cache) return null
  try {
    const hit = await cache.match(new Request(keyUrl, { method: 'GET' }))
    if (!hit) return null
    return (await hit.json()) as T
  } catch {
    return null
  }
}

export function writeCachedJson(
  cache: EdgeCache | null,
  keyUrl: string,
  data: unknown,
  maxAgeSeconds: number,
  waitUntil?: (promise: Promise<unknown>) => void,
): Response {
  const response = json(data, 200, {
    'Cache-Control': `public, max-age=${maxAgeSeconds}`,
  })

  if (cache) {
    const put = () =>
      cache
        .put(new Request(keyUrl, { method: 'GET' }), response.clone())
        .catch(() => undefined)
    try {
      if (waitUntil) waitUntil(put())
      else void put()
    } catch {
      // Edge cache is an optimization; never fail the request over it.
    }
  }

  return response
}
