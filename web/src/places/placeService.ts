/**
 * Place search / reverse geocode.
 * Prefer Pages Function `/api/places/*` (Nominatim proxy).
 * Falls back to direct Nominatim (demo) then local seed catalog.
 *
 * REPLACE_WITH_BACKEND: swap implementation when REST API is ready.
 */

import type { Place } from '../types'
import {
  placeFromNominatim,
  SEED_PLACES,
  seedPlaceForLabel,
} from './placeUtils'

const PROXY_SEARCH =
  (import.meta.env.VITE_PLACES_SEARCH_ENDPOINT as string | undefined)?.trim() ||
  '/api/places/search'
const PROXY_REVERSE =
  (import.meta.env.VITE_PLACES_REVERSE_ENDPOINT as string | undefined)?.trim() ||
  '/api/places/reverse'

const NOMINATIM_UA = 'ToyDairy/1.0 (hackathon demo; contact: local)'

export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim()
  if (!q) return []

  // 1) Pages Function proxy
  try {
    const res = await fetch(
      `${PROXY_SEARCH}?q=${encodeURIComponent(q)}&limit=8`,
      { headers: { Accept: 'application/json' } },
    )
    if (res.ok) {
      const data = (await res.json()) as { places?: Place[] } | Place[]
      const list = Array.isArray(data) ? data : data.places || []
      if (list.length) return list
    }
  } catch {
    // fall through
  }

  // 2) Direct Nominatim (browser CORS may block; best-effort for demos)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&q=${encodeURIComponent(q)}`,
      { headers: { Accept: 'application/json', 'Accept-Language': 'zh-CN,zh,en' } },
    )
    if (res.ok) {
      const rows = (await res.json()) as Array<Record<string, unknown>>
      const places = rows
        .map((row) =>
          placeFromNominatim({
            place_id: row.place_id as number,
            display_name: String(row.display_name || ''),
            lat: row.lat as string,
            lon: row.lon as string,
            address: row.address as Record<string, string>,
          }),
        )
        .filter((p): p is Place => Boolean(p))
      if (places.length) return places
    }
  } catch {
    // fall through to seed catalog
  }

  // 3) Local seed catalog (always works offline for hackathon demo)
  return searchSeedCatalog(q)
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<Place | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  try {
    const res = await fetch(
      `${PROXY_REVERSE}?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`,
      { headers: { Accept: 'application/json' } },
    )
    if (res.ok) {
      const data = (await res.json()) as { place?: Place } | Place
      const place = 'place' in data ? data.place : (data as Place)
      if (place?.displayName) return place
    }
  } catch {
    // fall through
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'zh-CN,zh,en',
          // Note: browsers cannot set User-Agent; proxy is preferred.
          'X-ToyDairy-Client': NOMINATIM_UA,
        },
      },
    )
    if (res.ok) {
      const row = (await res.json()) as Record<string, unknown>
      return placeFromNominatim({
        place_id: row.place_id as number,
        display_name: String(row.display_name || ''),
        lat: row.lat as string,
        lon: row.lon as string,
        address: row.address as Record<string, string>,
      })
    }
  } catch {
    // fall through
  }

  // Nearest seed place (very rough demo)
  let best: Place | null = null
  let bestD = Infinity
  for (const p of Object.values(SEED_PLACES)) {
    const d = (p.lat - lat) ** 2 + (p.lng - lng) ** 2
    if (d < bestD) {
      bestD = d
      best = { ...p, provider: 'seed' }
    }
  }
  return best
}

function searchSeedCatalog(q: string): Place[] {
  const lower = q.toLowerCase()
  return Object.values(SEED_PLACES)
    .filter((p) => {
      const hay = [
        p.displayName,
        p.city,
        p.region,
        p.country,
        p.poi,
        p.district,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(lower) || lower.split(/\s+/).some((t) => hay.includes(t))
    })
    .map((p) => ({ ...p }))
}

export function resolvePlaceLabel(label?: string): Place | undefined {
  return seedPlaceForLabel(label)
}
