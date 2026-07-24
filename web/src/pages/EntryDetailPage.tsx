import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Download,
  MapPin,
  RefreshCw,
  Share2,
  UserRound,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import { LoadingBear } from '../components/LoadingBear'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import { loadProfileName } from '../profile/profileStorage'
import {
  renderDiaryCardPng,
  type DiaryCardLayout,
} from '../share/renderDiaryCardPng'
import { shareOrDownloadFile } from '../share/shareHelpers'
import type { Entry, Toy } from '../types'
import { ENTRY_TYPE_LABEL } from '../types'

export function EntryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const location = useLocation()
  const fromState = (location.state as { from?: string } | null)?.from
  const backTo =
    fromState === 'growth' ||
    fromState === 'growth-timeline' ||
    fromState === 'growth-stats'
      ? fromState === 'growth-timeline'
        ? '/growth/timeline'
        : '/growth'
      : '/archive'
  const { showToast, refreshEntries, currentToy, toys } = useApp()
  const [entry, setEntry] = useState<Entry | null>(null)
  const [loading, setLoading] = useState(true)
  const [regen, setRegen] = useState(false)
  const [ownerName, setOwnerName] = useState(() => loadProfileName())
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [layout, setLayout] = useState<DiaryCardLayout>('side')
  const [stickerFrame, setStickerFrame] = useState(true)
  const [showDayCount, setShowDayCount] = useState(true)
  const [locationWatermark, setLocationWatermark] = useState(true)

  useEffect(() => {
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

  async function onExportCard() {
    if (!entry || exporting) return
    setExporting(true)
    try {
      const toy =
        toys.find((t) => t.id === entry.toyId) ||
        (currentToy?.id === entry.toyId ? currentToy : undefined)
      const blob = await renderDiaryCardPng({
        entry,
        toy,
        ownerName,
        layout,
        stickerFrame,
        showDayCount,
        locationWatermark,
      })
      const filename = `toydairy-diary-${entry.date}.png`
      const mode = await shareOrDownloadFile({
        blob,
        filename,
        title: entry.title || '今日日记',
        text: '来自 Toy Dairy 的双视角日记卡',
      })
      showToast(
        mode === 'shared'
          ? '已打开分享（微信 / 朋友圈 / 相册）'
          : '日记卡 PNG 已保存',
      )
      setExportOpen(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导出失败')
    } finally {
      setExporting(false)
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
    entry.aiDiary?.trim() || buildToyFallback(toy, entry, ownerName)

  return (
    <>
      <PageHeader
        title={entry.title || '事件详情'}
        back={backTo}
        soft
        right={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="chip inline-flex items-center gap-1 !py-1.5 !text-xs"
              aria-label="导出日记卡"
            >
              <Share2 className="h-3.5 w-3.5" />
              导出
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regen}
              className="chip inline-flex items-center gap-1 !py-1.5 !text-xs disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${regen ? 'animate-spin' : ''}`}
              />
              重写
            </button>
          </div>
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
          {entry.tags?.map((tag) => (
            <span key={tag} className="tag tag-cream">
              #{tag}
            </span>
          ))}
        </div>

        {entry.location && (
          <p className="mb-4 flex items-center gap-1.5 text-sm text-ink-soft">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-mist-soft">
              <MapPin className="h-3.5 w-3.5 text-matcha-deep" />
            </span>
            {entry.location}
          </p>
        )}

        {entry.imageAnalysis && (
          <p className="mb-4 rounded-2xl bg-mist-soft/70 px-3.5 py-3 text-xs leading-relaxed text-matcha-deep">
            <span className="font-medium">照片理解 · </span>
            {entry.imageAnalysis}
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

      {exportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-4 backdrop-blur-[2px] sm:items-center"
          onClick={() => !exporting && setExportOpen(false)}
        >
          <div
            className="w-full max-w-[390px] rounded-[1.5rem] bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-lg text-ink">导出当日日记</p>
                <p className="text-[10px] text-ink-muted">
                  生成 PNG，可分享到微信 / 朋友圈或保存相册
                </p>
              </div>
              <button
                type="button"
                disabled={exporting}
                onClick={() => setExportOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-cream"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3">
              <p className="text-[11px] font-medium text-ink-muted">排版</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <OptionChip
                  active={layout === 'side'}
                  label="左主右偶"
                  onClick={() => setLayout('side')}
                />
                <OptionChip
                  active={layout === 'stack'}
                  label="上下对称"
                  onClick={() => setLayout('stack')}
                />
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <ToggleOption
                label="贴纸边框"
                on={stickerFrame}
                onChange={setStickerFrame}
              />
              <ToggleOption
                label="正数日数字"
                on={showDayCount}
                onChange={setShowDayCount}
              />
              <ToggleOption
                label="地点水印"
                on={locationWatermark}
                onChange={setLocationWatermark}
              />
            </div>

            <button
              type="button"
              disabled={exporting}
              onClick={() => void onExportCard()}
              className="btn-primary mt-4 flex w-full items-center justify-center gap-2 py-3 text-sm disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {exporting ? '生成中…' : '生成并分享 PNG'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function OptionChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl py-2.5 text-xs font-semibold ${
        active
          ? 'bg-mist-soft text-matcha-deep ring-2 ring-matcha'
          : 'bg-cream text-ink-soft ring-1 ring-line/50'
      }`}
    >
      {label}
    </button>
  )
}

function ToggleOption({
  label,
  on,
  onChange,
}: {
  label: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-left"
    >
      <span className="text-sm text-ink">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${
          on ? 'bg-matcha' : 'bg-cream-dark'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            on ? 'left-5' : 'left-0.5'
          }`}
        />
      </span>
    </button>
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
