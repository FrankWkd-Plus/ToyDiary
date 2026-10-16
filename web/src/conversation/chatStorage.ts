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

export function loadChats(): Record<string, ChatMessage[]> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY)
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
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats))
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
