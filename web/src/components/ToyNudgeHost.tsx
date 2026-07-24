/**
 * In-app proactive toy nudges (demo stand-in for push).
 * Respects prefs.toyReminders / diaryPush and quietMode.
 */
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MessageCircle, X } from 'lucide-react'
import { toyAvatar } from '../archive/archiveUtils'
import { getToyVitality } from '../archive/toyVitality'
import { useAuth } from '../auth/AuthContext'
import { useApp } from '../context/AppContext'

const LAST_NUDGE_KEY = 'toydairy.nudge.lastAt'
/** First poke after app shell is ready (demo-friendly). */
const FIRST_DELAY_MS = 28_000
const INTERVAL_MS = 4 * 60_000
const MIN_GAP_MS = 2 * 60_000

type NudgeKind = 'miss' | 'diary' | 'travel' | 'energy' | 'night' | 'window'

interface NudgePayload {
  id: string
  kind: NudgeKind
  text: string
  cta: string
  to: string
}

function loadLastAt() {
  try {
    const raw = localStorage.getItem(LAST_NUDGE_KEY)
    return raw ? Number(raw) : 0
  } catch {
    return 0
  }
}

function saveLastAt(ts: number) {
  try {
    localStorage.setItem(LAST_NUDGE_KEY, String(ts))
  } catch {
    /* ignore */
  }
}

function buildNudgePool(
  name: string,
  diaryPush: boolean,
  vitalityLine: string,
  energy: number,
  hour: number,
  hasTravel: boolean,
): NudgePayload[] {
  const pool: NudgePayload[] = [
    {
      id: 'miss',
      kind: 'miss',
      text: `【${name}】想你啦～口袋里有点空，你在忙吗？`,
      cta: '去聊天',
      to: '/conversation',
    },
    {
      id: 'window',
      kind: 'window',
      text: `【${name}】窗外的光变了，${vitalityLine}`,
      cta: '去聊天',
      to: '/conversation',
    },
    {
      id: 'energy',
      kind: 'energy',
      text:
        energy < 40
          ? `【${name}】电量有点低，但还是想听你说一句晚安`
          : `【${name}】电量充足（${energy}），想听你吐槽今天`,
      cta: '去聊天',
      to: '/conversation',
    },
  ]

  if (hasTravel) {
    pool.push({
      id: 'travel',
      kind: 'travel',
      text: `【${name}】刚刚梦见上次旅行…想说给你听`,
      cta: '去聊天',
      to: '/conversation',
    })
  }

  if (diaryPush) {
    pool.push({
      id: 'diary',
      kind: 'diary',
      text: `【${name}】今天还没写日记哦，要不要一起记一笔？`,
      cta: '写日记',
      to: '/compose',
    })
  }

  if (hour >= 22 || hour < 6) {
    pool.push({
      id: 'night',
      kind: 'night',
      text: `【${name}】有点困了，但还是想等你回一句晚安`,
      cta: '去聊天',
      to: '/conversation',
    })
  }

  return pool
}

export function ToyNudgeHost() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { currentToy, toys, entries } = useApp()
  const { prefs } = useAuth()
  const [nudge, setNudge] = useState<NudgePayload | null>(null)
  const [dismissedId, setDismissedId] = useState<string | null>(null)

  const toy = currentToy ?? toys[0]
  const toyIndex = toys.findIndex((t) => t.id === toy?.id)
  const avatar = toy ? toyAvatar(toy, toyIndex >= 0 ? toyIndex : 0) : ''
  /** Don't stack on top of the chat composer. */
  const suppressOnRoute =
    pathname.startsWith('/conversation') || pathname.startsWith('/login')

  const quiet = useMemo(() => {
    try {
      return window.localStorage.getItem('toydairy.quietMode') === 'true'
    } catch {
      return false
    }
  }, [nudge])

  useEffect(() => {
    if (!toy || !prefs.toyReminders || quiet || suppressOnRoute) return

    let cancelled = false
    let intervalId = 0

    const fire = () => {
      if (cancelled) return
      const now = Date.now()
      const last = loadLastAt()
      if (now - last < MIN_GAP_MS) return

      const vitality = getToyVitality(toy, entries)
      const hour = new Date().getHours()
      const hasTravel = entries.some(
        (e) => e.toyId === toy.id && e.type === 'travel',
      )
      const pool = buildNudgePool(
        toy.name,
        prefs.diaryPush,
        vitality.line,
        vitality.energy,
        hour,
        hasTravel,
      )
      if (!pool.length) return

      const pick = pool[Math.floor(Math.random() * pool.length)]
      if (pick.id === dismissedId) {
        const alt = pool.find((p) => p.id !== dismissedId) ?? pick
        setNudge({ ...alt, id: `${alt.id}_${now}` })
      } else {
        setNudge({ ...pick, id: `${pick.id}_${now}` })
      }
      saveLastAt(now)
    }

    const firstDelay =
      Date.now() - loadLastAt() < MIN_GAP_MS ? INTERVAL_MS : FIRST_DELAY_MS
    const firstTimer = window.setTimeout(() => {
      fire()
      intervalId = window.setInterval(fire, INTERVAL_MS)
    }, firstDelay)

    return () => {
      cancelled = true
      window.clearTimeout(firstTimer)
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [
    toy,
    prefs.toyReminders,
    prefs.diaryPush,
    entries,
    quiet,
    dismissedId,
    suppressOnRoute,
  ])

  if (!nudge || !toy || !prefs.toyReminders || suppressOnRoute) return null

  const activeNudge = nudge

  function dismiss() {
    setDismissedId(activeNudge.kind)
    setNudge(null)
  }

  function go() {
    const target = activeNudge.to
    dismiss()
    navigate(target)
  }

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-full max-w-[390px] -translate-x-1/2 px-3"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full animate-[fadeUp_0.35s_ease]">
        <div className="flex items-start gap-3 rounded-[1.35rem] border border-line/60 bg-paper/95 p-3 shadow-[var(--shadow-warm)] backdrop-blur-md">
          <img
            src={avatar}
            alt=""
            className="mt-0.5 h-11 w-11 shrink-0 rounded-2xl object-cover ring-1 ring-line/50"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-relaxed text-ink">{activeNudge.text}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={go}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-matcha px-3.5 py-1.5 text-[11px] font-semibold text-white transition-transform active:scale-95"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {activeNudge.cta}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="min-h-9 rounded-full px-2.5 text-[11px] text-ink-muted active:bg-cream"
              >
                稍后再说
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream text-ink-muted"
            aria-label="关闭提醒"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
