/**
 * REST + Database contract (plan.md + docs/api.md + docs/wiki/13-database.md).
 *
 * ## Two layers (both are first-class)
 * 1. **Database design** — D1 tables, row types, REST paths, R2 keys (this file + migrations).
 * 2. **Demo runtime** — `api/client.ts` uses `PERSISTENCE = 'localStorage'`;
 *    `mockStore` implements `ToyDairyRepository` against key `toydairy.mock.v3`.
 *
 * UI always calls `api.*` / Repository methods. Never delete this contract for demos.
 */

import type {
  CreateEntryInput,
  CreateToyInput,
  Entry,
  Place,
  Toy,
  TravelMapResponse,
} from '../types'

// ── Cloudflare resource names (also in wrangler.jsonc) ─────────────────────

export const DB_RESOURCES = {
  d1: {
    binding: 'DB',
    databaseName: 'toydairy-db',
    databaseId: '6ccd35b5-c08a-4eea-9e10-4a04dc577e99',
  },
  kv: {
    binding: 'TOYDAIRY_KV',
    id: 'f7455bde32684c789bc19a9e6eb01c63',
  },
  r2: {
    binding: 'MEDIA',
    bucket: 'toydairy-media',
  },
} as const

/** Demo “database” key — JSON dump of toys + entries + currentToyId */
export const DEMO_DB_STORAGE_KEY = 'toydairy.mock.v3'

// ── REST paths (HTTP surface of the database) ──────────────────────────────

/** Suggested HTTP paths (future backend). Keep in sync with docs/api.md §6. */
export const REST_PATHS = {
  listToys: 'GET /toys',
  getToy: 'GET /toys/:id',
  createToy: 'POST /toys',
  generateProfile: 'POST /toys/:id/generate-profile',
  listEntries: 'GET /toys/:toyId/entries',
  createEntry: 'POST /toys/:toyId/entries',
  getEntry: 'GET /entries/:id',
  updateEntry: 'PATCH /entries/:id',
  regenerateEntry: 'POST /entries/:id/regenerate',
  travelMap: 'GET /toys/:toyId/travel-map',
} as const

// ── Repository (domain API over the database) ──────────────────────────────

/**
 * Data-layer interface shared by:
 * - localStorage demo store (`mockStore`)
 * - future remote / D1-backed client
 *
 * Method names mirror REST_PATHS.
 */
export interface ToyDairyRepository {
  listToys(): Promise<Toy[]>
  getToy(id: string): Promise<Toy | undefined>
  createToy(input: CreateToyInput): Promise<Toy>
  generateProfile(id: string): Promise<Toy>

  listEntries(toyId: string): Promise<Entry[]>
  getEntry(id: string): Promise<Entry | undefined>
  createEntry(toyId: string, input: CreateEntryInput): Promise<Entry>
  updateEntry(
    id: string,
    patch: Partial<
      Pick<
        Entry,
        'aiDiary' | 'title' | 'mood' | 'tags' | 'imageAnalysis' | 'userNote'
      >
    >,
  ): Promise<Entry>
  regenerateEntry(id: string): Promise<Entry>
  getTravelMap(toyId: string): Promise<TravelMapResponse>

  getCurrentToyId(): string | null
  setCurrentToyId(id: string | null): void
  resetDemo(): unknown
  importGrowth(payload: {
    toys: Toy[]
    entries: Entry[]
    currentToyId?: string | null
  }): unknown
}

// ── D1 row shapes (snake_case columns) ─────────────────────────────────────

/** `toys` table row */
export interface ToyRow {
  id: string
  name: string
  birth_date: string
  birth_place: string
  role: string
  /** JSON string[] */
  traits: string
  zodiac: string | null
  bio: string | null
  monologue: string | null
  /** R2 URL in production; data URL only in demo local dump */
  avatar_url: string | null
  created_at: string
}

/** `entries` table row */
export interface EntryRow {
  id: string
  toy_id: string
  type: string
  date: string
  location: string | null
  /** JSON Place */
  place: string | null
  title: string | null
  /** 我的视角 */
  user_note: string | null
  mood: string | null
  image_url: string | null
  /** 玩偶视角 */
  ai_diary: string | null
  /** JSON string[] */
  tags: string | null
  image_analysis: string | null
  created_at: string
}

/** Domain ↔ D1 column map (for implementers / docs). */
export const DOMAIN_TO_DB = {
  toy: {
    birthDate: 'birth_date',
    birthPlace: 'birth_place',
    avatarUrl: 'avatar_url',
    createdAt: 'created_at',
  },
  entry: {
    toyId: 'toy_id',
    userNote: 'user_note',
    imageUrl: 'image_url',
    aiDiary: 'ai_diary',
    imageAnalysis: 'image_analysis',
    createdAt: 'created_at',
  },
} as const

// ── R2 object keys ─────────────────────────────────────────────────────────

export const R2_KEY = {
  avatar: (userId: string, toyId: string, uuid: string) =>
    `toys/${userId}/${toyId}/avatar/${uuid}.jpg`,
  entryImage: (
    userId: string,
    toyId: string,
    entryId: string,
    uuid: string,
  ) => `entries/${userId}/${toyId}/${entryId}/${uuid}.jpg`,
} as const

// ── Mappers (ready for D1; demo may use domain objects directly) ───────────

export function toyToRow(toy: Toy): ToyRow {
  return {
    id: toy.id,
    name: toy.name,
    birth_date: toy.birthDate,
    birth_place: toy.birthPlace,
    role: toy.role,
    traits: JSON.stringify(toy.traits ?? []),
    zodiac: toy.zodiac ?? null,
    bio: toy.bio ?? null,
    monologue: toy.monologue ?? null,
    avatar_url: toy.avatarUrl ?? null,
    created_at: toy.createdAt,
  }
}

export function rowToToy(row: ToyRow): Toy {
  let traits: string[] = []
  try {
    const parsed = JSON.parse(row.traits) as unknown
    if (Array.isArray(parsed)) traits = parsed.map(String)
  } catch {
    traits = []
  }
  return {
    id: row.id,
    name: row.name,
    birthDate: row.birth_date,
    birthPlace: row.birth_place,
    role: row.role,
    traits,
    zodiac: row.zodiac ?? undefined,
    bio: row.bio ?? undefined,
    monologue: row.monologue ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: row.created_at,
  }
}

export function entryToRow(entry: Entry): EntryRow {
  return {
    id: entry.id,
    toy_id: entry.toyId,
    type: entry.type,
    date: entry.date,
    location: entry.location ?? null,
    place: entry.place ? JSON.stringify(entry.place) : null,
    title: entry.title ?? null,
    user_note: entry.userNote ?? null,
    mood: entry.mood ?? null,
    image_url: entry.imageUrl ?? null,
    ai_diary: entry.aiDiary ?? null,
    tags: entry.tags ? JSON.stringify(entry.tags) : null,
    image_analysis: entry.imageAnalysis ?? null,
    created_at: entry.createdAt,
  }
}

export function rowToEntry(row: EntryRow): Entry {
  let place: Place | undefined
  if (row.place) {
    try {
      place = JSON.parse(row.place) as Place
    } catch {
      place = undefined
    }
  }
  let tags: string[] | undefined
  if (row.tags) {
    try {
      const parsed = JSON.parse(row.tags) as unknown
      if (Array.isArray(parsed)) tags = parsed.map(String)
    } catch {
      tags = undefined
    }
  }
  return {
    id: row.id,
    toyId: row.toy_id,
    type: row.type as Entry['type'],
    date: row.date,
    location: row.location ?? undefined,
    place,
    title: row.title ?? undefined,
    userNote: row.user_note ?? undefined,
    mood: row.mood ?? undefined,
    imageUrl: row.image_url ?? undefined,
    aiDiary: row.ai_diary ?? undefined,
    tags,
    imageAnalysis: row.image_analysis ?? undefined,
    createdAt: row.created_at,
  }
}

export type {
  Place,
  Toy,
  Entry,
  CreateToyInput,
  CreateEntryInput,
  TravelMapResponse,
}
