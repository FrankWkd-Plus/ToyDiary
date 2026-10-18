/**
 * Seed conversations for demo mode.
 *
 * Text-only on purpose: the demo toys' diary photos are bundled `/toy-cards/*.jpg`
 * assets, so seeding never touches the shared native media container.
 */
import {
  saveChats,
  type ChatMessage,
} from '../conversation/chatStorage'

const DEMO_CHATS: Record<string, ChatMessage[]> = {
  toy_luna_demo: [
    {
      id: 'seed_luna_1',
      role: 'toy',
      kind: 'text',
      text: '你来啦。今天想和我一起收藏什么？',
      createdAt: '2026-07-26T09:00:00.000Z',
    },
    {
      id: 'seed_luna_2',
      role: 'user',
      kind: 'text',
      text: '今天去了海边，风很大。',
      createdAt: '2026-07-26T09:03:00.000Z',
    },
    {
      id: 'seed_luna_3',
      role: 'toy',
      kind: 'text',
      text: '那一定很像我们第一次去厦门的时候。把浪声也写进日记里吧。',
      createdAt: '2026-07-26T09:04:00.000Z',
    },
  ],
  toy_bean_demo: [
    {
      id: 'seed_bean_1',
      role: 'toy',
      kind: 'text',
      text: '刚睡醒，今天要去哪里呀？',
      createdAt: '2026-07-26T08:00:00.000Z',
    },
    {
      id: 'seed_bean_2',
      role: 'user',
      kind: 'text',
      text: '先在家把零食摊开。',
      createdAt: '2026-07-26T08:05:00.000Z',
    },
  ],
}

/** Write the seeded threads into whichever namespace is active right now. */
export function resetDemoChats(): void {
  const ok = saveChats(DEMO_CHATS)
  if (!ok) throw new Error('演示对话写入失败，本机存储可能已满')
}
