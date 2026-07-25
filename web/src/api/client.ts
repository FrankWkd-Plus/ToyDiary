/**
 * API client aligned with plan.md contract.
 * Currently backed by mockStore (localStorage).
 * When backend is ready: set VITE_API_BASE and flip USE_MOCK = false.
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
import {
  communityStore,
  type CreateCommunityPostInput,
} from './communityStore'
import { mockStore } from './mockStore'

const USE_MOCK = true
const BASE = import.meta.env.VITE_API_BASE as string | undefined

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) throw new Error('VITE_API_BASE not set')
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  async listToys(): Promise<Toy[]> {
    if (USE_MOCK) return mockStore.listToys()
    return http('/toys')
  },

  async getToy(id: string): Promise<Toy> {
    if (USE_MOCK) {
      const t = await mockStore.getToy(id)
      if (!t) throw new Error('玩偶不存在')
      return t
    }
    return http(`/toys/${id}`)
  },

  async createToy(input: CreateToyInput): Promise<Toy> {
    if (USE_MOCK) return mockStore.createToy(input)
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
    if (USE_MOCK) return mockStore.updateToy(id, input)
    return http(`/toys/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  },

  async generateProfile(id: string): Promise<Toy> {
    if (USE_MOCK) return mockStore.generateProfile(id)
    return http(`/toys/${id}/generate-profile`, { method: 'POST' })
  },

  async listEntries(toyId: string): Promise<Entry[]> {
    if (USE_MOCK) return mockStore.listEntries(toyId)
    return http(`/toys/${toyId}/entries`)
  },

  async getEntry(id: string): Promise<Entry> {
    if (USE_MOCK) {
      const e = await mockStore.getEntry(id)
      if (!e) throw new Error('记录不存在')
      return e
    }
    return http(`/entries/${id}`)
  },

  async createEntry(toyId: string, input: CreateEntryInput): Promise<Entry> {
    if (USE_MOCK) return mockStore.createEntry(toyId, input)
    const form = new FormData()
    Object.entries(input).forEach(([k, v]) => {
      if (v != null) form.append(k, String(v))
    })
    return http(`/toys/${toyId}/entries`, { method: 'POST', body: form })
  },

  /** GET /api/toys/:toyId/travel-map — mock-local for now */
  async getTravelMap(toyId: string): Promise<TravelMapResponse> {
    if (USE_MOCK) return mockStore.getTravelMap(toyId)
    return http(`/toys/${toyId}/travel-map`)
  },

  async regenerateEntry(id: string): Promise<Entry> {
    if (USE_MOCK) return mockStore.regenerateEntry(id)
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
    if (USE_MOCK) return mockStore.updateEntry(id, patch)
    return http(`/entries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  },

  getCurrentToyId: () => mockStore.getCurrentToyId(),
  setCurrentToyId: (id: string | null) => mockStore.setCurrentToyId(id),
  resetDemo: () => {
    mockStore.resetDemo()
    communityStore.reset()
  },

  importGrowth: (payload: {
    toys: Toy[]
    entries: Entry[]
    currentToyId?: string | null
  }) => {
    if (!USE_MOCK) {
      throw new Error('正式 API 暂不支持导入，请使用演示模式')
    }
    return mockStore.importGrowth(payload)
  },

  // —— Community (mock-first) ——
  communitySnapshot: () => communityStore.snapshot(),
  listCommunityPosts: (): Promise<CommunityPost[]> =>
    communityStore.listPosts(),
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
