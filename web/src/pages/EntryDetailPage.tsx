import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { MapPin, RefreshCw, UserRound } from 'lucide-react'
import { api } from '../api/client'
import { LoadingBear } from '../components/LoadingBear'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import { loadProfileName } from '../profile/profileStorage'
import type { Entry, Toy } from '../types'
import { ENTRY_TYPE_LABEL } from '../types'

export function EntryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const location = useLocation()
  const fromGrowth = location.state && (location.state as { from?: string }).from === 'growth'
  const backTo = fromGrowth ? '/growth' : '/archive'
  const { showToast, refreshEntries, currentToy, toys } = useApp()
  const [entry, setEntry] = useState<Entry | null>(null)
  const [loading, setLoading] = useState(true)
  const [regen, setRegen] = useState(false)
  const [ownerName, setOwnerName] = useState(() => loadProfileName())

  useEffect(() => {
    // Keep owner label in sync if user renamed on Me page in another tab.
    const onFocus = () => setOwnerName(loadProfileName())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const e = await api.getEntry(id)
        if (!cancelled) setEntry(e)
      } catch {
        if (!cancelled) {
          showToast('记录不存在')
          nav(backTo)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, nav, showToast, backTo])

  async function onRegenerate() {
    if (!entry) return
    setRegen(true)
    try {
      const next = await api.regenerateEntry(entry.id)
      setEntry(next)
      if (currentToy) await refreshEntries(currentToy.id)
      showToast('已重新生成日记')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '生成失败')
    } finally {
      setRegen(false)
    }
  }

  if (loading || !entry) {
    return (
      <>
        <PageHeader title="详情" back={backTo} soft />
        <div className="loading-inline">
          <div className="loading-bear-wrap">
            <LoadingBear className="loading-bear h-16 w-16" />
          </div>
          <p>加载中…</p>
        </div>
      </>
    )
  }

  const toy =
    toys.find((t) => t.id === entry.toyId) ||
    (currentToy?.id === entry.toyId ? currentToy : undefined)
  const toyName = toy?.name || '玩偶'
  const ownerText =
    entry.userNote?.trim() ||
    entry.title?.trim() ||
    (entry.location
      ? `今天和 ${toyName} 一起去了${entry.location}。`
      : `今天想把这一刻写给 ${toyName}。`)
  const toyText =
    entry.aiDiary?.trim() ||
    buildToyFallback(toy, entry, ownerName)

  return (
    <>
      <PageHeader
        title={entry.title || '事件详情'}
        back={backTo}
        soft
        right={
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regen}
            className="chip inline-flex items-center gap-1 !py-1.5 !text-xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${regen ? 'animate-spin' : ''}`} />
            重写
          </button>
        }
      />
      <article className="px-4 py-4">
        {entry.imageUrl && (
          <div className="mb-4 overflow-hidden rounded-[1.25rem] shadow-[var(--shadow-elevated)] ring-1 ring-line/40">
            <img
              src={entry.imageUrl}
              alt=""
              className="max-h-72 w-full object-cover"
            />
          </div>
        )}

        <div className="mb-3.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="tag tag-mist">{ENTRY_TYPE_LABEL[entry.type]}</span>
          <time className="tabular-nums text-ink-muted">{entry.date}</time>
          {entry.mood && <span className="tag tag-mustard">{entry.mood}</span>}
        </div>

        {entry.location && (
          <p className="mb-4 flex items-center gap-1.5 text-sm text-ink-soft">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-mist-soft">
              <MapPin className="h-3.5 w-3.5 text-matcha-deep" />
            </span>
            {entry.location}
          </p>
        )}

        <div className="space-y-3.5">
          <PerspectiveCard
            tone="owner"
            badge={`我的视角 · ${ownerName}`}
            icon={<UserRound className="h-4 w-4" />}
            body={ownerText}
            emptyHint="还没有写下主人的叙述"
          />
          <PerspectiveCard
            tone="toy"
            badge={`玩偶的视角 · ${toyName}`}
            icon={<span className="text-base leading-none">🧸</span>}
            body={toyText}
            emptyHint="还没有生成玩偶日记"
            footer={
              entry.userNote?.trim()
                ? undefined
                : '提示：主人备注会作为「我的视角」展示；点右上角「重写」可刷新玩偶视角。'
            }
          />
        </div>
      </article>
    </>
  )
}

function PerspectiveCard({
  tone,
  badge,
  icon,
  body,
  emptyHint,
  footer,
}: {
  tone: 'owner' | 'toy'
  badge: string
  icon: ReactNode
  body: string
  emptyHint: string
  footer?: string
}) {
  const headerClass =
    tone === 'owner'
      ? 'bg-gradient-to-r from-mist-soft via-cream to-mist-soft'
      : 'bg-gradient-to-r from-mustard-soft via-peach-soft/60 to-mustard-soft'

  return (
    <section className="card-paper overflow-hidden">
      <div className={`${headerClass} px-4 py-3.5`}>
        <h2 className="font-display flex items-center gap-2 text-base text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-matcha-deep shadow-[var(--shadow-warm-sm)]">
            {icon}
          </span>
          {badge}
        </h2>
      </div>
      <div className="px-4 py-5">
        <div className="whitespace-pre-wrap text-sm leading-7 text-ink-soft">
          {body || emptyHint}
        </div>
        {footer && (
          <p className="mt-4 border-t border-line/50 pt-3 text-[11px] leading-relaxed text-ink-muted">
            {footer}
          </p>
        )}
      </div>
    </section>
  )
}

function buildToyFallback(
  toy: Toy | undefined,
  entry: Entry,
  ownerName: string,
): string {
  if (!toy) return '（暂无玩偶视角文案）'
  const place = entry.location || '某个温柔的地方'
  const mood = entry.mood ? `今天心里有点${entry.mood}。` : ''
  const trait = toy.traits[0] || '安静'
  return (
    `${entry.date.replace(/-/g, '年').replace(/年(\d+)$/, '月$1日')}，${place}。\n\n` +
    `${ownerName} 带着我来到这里。我有点${trait}，但还是把眼睛睁得大大的。\n\n` +
    `${mood}我想，这些瞬间以后都会变成我们的小秘密。` +
    (entry.title ? `\n\n—— 关于「${entry.title}」` : '')
  )
}
