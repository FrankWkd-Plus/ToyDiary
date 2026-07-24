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
  Trash2,
  X,
} from 'lucide-react'
import {
  chatToyReply,
  formatChatApiError,
  localPersonaReply,
} from '../ai/chatToyReply'
import { companionDays, toyAvatar } from '../archive/archiveUtils'
import {
  getToyVitality,
  vitalityStatusLine,
} from '../archive/toyVitality'
import {
  loadChats,
  saveChats,
  type ChatMessage,
} from '../conversation/chatStorage'
import { useApp } from '../context/AppContext'
import type { Entry, Toy } from '../types'

const QUICK_TOPICS = [
  '和你说说今天',
  '回忆一次旅行',
  '看看你记得什么',
  '给我一点安慰',
  '一起写日记',
] as const

const EMPTY_MESSAGES: ChatMessage[] = []

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
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

function getFeaturedMemory(entries: Entry[]) {
  return (
    entries.find((entry) => entry.type === 'travel' && entry.imageUrl) ??
    entries.find((entry) => entry.imageUrl) ??
    entries[0]
  )
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
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
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
  const vitality = currentToy
    ? getToyVitality(currentToy, entries)
    : null
  const status = currentToy && vitality
    ? vitalityStatusLine(vitality, currentToy.name)
    : ''

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

  async function sendToyReply(
    userText: string,
    options?: { includeMemory?: boolean; priorMessages?: ChatMessage[] },
  ) {
    if (!currentToy) return
    const includeMemory = options?.includeMemory ?? false
    const priorMessages = options?.priorMessages ?? messages

    setReplying(true)

    const history = priorMessages
      .filter(
        (m): m is ChatMessage & { role: 'user' | 'toy' } =>
          (m.kind === 'text' || m.kind === 'image') &&
          (m.role === 'user' || m.role === 'toy'),
      )
      .map((m) => ({
        role: m.role,
        text: (m.text || '').trim(),
      }))
      .filter((m) => m.text)

    let replyText = localPersonaReply(currentToy, userText, entries)
    let errorMessage: ChatMessage | null = null
    try {
      const result = await chatToyReply({
        toy: currentToy,
        message: userText,
        history,
        entries,
        quietMode,
      })
      replyText = result.reply
      if (result.apiError) {
        const errorText = formatChatApiError(result.apiError)
        errorMessage = {
          id: uid('error'),
          role: 'system',
          kind: 'error',
          text: errorText,
          createdAt: new Date().toISOString(),
        }
        // Toast is always visible even if chat history is scrolled away.
        const toastLine =
          errorText
            .split('\n')
            .map((line) => line.trim())
            .find((line) => line && !line.startsWith('AI 调用失败')) ||
          'AI 调用失败'
        showToast(toastLine.slice(0, 120))
        console.warn('[chatToyReply] API failed', result.apiError)
      }
    } catch (err) {
      const errorText = formatChatApiError({
        status: 0,
        body: err instanceof Error ? err.message : String(err),
      })
      errorMessage = {
        id: uid('error'),
        role: 'system',
        kind: 'error',
        text: errorText,
        createdAt: new Date().toISOString(),
      }
      showToast((err instanceof Error ? err.message : 'AI 调用失败').slice(0, 120))
      console.warn('[chatToyReply] request threw', err)
    }

    const reply: ChatMessage = {
      id: uid('toy'),
      role: 'toy',
      kind: 'text',
      text: replyText,
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
    // Put the API error after the toy bubble so auto-scroll lands on it.
    const outgoing = [
      reply,
      ...(errorMessage ? [errorMessage] : []),
      ...(memory ? [memory] : []),
    ]
    appendMessages(currentToy.id, outgoing)
    setReplying(false)
  }

  function submitMessage(e?: FormEvent) {
    e?.preventDefault()
    if (!currentToy) {
      showToast('请先创建一只玩偶')
      return
    }
    if (replying) return
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

    const priorMessages = [...messages, ...userMessages]
    appendMessages(currentToy.id, userMessages)
    setDraft('')
    setPendingImage(undefined)
    void sendToyReply(pendingImage ? `${text || '想把这一刻给你看看'}（附照片）` : text, {
      includeMemory: /旅行|回忆|记得|以前|去过/.test(text),
      priorMessages,
    })
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

    const topicMsg: ChatMessage = {
      id: uid('topic'),
      role: 'user',
      kind: 'text',
      text: topic,
      createdAt: new Date().toISOString(),
    }
    const priorMessages = [...messages, topicMsg]
    appendMessages(currentToy.id, [topicMsg])
    void sendToyReply(topic, {
      includeMemory: topic.includes('回忆') || topic.includes('记得'),
      priorMessages,
    })
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

  function clearConversation() {
    if (!currentToy) return
    const opening = createOpeningMessage(currentToy, entries)
    setMessagesByToy((current) => {
      const next = {
        ...current,
        [currentToy.id]: [opening],
      }
      saveChats(next)
      return next
    })
    setDraft('')
    setPendingImage(undefined)
    setReplying(false)
    setClearConfirmOpen(false)
    showToast('已删除聊天记录与上下文')
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
    <div className="conversation-page">
      <header className="relative z-20 shrink-0 border-b border-line/60 bg-white/92 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(`/archive/toys/${currentToy.id}`)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-label={`查看${currentToy.name}的身份卡`}
          >
            <span className="relative h-11 w-11 shrink-0">
              <span className="block h-full w-full overflow-hidden rounded-[1rem] border-2 border-white bg-cream shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50">
                <img
                  src={avatar}
                  alt={currentToy.name}
                  className="h-full w-full object-cover"
                />
              </span>
              <span
                className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-paper text-[11px] shadow-sm"
                aria-hidden="true"
              >
                {vitality?.emoji ?? '🟢'}
              </span>
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <strong className="truncate font-display text-[17px] text-ink">
                  {currentToy.name}
                </strong>
                <span className="rounded-full bg-mustard-soft px-2 py-0.5 text-[9px] text-terra-deep">
                  {days} 天
                </span>
                {vitality && !quietMode && (
                  <span className="hidden rounded-full bg-peach-soft px-1.5 py-0.5 text-[9px] text-rose-deep min-[360px]:inline">
                    {vitality.label}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-ink-muted">
                {quietMode ? '安静陪伴中' : status}
              </span>
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setClearConfirmOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-ink-muted transition-transform active:scale-95"
              aria-label="删除聊天记录"
              title="删除聊天记录"
            >
              <Trash2 className="h-[17px] w-[17px]" />
            </button>
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

      {clearConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6 backdrop-blur-[2px]"
          role="presentation"
          onClick={() => setClearConfirmOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="确认删除聊天记录"
            className="w-full max-w-[320px] rounded-[1.5rem] bg-white p-5 shadow-[var(--shadow-elevated)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-peach-soft text-rose-deep">
              <Trash2 className="h-5 w-5" />
            </div>
            <h2 className="mt-3 text-center font-display text-lg text-ink">
              删除聊天记录？
            </h2>
            <p className="mt-2 text-center text-xs leading-relaxed text-ink-muted">
              将清空与「{currentToy.name}」的全部对话与上下文，并重新开始一段开场白。此操作不可撤销。
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setClearConfirmOpen(false)}
                className="btn-secondary py-2.5 text-sm"
              >
                取消
              </button>
              <button
                type="button"
                onClick={clearConversation}
                className="rounded-full bg-rose-deep py-2.5 text-sm font-medium text-white transition-transform active:scale-95"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
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

  if (message.kind === 'error') {
    return (
      <div className="px-1">
        <div className="mx-auto max-w-[94%] overflow-hidden rounded-2xl border border-terra-deep/30 bg-[#fff8e8] px-3.5 py-2.5 text-[11px] leading-relaxed text-terra-deep shadow-[var(--shadow-warm-sm)]">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-terra-deep">
            <span aria-hidden="true">⚠️</span>
            API 请求返回
          </div>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-ink [scrollbar-width:thin]">
            {message.text}
          </pre>
        </div>
      </div>
    )
  }

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
