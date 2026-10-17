/**
 * Reverse geocode proxy — GET /api/places/reverse?lat=&lon=&lang=
 *
 * Nominatim first, Photon as a keyless fallback. Results are cached in the
 * Cloudflare edge cache (30 days) because coordinates rarely change meaning.
 */

import { json, preflight } from '../../_shared/http'
import type { PagesContext } from '../../_shared/types'
import {
  getEdgeCache,
  normalizeLang,
  placeCacheKey,
  readCachedJson,
  reversePlaceUpstream,
  writeCachedJson,
  REVERSE_CACHE_SECONDS,
  type Place,
} from '../../_shared/places'

type Env = Record<string, unknown>

type CachedReverse = {
  place: Place | null
}

export async function onRequestOptions(): Promise<Response> {
  return preflight()
}

export async function onRequestGet(
  context: PagesContext<Env>,
): Promise<Response> {
  const url = new URL(context.request.url)
  const latRaw = url.searchParams.get('lat')
  const lonRaw = url.searchParams.get('lon') ?? url.searchParams.get('lng')
  const lang = normalizeLang(url.searchParams.get('lang'))

  if (!latRaw?.trim() || !lonRaw?.trim()) {
    return json({ error: 'lat and lon are required' }, 400)
  }
  const lat = Number(latRaw)
  const lon = Number(lonRaw)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return json({ error: 'lat and lon are required' }, 400)
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return json({ error: 'lat/lon out of range' }, 400)
  }

  const cache = getEdgeCache()
  const cacheKey = placeCacheKey(url.origin, '/api/places/reverse', {
    lat: lat.toFixed(4),
    lon: lon.toFixed(4),
    lang,
  })

  const cached = await readCachedJson<CachedReverse>(cache, cacheKey)
  if (cached?.place?.displayName) {
    return json(
      { place: cached.place, cached: true },
      200,
      { 'Cache-Control': `public, max-age=${REVERSE_CACHE_SECONDS}` },
    )
  }

  const result = await reversePlaceUpstream(lat, lon, lang)

  if (result.place) {
    return writeCachedJson(
      cache,
      cacheKey,
      { place: result.place },
      REVERSE_CACHE_SECONDS,
      context.waitUntil,
    )
  }

  return json(
    {
      place: null,
      error: 'Reverse geocoding failed',
      detail: result.failures.join(' | '),
    },
    502,
  )
}
