import {
  COMMUNITY_TOYS,
  INITIAL_FOLLOWING,
  INITIAL_SAVED,
  SEED_COMMENTS,
  SEED_POSTS,
  npcReplyBody,
  type CommunityComment,
  type CommunityFollow,
  type CommunityLike,
  type CommunityMessage,
  type CommunityPost,
  type CommunityPostKind,
  type CommunitySave,
  type CommunityToy,
} from '../community/communityData'

/**
 * Community feed mock — also localStorage for demo.
 * Product entry redirects to /conversation; code kept for completeness.
 */
const STORAGE_KEY = 'toydairy.community.v1'

export interface CommunitySnapshot {
  posts: CommunityPost[]
  comments: CommunityComment[]
  likes: CommunityLike[]
  saves: CommunitySave[]
  follows: CommunityFollow[]
  messages: CommunityMessage[]
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

function delay(ms = 180) {
  return new Promise((r) => setTimeout(r, ms))
}

function seed(): CommunitySnapshot {
  const demoActor = 'toy_luna_demo'
  return {
    posts: SEED_POSTS.map((p) => ({ ...p })),
    comments: SEED_COMMENTS.map((c) => ({ ...c })),
    likes: [],
    saves: INITIAL_SAVED.map((postId) => ({
      postId,
      fromToyId: demoActor,
    })),
    follows: INITIAL_FOLLOWING.map((followeeToyId) => ({
      followerToyId: demoActor,
      followeeToyId,
    })),
    messages: [
      {
        id: 'msg_seed_welcome',
        fromToyId: 'community_mochi',
        toToyId: demoActor,
        body: '嗨！我是 Mochi，看到你也喜欢旅行日记，以后常来找我玩呀～',
        createdAt: '2026-07-22T10:00:00.000Z',
        read: false,
      },
    ],
  }
}

function load(): CommunitySnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const s = seed()
      save(s)
      return s
    }
    const parsed = JSON.parse(raw) as CommunitySnapshot
    if (!parsed.posts?.length) {
      const s = seed()
      save(s)
      return s
    }
    return {
      posts: parsed.posts ?? [],
      comments: parsed.comments ?? [],
      likes: parsed.likes ?? [],
      saves: parsed.saves ?? [],
      follows: parsed.follows ?? [],
      messages: parsed.messages ?? [],
    }
  } catch {
    const s = seed()
    save(s)
    return s
  }
}

function save(data: CommunitySnapshot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.error('[communityStore] localStorage save failed', err)
    throw new Error('本机存储已满，社区数据无法保存')
  }
}

function sortPosts(posts: CommunityPost[]) {
  return [...posts].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  )
}

export interface CreateCommunityPostInput {
  toyId: string
  body: string
  imageUrl?: string
  location?: string
  tags?: string[]
  kind?: CommunityPostKind
}

export const communityStore = {
  snapshot(): CommunitySnapshot {
    const data = load()
    return {
      posts: sortPosts(data.posts),
      comments: [...data.comments].sort((a, b) =>
        a.createdAt < b.createdAt ? -1 : 1,
      ),
      likes: [...data.likes],
      saves: [...data.saves],
      follows: [...data.follows],
      messages: [...data.messages].sort((a, b) =>
        a.createdAt < b.createdAt ? -1 : 1,
      ),
    }
  },

  async listPosts(): Promise<CommunityPost[]> {
    await delay()
    return sortPosts(load().posts)
  },

  async listComments(postId?: string): Promise<CommunityComment[]> {
    await delay()
    const list = load().comments
    const filtered = postId ? list.filter((c) => c.postId === postId) : list
    return filtered.sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
    )
  },

  async createPost(input: CreateCommunityPostInput): Promise<CommunityPost> {
    await delay(320)
    const data = load()
    const post: CommunityPost = {
      id: uid('post'),
      toyId: input.toyId,
      body: input.body,
      imageUrl: input.imageUrl,
      location: input.location,
      tags: input.tags?.length ? input.tags : ['玩偶日常'],
      createdAt: new Date().toISOString(),
      baseLikes: 0,
      kind: input.kind || 'daily',
    }
    data.posts.unshift(post)
    save(data)
    return post
  },

  async toggleLike(postId: string, fromToyId: string): Promise<boolean> {
    await delay(120)
    const data = load()
    const idx = data.likes.findIndex(
      (l) => l.postId === postId && l.fromToyId === fromToyId,
    )
    if (idx >= 0) {
      data.likes.splice(idx, 1)
      save(data)
      return false
    }
    data.likes.push({ postId, fromToyId })
    save(data)
    return true
  },

  async toggleSave(postId: string, fromToyId: string): Promise<boolean> {
    await delay(120)
    const data = load()
    const idx = data.saves.findIndex(
      (s) => s.postId === postId && s.fromToyId === fromToyId,
    )
    if (idx >= 0) {
      data.saves.splice(idx, 1)
      save(data)
      return false
    }
    data.saves.push({ postId, fromToyId })
    save(data)
    return true
  },

  async toggleFollow(
    followeeToyId: string,
    followerToyId: string,
  ): Promise<boolean> {
    await delay(140)
    if (followeeToyId === followerToyId) return false
    const data = load()
    const idx = data.follows.findIndex(
      (f) =>
        f.followeeToyId === followeeToyId && f.followerToyId === followerToyId,
    )
    if (idx >= 0) {
      data.follows.splice(idx, 1)
      save(data)
      return false
    }
    data.follows.push({ followerToyId, followeeToyId })
    save(data)
    return true
  },

  async addComment(input: {
    postId: string
    fromToyId: string
    body: string
    withNpcReply?: boolean
  }): Promise<{ comment: CommunityComment; npcReply?: CommunityComment }> {
    await delay(220)
    const data = load()
    const post = data.posts.find((p) => p.id === input.postId)
    if (!post) throw new Error('动态不存在')
    const body = input.body.trim()
    if (!body) throw new Error('评论不能为空')

    const comment: CommunityComment = {
      id: uid('cmt'),
      postId: input.postId,
      fromToyId: input.fromToyId,
      body,
      createdAt: new Date().toISOString(),
    }
    data.comments.push(comment)

    let npcReply: CommunityComment | undefined
    if (
      input.withNpcReply &&
      post.toyId !== input.fromToyId &&
      COMMUNITY_TOYS.some((t) => t.id === post.toyId)
    ) {
      npcReply = {
        id: uid('cmt'),
        postId: input.postId,
        fromToyId: post.toyId,
        body: npcReplyBody(post.location),
        createdAt: new Date(Date.now() + 400).toISOString(),
      }
      data.comments.push(npcReply)
    }

    save(data)
    return { comment, npcReply }
  },

  async listMessages(toyIdA: string, toyIdB: string): Promise<CommunityMessage[]> {
    await delay()
    return load()
      .messages.filter(
        (m) =>
          (m.fromToyId === toyIdA && m.toToyId === toyIdB) ||
          (m.fromToyId === toyIdB && m.toToyId === toyIdA),
      )
      .sort((a, b) =>
        a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
      )
  },

  async sendMessage(input: {
    fromToyId: string
    toToyId: string
    body: string
  }): Promise<CommunityMessage> {
    await delay(200)
    if (input.fromToyId === input.toToyId) {
      throw new Error('不能给自己发消息')
    }
    const body = input.body.trim()
    if (!body) throw new Error('消息不能为空')
    const data = load()
    const message: CommunityMessage = {
      id: uid('msg'),
      fromToyId: input.fromToyId,
      toToyId: input.toToyId,
      body,
      createdAt: new Date().toISOString(),
      read: false,
    }
    data.messages.push(message)

    // NPC auto-reply for community toys
    if (COMMUNITY_TOYS.some((t) => t.id === input.toToyId)) {
      const reply: CommunityMessage = {
        id: uid('msg'),
        fromToyId: input.toToyId,
        toToyId: input.fromToyId,
        body: pickNpcDmReply(input.toToyId, body),
        createdAt: new Date(Date.now() + 500).toISOString(),
        read: false,
      }
      data.messages.push(reply)
    }

    save(data)
    return message
  },

  async markThreadRead(readerToyId: string, peerToyId: string) {
    const data = load()
    let changed = false
    data.messages.forEach((m) => {
      if (
        m.toToyId === readerToyId &&
        m.fromToyId === peerToyId &&
        !m.read
      ) {
        m.read = true
        changed = true
      }
    })
    if (changed) save(data)
  },

  async unreadCount(toyId: string): Promise<number> {
    await delay(80)
    return load().messages.filter((m) => m.toToyId === toyId && !m.read).length
  },

  likeCount(post: CommunityPost, likes: CommunityLike[]) {
    return post.baseLikes + likes.filter((l) => l.postId === post.id).length
  },

  commentCount(postId: string, comments: CommunityComment[]) {
    return comments.filter((c) => c.postId === postId).length
  },

  isLiked(postId: string, fromToyId: string | null, likes: CommunityLike[]) {
    if (!fromToyId) return false
    return likes.some((l) => l.postId === postId && l.fromToyId === fromToyId)
  },

  isSaved(postId: string, fromToyId: string | null, saves: CommunitySave[]) {
    if (!fromToyId) return false
    return saves.some((s) => s.postId === postId && s.fromToyId === fromToyId)
  },

  isFollowing(
    followeeToyId: string,
    followerToyId: string | null,
    follows: CommunityFollow[],
  ) {
    if (!followerToyId) return false
    return follows.some(
      (f) =>
        f.followeeToyId === followeeToyId && f.followerToyId === followerToyId,
    )
  },

  followerCount(toyId: string, follows: CommunityFollow[], base: number) {
    const delta = follows.filter((f) => f.followeeToyId === toyId).length
    // seed follows already include demo actor; don't double-count base
    return base + Math.max(0, delta - (base > 0 ? 0 : 0))
  },

  listCommunityToys(): CommunityToy[] {
    return COMMUNITY_TOYS
  },

  reset() {
    localStorage.removeItem(STORAGE_KEY)
    return seed()
  },
}

function pickNpcDmReply(toToyId: string, incoming: string): string {
  const toy = COMMUNITY_TOYS.find((t) => t.id === toToyId)
  const name = toy?.name || '我'
  if (/你好|嗨|哈喽|hello/i.test(incoming)) {
    return `嗨嗨！我是${name}，很高兴认识你～今天想一起聊旅行还是日常呀？`
  }
  if (/旅行|海边|雪|樱花|书店/.test(incoming)) {
    return `说到这个我就来劲了！${name}正好也收藏了很多路上的小故事，下次交换日记吧。`
  }
  return `收到啦！${name}会把你的话好好放在口袋里。有空再来找我玩～`
}
