import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BellOff,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ImagePlus,
  Mic,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import { companionDays, toyAvatar } from '../archive/archiveUtils'
import { useApp } from '../context/AppContext'
import type { Entry, Toy } from '../types'

type ChatRole = 'user' | 'toy'
type ChatMessageKind = 'text' | 'image' | 'memory'

interface ChatMessage {
  id: string
  role: ChatRole
  kind: ChatMessageKind
  text?: string
  imageUrl?: string
  entryId?: string
  createdAt: string
}

const QUICK_TOPICS = [
  '和你说说今天',
  '回忆一次旅行',
  '看看你记得什么',
  '给我一点安慰',
  '一起写日记',
] as const

const CHAT_STORAGE_KEY = 'toydairy.conversations.v1'
const EMPTY_MESSAGES: ChatMessage[] = []

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function loadChats(): Record<string, ChatMessage[]> {
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, ChatMessage[]>) : {}
  } catch {
    return {}
  }
}

function saveChats(chats: Record<string, ChatMessage[]>) {
  try {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats))
  } catch {
    // A large uploaded photo may exceed localStorage. The current session still works.
  }
}

function createOpeningMessage(toy: Toy, entries: Entry[]): ChatMessage {
  const recent = entries[0]
  const hour = new Date().getHours()
  let text = `你来啦。今天有什么想和${toy.name}说的吗？`

  if (recent?.location) {
    text = `刚刚又想起我们在${recent.location}的那一天。${recent.title ? `「${recent.title}」这个名字，我还很喜欢。` : '那段记忆还是亮晶晶的。'}今天过得怎么样？`
  } else if (hour >= 22 || hour < 6) {
    text = '这么晚还没有休息吗？不用急着把今天过得很完美，可以慢慢和我说。'
  } else if (hour < 11) {
    text = `早上好呀。${toy.name}已经醒了，今天想和你一起收藏什么？`
  }

  return {
    id: uid('opening'),
    role: 'toy',
    kind: 'text',
    text,
    createdAt: new Date().toISOString(),
  }
}

function getToyStatus(toy: Toy, entries: Entry[]) {
  const hour = new Date().getHours()
  if (hour >= 22 || hour < 6) return '换上睡衣，想听你说晚安'
  if (entries[0]?.location) return `正在回想${entries[0].location}`
  if (toy.traits.includes('活泼')) return '今天很想和你聊天'
  if (toy.traits.includes('好奇')) return '想看看你眼中的今天'
  return '安静地等你回来'
}

function getFeaturedMemory(entries: Entry[]) {
  return (
    entries.find((entry) => entry.type === 'travel' && entry.imageUrl) ??
    entries.find((entry) => entry.imageUrl) ??
    entries[0]
  )
}

function personaReply(toy: Toy, text: string, entries: Entry[]) {
  const normalized = text.trim()
  const recent = entries[0]
  const travel = getFeaturedMemory(entries) ?? recent

  if (/累|疲惫|难过|不开心|压力|烦/.test(normalized)) {
    if (toy.traits.includes('活泼')) {
      return '先把今天的大包袱放在这里吧，我替你看一会儿。等你有一点力气了，我们再慢慢往前走。'
    }
    if (toy.traits.includes('勇敢')) {
      return '今天不去很远的地方了，我们就在这里进行一次小小的休息探险。你已经做得很好啦。'
    }
    return '辛苦啦。你不需要马上振作，我会安安静静陪你待一会儿。要不要告诉我，今天最累的是哪一刻？'
  }

  if (/旅行|回忆|记得|以前|去过/.test(normalized) && travel?.location) {
    return `当然记得。我们在${travel.location}留下了「${travel.title || '一段小小的旅行'}」。我最舍不得忘记的，是那天你愿意带我一起看世界。`
  }

  if (/日记|记录|写下来|保存/.test(normalized)) {
    return '好呀。你把今天发生的事告诉我，我来帮你整理成一篇属于我们的日记；写完以后还可以再慢慢修改。'
  }

  if (/照片|晚霞|天空|看到/.test(normalized)) {
    return recent?.location
      ? `听起来像一张值得收藏的照片。会不会有一点像我们在${recent.location}看到的颜色？`
      : '我也想看看你眼中的这一刻。发给我吧，我们可以把它收藏进今天。'
  }

  if (/你好|在吗|想你|陪我/.test(normalized)) {
    return `我一直都在呀。${toy.traits.includes('活泼') ? '快把今天的新鲜事分我一点！' : '可以靠近一点，慢慢说给我听。'}`
  }

  const trait = toy.traits[0] || '温柔'
  return `我认真听到啦。作为一只${trait}的${toy.role}，我想把你刚刚说的这一刻好好接住。然后呢，还发生了什么？`
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

export function ConversationPage() {
  const navigate = useNavigate()
  const {
    currentToy,
    toys,
    entries,
    setCurrentToyId,
    showToast,
  } = useApp()
  const [messagesByToy, setMessagesByToy] =
    useState<Record<string, ChatMessage[]>>(loadChats)
  const [draft, setDraft] = useState('')
  const [toyPickerOpen, setToyPickerOpen] = useState(false)
  const [quietMode, setQuietMode] = useState(
    () => window.localStorage.getItem('toydairy.quietMode') === 'true',
  )
  const [pendingImage, setPendingImage] = useState<string>()
  const [replying, setReplying] = useState(false)
  const replyTimerRef = useRef<number | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const currentToyIndex = toys.findIndex((toy) => toy.id === currentToy?.id)
  const avatar = toyAvatar(currentToy, currentToyIndex)
  const days = currentToy ? companionDays(currentToy) : 0
  const messages = currentToy
    ? messagesByToy[currentToy.id] ?? EMPTY_MESSAGES
    : EMPTY_MESSAGES
  const latestMemory = getFeaturedMemory(entries)
  const status = currentToy ? getToyStatus(currentToy, entries) : ''

  const conversationDraft = useMemo(
    () =>
      messages
        .filter((message) => message.role === 'user' && message.text)
        .slice(-4)
        .map((message) => message.text)
        .join('\n'),
    [messages],
  )

  useEffect(() => {
    if (!currentToy) return
    setMessagesByToy((current) => {
      const existing = current[currentToy.id]
      const shouldRefreshOpening =
        entries[0]?.toyId === currentToy.id &&
        existing?.length === 1 &&
        existing[0].id.startsWith('opening_')
      if (existing?.length && !shouldRefreshOpening) return current
      const next = {
        ...current,
        [currentToy.id]: [createOpeningMessage(currentToy, entries)],
      }
      saveChats(next)
      return next
    })
  }, [currentToy, entries])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, replying, pendingImage])

  useEffect(
    () => () => {
      if (replyTimerRef.current) window.clearTimeout(replyTimerRef.current)
    },
    [],
  )

  function appendMessages(toyId: string, nextMessages: ChatMessage[]) {
    setMessagesByToy((current) => {
      const next = {
        ...current,
        [toyId]: [...(current[toyId] ?? []), ...nextMessages],
      }
      saveChats(next)
      return next
    })
  }

  function sendToyReply(userText: string, includeMemory = false) {
    if (!currentToy) return
    setReplying(true)
    if (replyTimerRef.current) window.clearTimeout(replyTimerRef.current)
    replyTimerRef.current = window.setTimeout(() => {
      const reply: ChatMessage = {
        id: uid('toy'),
        role: 'toy',
        kind: 'text',
        text: personaReply(currentToy, userText, entries),
        createdAt: new Date().toISOString(),
      }
      const memory: ChatMessage | null =
        includeMemory && latestMemory
          ? {
              id: uid('memory'),
              role: 'toy',
              kind: 'memory',
              text: latestMemory.title || '我们的共同记忆',
              imageUrl: latestMemory.imageUrl,
              entryId: latestMemory.id,
              createdAt: new Date().toISOString(),
            }
          : null
      appendMessages(currentToy.id, memory ? [reply, memory] : [reply])
      setReplying(false)
    }, 620)
  }

  function submitMessage(e?: FormEvent) {
    e?.preventDefault()
    if (!currentToy) {
      showToast('请先创建一只玩偶')
      return
    }
    const text = draft.trim()
    if (!text && !pendingImage) return

    const userMessages: ChatMessage[] = []
    if (pendingImage) {
      userMessages.push({
        id: uid('image'),
        role: 'user',
        kind: 'image',
        imageUrl: pendingImage,
        text: text || '想把这一刻给你看看',
        createdAt: new Date().toISOString(),
      })
    } else {
      userMessages.push({
        id: uid('user'),
        role: 'user',
        kind: 'text',
        text,
        createdAt: new Date().toISOString(),
      })
    }

    appendMessages(currentToy.id, userMessages)
    setDraft('')
    setPendingImage(undefined)
    sendToyReply(
      pendingImage ? `${text} 照片 晚霞` : text,
      /旅行|回忆|记得|以前|去过/.test(text),
    )
  }

  function chooseTopic(topic: (typeof QUICK_TOPICS)[number]) {
    if (!currentToy || replying) return
    if (topic === '一起写日记') {
      navigate('/compose', {
        state: {
          mode: 'text',
          ocrText:
            conversationDraft ||
            `今天想和${currentToy.name}一起，记下一件小小的事。`,
          fromConversation: true,
        },
      })
      return
    }

    appendMessages(currentToy.id, [
      {
        id: uid('topic'),
        role: 'user',
        kind: 'text',
        text: topic,
        createdAt: new Date().toISOString(),
      },
    ])
    sendToyReply(topic, topic.includes('回忆') || topic.includes('记得'))
  }

  async function onImagePicked(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('请选择一张图片')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('图片请小于 8MB')
      return
    }
    try {
      setPendingImage(await fileToDataUrl(file))
      setDraft('想把这一刻给你看看')
    } catch {
      showToast('图片读取失败，请重新选择')
    }
  }

  function toggleQuietMode() {
    const next = !quietMode
    setQuietMode(next)
    window.localStorage.setItem('toydairy.quietMode', String(next))
    showToast(next ? '已开启安静模式，不再主动提醒' : '已恢复温柔提醒')
  }

  if (!currentToy) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-8 text-center">
        <span className="text-5xl">🧸</span>
        <h1 className="mt-4 font-display text-xl text-ink">先认识一只玩偶吧</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          创建玩偶后，就可以在这里听见它的声音。
        </p>
        <Link to="/toys/new" className="btn-primary mt-6 px-5 py-2.5 text-sm">
          创建我的玩偶
        </Link>
      </div>
    )
  }

  return (
    <div className="conversation-page flex h-[calc(100dvh-5.5rem)] flex-col overflow-hidden">
      <header className="sticky top-0 z-20 border-b border-line/60 bg-white/92 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(`/archive/toys/${currentToy.id}`)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-label={`查看${currentToy.name}的身份卡`}
          >
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[1rem] border-2 border-white bg-cream shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50">
              <img
                src={avatar}
                alt={currentToy.name}
                className="h-full w-full object-cover"
              />
              <i className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-mint-deep" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <strong className="truncate font-display text-[17px] text-ink">
                  {currentToy.name}
                </strong>
                <span className="rounded-full bg-mustard-soft px-2 py-0.5 text-[9px] text-terra-deep">
                  {days} 天
                </span>
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-ink-muted">
                {quietMode ? '安静陪伴中' : status}
              </span>
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleQuietMode}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95 ${
                quietMode
                  ? 'bg-mist-soft text-matcha-deep'
                  : 'bg-cream text-ink-muted'
              }`}
              aria-label={quietMode ? '关闭安静模式' : '开启安静模式'}
              aria-pressed={quietMode}
            >
              <BellOff className="h-[17px] w-[17px]" />
            </button>
            <button
              type="button"
              onClick={() => setToyPickerOpen((open) => !open)}
              className="flex h-9 items-center gap-1 rounded-full bg-cream px-3 text-[11px] font-medium text-matcha-deep transition-transform active:scale-95"
              aria-expanded={toyPickerOpen}
            >
              切换
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${toyPickerOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>

        {toyPickerOpen && (
          <div className="absolute inset-x-3 top-[4.3rem] overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-[var(--shadow-elevated)]">
            {toys.map((toy, index) => {
              const selected = toy.id === currentToy.id
              return (
                <button
                  key={toy.id}
                  type="button"
                  onClick={() => {
                    setCurrentToyId(toy.id)
                    setToyPickerOpen(false)
                    showToast(`现在和 ${toy.name} 对话`)
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left ${
                    selected ? 'bg-mist-soft' : 'active:bg-cream'
                  }`}
                >
                  <img
                    src={toyAvatar(toy, index)}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs text-ink">
                      {toy.name}
                    </strong>
                    <span className="block truncate text-[9px] text-ink-muted">
                      {toy.traits.slice(0, 2).join(' · ')}
                    </span>
                  </span>
                  {selected && (
                    <Check className="h-4 w-4 text-matcha-deep" strokeWidth={2.5} />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-3 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mb-3 flex items-center gap-1.5 px-1 text-[9px] text-ink-muted">
          <Sparkles className="h-3 w-3 text-terra-deep" />
          {currentToy.name} 会结合性格和共同记忆回应你
        </div>

        <div className="space-y-3">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              avatar={avatar}
              toyName={currentToy.name}
            />
          ))}
          {replying && (
            <div className="flex items-end gap-2.5">
              <img
                src={avatar}
                alt=""
                className="h-7 w-7 rounded-full border border-white object-cover shadow-sm"
              />
              <div className="flex items-center gap-1 rounded-[1.1rem] rounded-bl-md bg-white px-3.5 py-3 shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50">
                <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-matcha [animation-delay:-0.2s]" />
                <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-matcha [animation-delay:-0.1s]" />
                <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-matcha" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </main>

      <section className="z-10 mt-auto shrink-0 border-t border-line/50 bg-white/94 px-3.5 pb-2.5 pt-2.5 backdrop-blur-xl">
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => chooseTopic(topic)}
              disabled={replying}
              className="shrink-0 rounded-full border border-line/70 bg-cream/80 px-3 py-1.5 text-[10px] text-ink-soft transition-transform active:scale-95 disabled:opacity-50"
            >
              {topic}
            </button>
          ))}
        </div>

        {pendingImage && (
          <div className="mb-2 flex items-center gap-2 rounded-2xl bg-mist-soft p-2">
            <img
              src={pendingImage}
              alt="待发送图片"
              className="h-12 w-12 rounded-xl object-cover"
            />
            <span className="min-w-0 flex-1 text-[10px] text-ink-soft">
              图片准备好啦，写一句想对玩偶说的话吧
            </span>
            <button
              type="button"
              onClick={() => setPendingImage(undefined)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink-muted"
              aria-label="移除待发送图片"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={submitMessage} className="flex items-end gap-2">
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-matcha-deep active:scale-95"
              aria-label="从相册选择照片"
            >
              <ImagePlus className="h-[17px] w-[17px]" />
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-matcha-deep active:scale-95"
              aria-label="拍摄照片"
            >
              <Camera className="h-[17px] w-[17px]" />
            </button>
          </div>

          <div className="flex min-h-10 min-w-0 flex-1 items-end rounded-[1.2rem] border border-line/80 bg-white px-3 py-2 shadow-[var(--shadow-warm-sm)] focus-within:border-mint-deep/70">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  submitMessage()
                }
              }}
              rows={1}
              placeholder={`和${currentToy.name}说点什么…`}
              className="max-h-20 min-h-5 min-w-0 flex-1 resize-none bg-transparent text-xs leading-5 text-ink outline-none placeholder:text-ink-muted"
            />
            <button
              type="button"
              onClick={() => showToast('按住说话功能将在下一版本开放')}
              className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center text-ink-muted"
              aria-label="语音输入"
            >
              <Mic className="h-4 w-4" />
            </button>
          </div>

          <button
            type="submit"
            disabled={(!draft.trim() && !pendingImage) || replying}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-matcha text-white shadow-[var(--shadow-glow)] transition-transform active:scale-95 disabled:bg-line disabled:shadow-none"
            aria-label="发送消息"
          >
            <Send className="h-[17px] w-[17px]" />
          </button>
        </form>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onImagePicked}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onImagePicked}
        />
      </section>
    </div>
  )
}

function MessageBubble({
  message,
  avatar,
  toyName,
}: {
  message: ChatMessage
  avatar: string
  toyName: string
}) {
  const mine = message.role === 'user'

  if (message.kind === 'memory' && message.entryId) {
    return (
      <div className="flex items-end gap-2.5">
        <img
          src={avatar}
          alt=""
          className="h-7 w-7 rounded-full border border-white object-cover shadow-sm"
        />
        <Link
          to={`/entries/${message.entryId}`}
          className="w-[76%] overflow-hidden rounded-[1.15rem] rounded-bl-md bg-white shadow-[var(--shadow-warm)] ring-1 ring-line/50 active:scale-[0.99]"
        >
          {message.imageUrl && (
            <img
              src={message.imageUrl}
              alt={message.text || '共同回忆'}
              className="h-32 w-full object-cover"
            />
          )}
          <div className="p-3">
            <span className="flex items-center gap-1 text-[9px] font-medium text-terra-deep">
              <Sparkles className="h-3 w-3" />
              来自我们的共同记忆
            </span>
            <strong className="mt-1 block text-xs text-ink">{message.text}</strong>
            <span className="mt-2 flex items-center justify-between text-[9px] text-ink-muted">
              打开这篇日志
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </Link>
      </div>
    )
  }

  return (
    <div className={`flex items-end gap-2.5 ${mine ? 'justify-end' : ''}`}>
      {!mine && (
        <img
          src={avatar}
          alt=""
          className="h-7 w-7 rounded-full border border-white object-cover shadow-sm"
        />
      )}
      <div
        className={`max-w-[76%] overflow-hidden text-xs leading-relaxed shadow-[var(--shadow-warm-sm)] ${
          mine
            ? 'rounded-[1.15rem] rounded-br-md bg-matcha px-3.5 py-2.5 text-white'
            : 'rounded-[1.15rem] rounded-bl-md bg-white px-3.5 py-2.5 text-ink-soft ring-1 ring-line/50'
        }`}
      >
        {message.kind === 'image' && message.imageUrl && (
          <img
            src={message.imageUrl}
            alt="对话图片"
            className="-mx-3.5 -mt-2.5 mb-2.5 max-h-52 w-[calc(100%+1.75rem)] object-cover"
          />
        )}
        {message.text}
      </div>
      {mine && (
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-mustard-soft text-[11px] shadow-sm"
          aria-label="我"
        >
          ☁️
        </span>
      )}
      {!mine && <span className="sr-only">{toyName}</span>}
    </div>
  )
}
