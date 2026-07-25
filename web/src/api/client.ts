/**
 * API client — plan.md / docs/api.md contract.
 *
 * ## Demo persistence (current)
 * All **business data** (toys, entries, current toy, community, import/reset)
 * is saved to **browser localStorage** via `mockStore` / `communityStore`.
 * No D1 / remote REST writes for CRUD in demo mode.
 *
 * ## Kept for later
 * - Method signatures match REST (`docs/api.md` §6, `api/contracts.ts`)
 * - D1 schema stub: `web/migrations/0001_init.sql`
 * - Optional remote helper below is never used while `PERSISTENCE = 'localStorage'`
 *
 * ## Not localStorage (by design)
 * AI chat / analyze-entry / places proxies still call Pages Functions
 * (`/api/*`) — they only generate content; results are then saved locally.
 */

import type {
  CommunityComment,
  CommunityMessage,
  CommunityPost,
} from '../community/communityData'
import type {
  CreateEntryInput,
  CreateToyInput,
  Entry,
  Toy,
  TravelMapResponse,
} from '../types'
import type { ToyDairyRepository } from './contracts'
import { DB_RESOURCES, REST_PATHS } from './contracts'
import {
  communityStore,
  type CreateCommunityPostInput,
} from './communityStore'
import { mockStore } from './mockStore'

/**
 * Demo: always localStorage.
 * Flip to `'remote'` only when a real REST backend is ready AND
 * `VITE_API_BASE` is set — not for AdventureX / offline demo.
 */
export const PERSISTENCE: 'localStorage' | 'remote' = 'localStorage'

/** @deprecated use PERSISTENCE — kept so older docs/grep still match */
export const USE_MOCK = PERSISTENCE === 'localStorage'

const BASE = import.meta.env.VITE_API_BASE as string | undefined

/** Local repository implementing the DB/REST contract. */
const localRepo: ToyDairyRepository = mockStore

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) throw new Error('VITE_API_BASE not set (remote persistence)')
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

function assertLocalForDemo(op: string): void {
  if (PERSISTENCE !== 'localStorage') return
  // no-op: documents intent for call sites / future remote branch
  void op
}

export const api = {
  /** REST path table + DB resource ids (documentation / future wiring) */
  contracts: REST_PATHS,
  dbResources: DB_RESOURCES,
  persistence: PERSISTENCE,

  async listToys(): Promise<Toy[]> {
    if (PERSISTENCE === 'localStorage') return localRepo.listToys()
    return http('/toys')
  },

  async getToy(id: string): Promise<Toy> {
    if (PERSISTENCE === 'localStorage') {
      const t = await localRepo.getToy(id)
      if (!t) throw new Error('玩偶不存在')
      return t
    }
    return http(`/toys/${id}`)
  },

  async createToy(input: CreateToyInput): Promise<Toy> {
    assertLocalForDemo('createToy')
    if (PERSISTENCE === 'localStorage') return localRepo.createToy(input)
    return http('/toys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  },

  async updateToy(
    id: string,
    input: Partial<CreateToyInput>,
  ): Promise<Toy> {
    assertLocalForDemo('updateToy')
    if (PERSISTENCE === 'localStorage') return localRepo.updateToy(id, input)
    return http(`/toys/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  },

  async generateProfile(id: string): Promise<Toy> {
    assertLocalForDemo('generateProfile')
    if (PERSISTENCE === 'localStorage') return localRepo.generateProfile(id)
    return http(`/toys/${id}/generate-profile`, { method: 'POST' })
  },

  async listEntries(toyId: string): Promise<Entry[]> {
    if (PERSISTENCE === 'localStorage') return localRepo.listEntries(toyId)
    return http(`/toys/${toyId}/entries`)
  },

  async getEntry(id: string): Promise<Entry> {
    if (PERSISTENCE === 'localStorage') {
      const e = await localRepo.getEntry(id)
      if (!e) throw new Error('记录不存在')
      return e
    }
    return http(`/entries/${id}`)
  },

  async createEntry(toyId: string, input: CreateEntryInput): Promise<Entry> {
    assertLocalForDemo('createEntry')
    // Always local for demo: diary + place + imageUrl (data URL) → localStorage
    if (PERSISTENCE === 'localStorage') {
      return localRepo.createEntry(toyId, input)
    }
    const form = new FormData()
    Object.entries(input).forEach(([k, v]) => {
      if (v == null) return
      if (typeof v === 'object') form.append(k, JSON.stringify(v))
      else form.append(k, String(v))
    })
    return http(`/toys/${toyId}/entries`, { method: 'POST', body: form })
  },

  /** GET /toys/:toyId/travel-map — local derive from entries.place */
  async getTravelMap(toyId: string): Promise<TravelMapResponse> {
    if (PERSISTENCE === 'localStorage') return localRepo.getTravelMap(toyId)
    return http(`/toys/${toyId}/travel-map`)
  },

  async regenerateEntry(id: string): Promise<Entry> {
    assertLocalForDemo('regenerateEntry')
    if (PERSISTENCE === 'localStorage') return localRepo.regenerateEntry(id)
    return http(`/entries/${id}/regenerate`, { method: 'POST' })
  },

  async updateEntry(
    id: string,
    patch: Partial<
      Pick<
        Entry,
        'aiDiary' | 'title' | 'mood' | 'tags' | 'imageAnalysis' | 'userNote'
      >
    >,
  ): Promise<Entry> {
    assertLocalForDemo('updateEntry')
    if (PERSISTENCE === 'localStorage') return localRepo.updateEntry(id, patch)
    return http(`/entries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  },

  getCurrentToyId: () => localRepo.getCurrentToyId(),
  setCurrentToyId: (id: string | null) => {
    assertLocalForDemo('setCurrentToyId')
    localRepo.setCurrentToyId(id)
  },

  resetDemo: () => {
    assertLocalForDemo('resetDemo')
    localRepo.resetDemo()
    communityStore.reset()
  },

  importGrowth: (payload: {
    toys: Toy[]
    entries: Entry[]
    currentToyId?: string | null
  }) => {
    // Demo backup restore — always localStorage (never remote)
    assertLocalForDemo('importGrowth')
    return localRepo.importGrowth(payload)
  },

  // —— Community (localStorage mock; product entry redirects to conversation) ——
  communitySnapshot: () => communityStore.snapshot(),
  listCommunityPosts: (): Promise<CommunityPost[]> => communityStore.listPosts(),
  listCommunityComments: (postId?: string): Promise<CommunityComment[]> =>
    communityStore.listComments(postId),
  createCommunityPost: (input: CreateCommunityPostInput) =>
    communityStore.createPost(input),
  toggleCommunityLike: (postId: string, fromToyId: string) =>
    communityStore.toggleLike(postId, fromToyId),
  toggleCommunitySave: (postId: string, fromToyId: string) =>
    communityStore.toggleSave(postId, fromToyId),
  toggleCommunityFollow: (followeeToyId: string, followerToyId: string) =>
    communityStore.toggleFollow(followeeToyId, followerToyId),
  addCommunityComment: (input: {
    postId: string
    fromToyId: string
    body: string
    withNpcReply?: boolean
  }) => communityStore.addComment(input),
  listCommunityMessages: (toyIdA: string, toyIdB: string) =>
    communityStore.listMessages(toyIdA, toyIdB),
  sendCommunityMessage: (input: {
    fromToyId: string
    toToyId: string
    body: string
  }): Promise<CommunityMessage> => communityStore.sendMessage(input),
  markCommunityThreadRead: (readerToyId: string, peerToyId: string) =>
    communityStore.markThreadRead(readerToyId, peerToyId),
  communityUnreadCount: (toyId: string) => communityStore.unreadCount(toyId),
}
