export type ChatRole = 'user' | 'toy' | 'system'
export type ChatMessageKind = 'text' | 'image' | 'memory' | 'error'

export interface ChatMessage {
  id: string
  role: ChatRole
  kind: ChatMessageKind
  text?: string
  imageUrl?: string
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

export function saveChats(chats: Record<string, ChatMessage[]>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats))
  } catch {
    // A large uploaded photo may exceed localStorage. The current session still works.
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
