import { demoScopedKey } from '../demo/demoMode'

export type ChatRole = 'user' | 'toy' | 'system'
export type ChatMessageKind = 'text' | 'image' | 'memory' | 'error'

export interface ChatMessage {
  id: string
  role: ChatRole
  kind: ChatMessageKind
  text?: string
  imageUrl?: string
  /** Relative Library path used to re-resolve and remove a native chat photo. */
  localImagePath?: string
  entryId?: string
  createdAt: string
}

export const CHAT_STORAGE_KEY = 'toydairy.conversations.v1'

/** Resolved per call so demo mode can swap in the `.demo` namespace. */
function activeChatKey() {
  return demoScopedKey(CHAT_STORAGE_KEY)
}

export function loadChats(): Record<string, ChatMessage[]> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(activeChatKey())
    return raw ? (JSON.parse(raw) as Record<string, ChatMessage[]>) : {}
  } catch {
    return {}
  }
}

/**
 * Returns false when the write was rejected. Callers must surface that: this
 * used to swallow `QuotaExceededError`, so an oversized chat photo looked sent
 * and was simply gone on the next launch.
 */
export function saveChats(chats: Record<string, ChatMessage[]>) {
  if (typeof window === 'undefined') return true
  try {
    window.localStorage.setItem(activeChatKey(), JSON.stringify(chats))
    return true
  } catch (error) {
    console.error('[chatStorage] localStorage save failed', error)
    return false
  }
}

/** The most recent sentence this exact toy said in its own conversation. */
export function latestToyChatLine(toyId: string, fallback: string) {
  const latest = [...(loadChats()[toyId] ?? [])]
    .reverse()
    .find(
      (message) =>
        message.role === 'toy' &&
        message.kind === 'text' &&
        Boolean(message.text?.trim()),
    )

  return (latest?.text || fallback).replace(/\s+/g, ' ').trim()
}
