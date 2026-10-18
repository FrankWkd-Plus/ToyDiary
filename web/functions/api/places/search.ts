/**
 * Place search proxy — GET/POST /api/places/search?q=&limit=&lang=
 *
 * Nominatim is the primary upstream (best Chinese labels) with Photon as a
 * keyless fallback. Successful lookups are cached in the Cloudflare edge
 * cache, so repeated searches do not hit upstream again.
 */

import { json, preflight } from '../../_shared/http'
import type { PagesContext } from '../../_shared/types'
import {
  getEdgeCache,
  normalizeLang,
  placeCacheKey,
  readCachedJson,
  searchPlacesUpstream,
  writeCachedJson,
  SEARCH_CACHE_SECONDS,
  type Place,
} from '../../_shared/places'

type Env = Record<string, unknown>

type SearchBody = {
  q?: unknown
  limit?: unknown
  lang?: unknown
}

type CachedSearch = {
  places: Place[]
  provider?: string
}

export async function onRequestOptions(): Promise<Response> {
  return preflight()
}

export async function onRequestGet(
  context: PagesContext<Env>,
): Promise<Response> {
  const url = new URL(context.request.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const limit = clampLimit(url.searchParams.get('limit'))
  const lang = normalizeLang(url.searchParams.get('lang'))

  if (!q) {
    return json({ places: [], error: 'q is required' }, 400)
  }
  if (q.length > 200) {
    return json({ places: [], error: 'q is too long' }, 400)
  }

  const cache = getEdgeCache()
  const cacheKey = placeCacheKey(url.origin, '/api/places/search', {
    q: q.toLowerCase(),
    limit: String(limit),
    lang,
  })

  const cached = await readCachedJson<CachedSearch>(cache, cacheKey)
  if (cached?.places?.length) {
    return json(
      { places: cached.places, provider: cached.provider, cached: true },
      200,
      { 'Cache-Control': `public, max-age=${SEARCH_CACHE_SECONDS}` },
    )
  }

  const result = await searchPlacesUpstream(q, limit, lang)

  if (result.places.length) {
    return writeCachedJson(
      cache,
      cacheKey,
      { places: result.places, provider: result.provider },
      SEARCH_CACHE_SECONDS,
      context.waitUntil,
    )
  }

  return json(
    {
      places: [],
      error: 'Place search failed',
      detail: result.failures.join(' | '),
    },
    502,
  )
}

export async function onRequestPost(
  context: PagesContext<Env>,
): Promise<Response> {
  let body: SearchBody
  try {
    body = (await context.request.json()) as SearchBody
  } catch {
    return json({ places: [], error: 'Invalid JSON' }, 400)
  }

  const url = new URL(context.request.url)
  if (body.q != null) url.searchParams.set('q', String(body.q))
  if (body.limit != null) url.searchParams.set('limit', String(body.limit))
  if (body.lang != null) url.searchParams.set('lang', String(body.lang))

  return onRequestGet({
    ...context,
    request: new Request(url, {
      method: 'GET',
      headers: context.request.headers,
    }),
  })
}

function clampLimit(raw: string | null): number {
  const value = Number(raw ?? 8)
  if (!Number.isFinite(value)) return 8
  return Math.max(1, Math.min(12, Math.trunc(value)))
}
