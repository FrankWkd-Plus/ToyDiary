import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../api/client'
import { communityStore } from '../api/communityStore'
import type {
  CommunityComment,
  CommunityFollow,
  CommunityLike,
  CommunityMessage,
  CommunityPost,
  CommunitySave,
} from '../community/communityData'
import type { Entry, Toy } from '../types'

interface Toast {
  id: number
  message: string
}

interface AppContextValue {
  toys: Toy[]
  currentToy: Toy | null
  entries: Entry[]
  loading: boolean
  toast: Toast | null
  showToast: (message: string) => void
  refreshToys: () => Promise<void>
  refreshEntries: (toyId?: string) => Promise<void>
  setCurrentToyId: (id: string) => void
  resetDemo: () => Promise<void>
  importGrowthData: (payload: {
    toys: Toy[]
    entries: Entry[]
    currentToyId?: string | null
  }) => Promise<void>

  // community
  communityPosts: CommunityPost[]
  communityComments: CommunityComment[]
  communityLikes: CommunityLike[]
  communitySaves: CommunitySave[]
  communityFollows: CommunityFollow[]
  communityMessages: CommunityMessage[]
  communityUnread: number
  refreshCommunity: () => void
  publishCommunityPost: (input: {
    body: string
    imageUrl?: string
    location?: string
    tags?: string[]
    kind?: CommunityPost['kind']
  }) => Promise<CommunityPost | null>
  toggleLike: (postId: string) => Promise<void>
  toggleSave: (postId: string) => Promise<void>
  toggleFollow: (toyId: string) => Promise<void>
  addComment: (
    postId: string,
    body: string,
  ) => Promise<{ comment: CommunityComment; npcReply?: CommunityComment } | null>
  sendGreeting: (toToyId: string, body: string) => Promise<void>
  listThread: (peerToyId: string) => CommunityMessage[]
  isPostLiked: (postId: string) => boolean
  isPostSaved: (postId: string) => boolean
  isFollowingToy: (toyId: string) => boolean
  postLikeCount: (post: CommunityPost) => number
  postCommentCount: (postId: string) => number
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [toys, setToys] = useState<Toy[]>([])
  const [currentToyId, setCurrentToyIdState] = useState<string | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<Toast | null>(null)

  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([])
  const [communityComments, setCommunityComments] = useState<
    CommunityComment[]
  >([])
  const [communityLikes, setCommunityLikes] = useState<CommunityLike[]>([])
  const [communitySaves, setCommunitySaves] = useState<CommunitySave[]>([])
  const [communityFollows, setCommunityFollows] = useState<CommunityFollow[]>(
    [],
  )
  const [communityMessages, setCommunityMessages] = useState<
    CommunityMessage[]
  >([])

  const showToast = useCallback((message: string) => {
    const id = Date.now()
    setToast({ id, message })
    window.setTimeout(() => {
      setToast((t) => (t?.id === id ? null : t))
    }, 2400)
  }, [])

  const refreshCommunity = useCallback(() => {
    const snap = api.communitySnapshot()
    setCommunityPosts(snap.posts)
    setCommunityComments(snap.comments)
    setCommunityLikes(snap.likes)
    setCommunitySaves(snap.saves)
    setCommunityFollows(snap.follows)
    setCommunityMessages(snap.messages)
  }, [])

  const refreshToys = useCallback(async () => {
    // listToys is localStorage-backed; no need for artificial waiting.
    const list = await api.listToys()
    setToys(list)
    const saved = api.getCurrentToyId()
    const next =
      (saved && list.find((t) => t.id === saved)?.id) || list[0]?.id || null
    setCurrentToyIdState(next)
    if (next) api.setCurrentToyId(next)
  }, [])

  const refreshEntries = useCallback(
    async (toyId?: string) => {
      const id = toyId ?? currentToyId
      if (!id) {
        setEntries([])
        return
      }
      const list = await api.listEntries(id)
      setEntries(list)
    },
    [currentToyId],
  )

  const setCurrentToyId = useCallback((id: string) => {
    api.setCurrentToyId(id)
    setCurrentToyIdState(id)
  }, [])

  const resetDemo = useCallback(async () => {
    api.resetDemo()
    await refreshToys()
    refreshCommunity()
    // Keep entries in sync even when currentToyId is unchanged after reset.
    const id = api.getCurrentToyId()
    if (id) await refreshEntries(id)
    else setEntries([])
    showToast('已恢复演示数据')
  }, [refreshToys, refreshCommunity, refreshEntries, showToast])

  const importGrowthData = useCallback(
    async (payload: {
      toys: Toy[]
      entries: Entry[]
      currentToyId?: string | null
    }) => {
      api.importGrowth(payload)
      await refreshToys()
      const id = api.getCurrentToyId()
      if (id) await refreshEntries(id)
      else setEntries([])
      showToast(
        `已导入 ${payload.toys.length} 只玩偶 · ${payload.entries.length} 条日记`,
      )
    },
    [refreshToys, refreshEntries, showToast],
  )

  useEffect(() => {
    let cancelled = false
    // Bootstrap from localStorage as fast as possible (no min splash delay).
    ;(async () => {
      setLoading(true)
      try {
        await refreshToys()
        if (!cancelled) refreshCommunity()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshToys, refreshCommunity])

  useEffect(() => {
    if (!currentToyId) {
      setEntries([])
      return
    }
    void refreshEntries(currentToyId)
  }, [currentToyId, refreshEntries])

  const currentToy = useMemo(
    () => toys.find((t) => t.id === currentToyId) ?? null,
    [toys, currentToyId],
  )

  const communityUnread = useMemo(() => {
    if (!currentToyId) return 0
    return communityMessages.filter(
      (m) => m.toToyId === currentToyId && !m.read,
    ).length
  }, [communityMessages, currentToyId])

  const publishCommunityPost = useCallback(
    async (input: {
      body: string
      imageUrl?: string
      location?: string
      tags?: string[]
      kind?: CommunityPost['kind']
    }) => {
      if (!currentToyId) {
        showToast('请先创建一只玩偶')
        return null
      }
      const post = await api.createCommunityPost({
        toyId: currentToyId,
        ...input,
      })
      refreshCommunity()
      return post
    },
    [currentToyId, refreshCommunity, showToast],
  )

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!currentToyId) {
        showToast('请先选择一只玩偶')
        return
      }
      await api.toggleCommunityLike(postId, currentToyId)
      refreshCommunity()
    },
    [currentToyId, refreshCommunity, showToast],
  )

  const toggleSave = useCallback(
    async (postId: string) => {
      if (!currentToyId) {
        showToast('请先选择一只玩偶')
        return
      }
      const saved = await api.toggleCommunitySave(postId, currentToyId)
      refreshCommunity()
      showToast(saved ? '已收藏到玩偶灵感夹' : '已取消收藏')
    },
    [currentToyId, refreshCommunity, showToast],
  )

  const toggleFollow = useCallback(
    async (toyId: string) => {
      if (!currentToyId) {
        showToast('请先选择一只玩偶')
        return
      }
      if (toyId === currentToyId) return
      const following = await api.toggleCommunityFollow(toyId, currentToyId)
      refreshCommunity()
      showToast(following ? '已关注' : '已取消关注')
    },
    [currentToyId, refreshCommunity, showToast],
  )

  const addComment = useCallback(
    async (postId: string, body: string) => {
      if (!currentToyId) {
        showToast('请先选择一只玩偶')
        return null
      }
      const result = await api.addCommunityComment({
        postId,
        fromToyId: currentToyId,
        body,
        withNpcReply: true,
      })
      refreshCommunity()
      showToast(
        result.npcReply
          ? '评论已发送，对方也回了一句'
          : '评论已发送',
      )
      return result
    },
    [currentToyId, refreshCommunity, showToast],
  )

  const sendGreeting = useCallback(
    async (toToyId: string, body: string) => {
      if (!currentToyId) {
        showToast('请先选择一只玩偶')
        return
      }
      await api.sendCommunityMessage({
        fromToyId: currentToyId,
        toToyId,
        body,
      })
      refreshCommunity()
      showToast('打招呼已送达')
    },
    [currentToyId, refreshCommunity, showToast],
  )

  const listThread = useCallback(
    (peerToyId: string) => {
      if (!currentToyId) return []
      // Own profile "来信": all inbound messages to the current toy
      if (peerToyId === currentToyId) {
        return communityMessages
          .filter((m) => m.toToyId === currentToyId)
          .slice()
          .sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          )
      }
      return communityMessages
        .filter(
          (m) =>
            (m.fromToyId === currentToyId && m.toToyId === peerToyId) ||
            (m.fromToyId === peerToyId && m.toToyId === currentToyId),
        )
        .slice()
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )
    },
    [communityMessages, currentToyId],
  )

  const isPostLiked = useCallback(
    (postId: string) =>
      communityStore.isLiked(postId, currentToyId, communityLikes),
    [communityLikes, currentToyId],
  )

  const isPostSaved = useCallback(
    (postId: string) =>
      communityStore.isSaved(postId, currentToyId, communitySaves),
    [communitySaves, currentToyId],
  )

  const isFollowingToy = useCallback(
    (toyId: string) =>
      communityStore.isFollowing(toyId, currentToyId, communityFollows),
    [communityFollows, currentToyId],
  )

  const postLikeCount = useCallback(
    (post: CommunityPost) => communityStore.likeCount(post, communityLikes),
    [communityLikes],
  )

  const postCommentCount = useCallback(
    (postId: string) => communityStore.commentCount(postId, communityComments),
    [communityComments],
  )

  const value = useMemo(
    () => ({
      toys,
      currentToy,
      entries,
      loading,
      toast,
      showToast,
      refreshToys,
      refreshEntries,
      setCurrentToyId,
      resetDemo,
      importGrowthData,
      communityPosts,
      communityComments,
      communityLikes,
      communitySaves,
      communityFollows,
      communityMessages,
      communityUnread,
      refreshCommunity,
      publishCommunityPost,
      toggleLike,
      toggleSave,
      toggleFollow,
      addComment,
      sendGreeting,
      listThread,
      isPostLiked,
      isPostSaved,
      isFollowingToy,
      postLikeCount,
      postCommentCount,
    }),
    [
      toys,
      currentToy,
      entries,
      loading,
      toast,
      showToast,
      refreshToys,
      refreshEntries,
      setCurrentToyId,
      resetDemo,
      importGrowthData,
      communityPosts,
      communityComments,
      communityLikes,
      communitySaves,
      communityFollows,
      communityMessages,
      communityUnread,
      refreshCommunity,
      publishCommunityPost,
      toggleLike,
      toggleSave,
      toggleFollow,
      addComment,
      sendGreeting,
      listThread,
      isPostLiked,
      isPostSaved,
      isFollowingToy,
      postLikeCount,
      postCommentCount,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
