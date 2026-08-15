/**
 * Nominatim search proxy — POST/GET /api/places/search?q=
 * Avoids browser CORS and lets us attach a proper User-Agent.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: CORS })

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
  const q = url.searchParams.get('q')?.trim() || ''
  const limit = Math.min(Number(url.searchParams.get('limit') || 8), 12)
  const lang = (url.searchParams.get('lang') || 'zh').toLowerCase()
  const acceptLanguage = lang.startsWith('en')
    ? 'en,en-US;q=0.9,zh;q=0.3'
    : 'zh-CN,zh;q=0.9,en;q=0.4'
  if (!q) {
    return json({ places: [], error: 'q is required' }, 400)
  }

  try {
    const upstream = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(q)}`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Language': acceptLanguage,
          'User-Agent': 'ToyDairy/1.0 (Cloudflare Pages; hackathon demo)',
        },
      },
    )
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      return json(
        { places: [], error: `Nominatim HTTP ${upstream.status}`, detail: detail.slice(0, 400) },
        502,
      )
    }
    const rows = (await upstream.json()) as Array<Record<string, unknown>>
    const places = rows.map(mapNominatim).filter(Boolean)
    return json({ places })
  } catch (err) {
    return json(
      {
        places: [],
        error: 'Failed to reach Nominatim',
        detail: err instanceof Error ? err.message : String(err),
      },
      502,
    )
  }
}

export const onRequestPost: PagesFunction = async (context) => {
  let body: { q?: string; limit?: number } = {}
  try {
    body = (await context.request.json()) as { q?: string; limit?: number }
  } catch {
    return json({ places: [], error: 'Invalid JSON' }, 400)
  }
  const url = new URL(context.request.url)
  url.searchParams.set('q', body.q || '')
  url.searchParams.set('limit', String(body.limit || 8))
  return onRequestGet({ ...context, request: new Request(url, context.request) })
}

function mapNominatim(row: Record<string, unknown>) {
  const lat = Number(row.lat)
  const lng = Number(row.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const a = (row.address || {}) as Record<string, string>
  const city =
    a.city || a.town || a.village || a.municipality || a.county || undefined
  const region = a.state || a.province || a.region || undefined
  const district =
    a.suburb || a.district || a.city_district || a.neighbourhood || undefined
  const poi =
    a.tourism || a.attraction || a.amenity || a.building || a.road || undefined
  return {
    country: a.country,
    region,
    city,
    district,
    poi,
    displayName: String(row.display_name || ''),
    lat,
    lng,
    providerPlaceId: row.place_id != null ? String(row.place_id) : undefined,
    provider: 'nominatim' as const,
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS,
    },
  })
}
