/**
 * Nominatim reverse geocode proxy — GET /api/places/reverse?lat=&lon=
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: CORS })

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
  const lat = Number(url.searchParams.get('lat'))
  const lon = Number(url.searchParams.get('lon') || url.searchParams.get('lng'))
  const lang = (url.searchParams.get('lang') || 'zh').toLowerCase()
  const acceptLanguage = lang.startsWith('en')
    ? 'en,en-US;q=0.9,zh;q=0.3'
    : 'zh-CN,zh;q=0.9,en;q=0.4'
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return json({ error: 'lat and lon are required' }, 400)
  }

  try {
    const upstream = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lon}`,
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
        { error: `Nominatim HTTP ${upstream.status}`, detail: detail.slice(0, 400) },
        502,
      )
    }
    const row = (await upstream.json()) as Record<string, unknown>
    const a = (row.address || {}) as Record<string, string>
    const city =
      a.city || a.town || a.village || a.municipality || a.county || undefined
    const region = a.state || a.province || a.region || undefined
    const district =
      a.suburb || a.district || a.city_district || a.neighbourhood || undefined
    const poi =
      a.tourism || a.attraction || a.amenity || a.building || a.road || undefined
    const place = {
      country: a.country,
      region,
      city,
      district,
      poi,
      displayName: String(row.display_name || ''),
      lat: Number(row.lat ?? lat),
      lng: Number(row.lon ?? lon),
      providerPlaceId: row.place_id != null ? String(row.place_id) : undefined,
      provider: 'nominatim' as const,
    }
    return json({ place })
  } catch (err) {
    return json(
      {
        error: 'Failed to reach Nominatim',
        detail: err instanceof Error ? err.message : String(err),
      },
      502,
    )
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
