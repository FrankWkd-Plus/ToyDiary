/**
 * In-app proactive toy nudges (demo stand-in for push).
 * Granular prefs: miss / diary / travel / night + frequency.
 */
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MessageCircle, X } from 'lucide-react'
import { toyAvatar } from '../archive/archiveUtils'
import { getToyVitality } from '../archive/toyVitality'
import { useAuth } from '../auth/AuthContext'
import { useApp } from '../context/AppContext'
import type { UserPrefs } from '../auth/authStorage'

const LAST_NUDGE_KEY = 'toydairy.nudge.lastAt'

type NudgeKind = 'miss' | 'diary' | 'travel' | 'energy' | 'night' | 'window' | 'joke'

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

function frequencyMs(freq: UserPrefs['nudgeFrequency']) {
  switch (freq) {
    case 'rare':
      return { first: 90_000, interval: 8 * 60_000, minGap: 5 * 60_000 }
    case 'chatty':
      return { first: 18_000, interval: 2 * 60_000, minGap: 75_000 }
    default:
      return { first: 28_000, interval: 4 * 60_000, minGap: 2 * 60_000 }
  }
}

function buildNudgePool(
  name: string,
  prefs: UserPrefs,
  vitalityLine: string,
  energy: number,
  hour: number,
  hasTravel: boolean,
  locationHint?: string,
): NudgePayload[] {
  const pool: NudgePayload[] = []

  if (prefs.nudgeMiss) {
    pool.push(
      {
        id: 'miss1',
        kind: 'miss',
        text: `【${name}】想你啦～口袋里有点空，你在忙吗？`,
        cta: '去聊天',
        to: '/conversation',
      },
      {
        id: 'miss2',
        kind: 'miss',
        text: `【${name}】刚刚对着窗户发呆三分钟，结论是：还是你比较好玩。`,
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
        id: 'joke',
        kind: 'joke',
        text: `【${name}】报告：今日可爱值 +1（未经科学认证，仅对你有效）。`,
        cta: '去聊天',
        to: '/conversation',
      },
    )
  }

  if (prefs.nudgeNight) {
    pool.push({
      id: 'energy',
      kind: 'energy',
      text:
        energy < 40
          ? `【${name}】电量 ${energy}%，已进入省电模式，但仍想听你说一句晚安。`
          : `【${name}】电量充足（${energy}），想听你吐槽今天！`,
      cta: '去聊天',
      to: '/conversation',
    })
    if (hour >= 22 || hour < 6) {
      pool.push({
        id: 'night',
        kind: 'night',
        text: `【${name}】夜深了，我把灯调成小小的一盏。你还没睡的话，回我一句就好。`,
        cta: '去聊天',
        to: '/conversation',
      })
    }
  }

  if (prefs.nudgeTravel && hasTravel) {
    pool.push({
      id: 'travel',
      kind: 'travel',
      text: locationHint
        ? `【${name}】梦见我们又去了${locationHint}…风还是那阵味道，要不要重温一下？`
        : `【${name}】刚刚梦见上次旅行…地图上的小点在眨眼睛。`,
      cta: '去聊天',
      to: '/conversation',
    })
    pool.push({
      id: 'travel2',
      kind: 'travel',
      text: `【${name}】提议：打开旅行轨迹，我们再走一遍好不好？（我会乖乖当导航）`,
      cta: '看地图',
      to: '/growth?tab=map',
    })
  }

  if (prefs.diaryPush) {
    pool.push(
      {
        id: 'diary',
        kind: 'diary',
        text: `【${name}】今天还没写日记哦～一句话也行，我来补上玩偶视角！`,
        cta: '写日记',
        to: '/compose',
      },
      {
        id: 'diary2',
        kind: 'diary',
        text: `【${name}】手帐页还空着一角，感觉少了你的笔迹。`,
        cta: '记一笔',
        to: '/compose',
      },
    )
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
  const suppressOnRoute =
    pathname.startsWith('/conversation') ||
    pathname.startsWith('/toys/')

  const quiet = useMemo(() => {
    try {
      return window.localStorage.getItem('toydairy.quietMode') === 'true'
    } catch {
      return false
    }
  }, [nudge])

  const timing = frequencyMs(prefs.nudgeFrequency ?? 'normal')

  useEffect(() => {
    if (!toy || !prefs.toyReminders || quiet || suppressOnRoute) return

    let cancelled = false
    let intervalId = 0

    const fire = () => {
      if (cancelled) return
      const now = Date.now()
      const last = loadLastAt()
      if (now - last < timing.minGap) return

      const vitality = getToyVitality(toy, entries)
      const hour = new Date().getHours()
      const travelEntries = entries.filter(
        (e) => e.toyId === toy.id && e.type === 'travel',
      )
      const hasTravel = travelEntries.length > 0
      const locationHint =
        travelEntries[0]?.location || travelEntries[0]?.place?.displayName

      const pool = buildNudgePool(
        toy.name,
        prefs,
        vitality.line,
        vitality.energy,
        hour,
        hasTravel,
        locationHint,
      )
      if (!pool.length) return

      let pick = pool[Math.floor(Math.random() * pool.length)]
      if (pick.id === dismissedId) {
        pick = pool.find((p) => p.id !== dismissedId) ?? pick
      }
      setNudge({ ...pick, id: `${pick.id}_${now}` })
      saveLastAt(now)
    }

    const firstDelay =
      Date.now() - loadLastAt() < timing.minGap ? timing.interval : timing.first
    const firstTimer = window.setTimeout(() => {
      fire()
      intervalId = window.setInterval(fire, timing.interval)
    }, firstDelay)

    return () => {
      cancelled = true
      window.clearTimeout(firstTimer)
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [
    toy,
    prefs,
    entries,
    quiet,
    dismissedId,
    suppressOnRoute,
    timing.first,
    timing.interval,
    timing.minGap,
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
            <p className="text-[13px] leading-relaxed text-ink">
              {activeNudge.text}
            </p>
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
