import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Download,
  Eye,
  Ellipsis,
  MapPin,
  Pencil,
  RefreshCw,
  Share2,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { analyzeEntry } from '../ai/analyzeEntry'
import { api } from '../api/client'
import { LoadingBear } from '../components/LoadingBear'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import { useLocale } from '../i18n'
import { loadProfileName } from '../profile/profileStorage'
import {
  renderDiaryCardPng,
  type DiaryCardLayout,
} from '../share/renderDiaryCardPng'
import { isMobileClient, shareOrDownloadFile } from '../share/shareHelpers'
import { deletePersistedDiaryPhoto } from '../media/photoStorage'
import type { Entry, Toy } from '../types'
import { entryTypeLabel } from '../types'

export function EntryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { locale } = useLocale()
  const location = useLocation()
  const fromState = (location.state as { from?: string } | null)?.from
  const fromMeCollection = fromState === 'me-collection'
  const backTo =
    fromMeCollection
      ? '/me'
      : fromState === 'growth-timeline'
      ? '/growth'
      : fromState === 'growth' || fromState === 'growth-stats'
        ? '/growth'
        : '/archive'
  const { showToast, refreshEntries, currentToy, toys } = useApp()
  const [entry, setEntry] = useState<Entry | null>(null)
  const [loading, setLoading] = useState(true)
  const [regen, setRegen] = useState(false)
  const [ownerName, setOwnerName] = useState(() => loadProfileName())
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [layout, setLayout] = useState<DiaryCardLayout>('side')
  const [stickerFrame, setStickerFrame] = useState(true)
  const [showDayCount, setShowDayCount] = useState(true)
  const [showLocation, setShowLocation] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const onFocus = () => setOwnerName(loadProfileName())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Lock background scroll while export sheet is open (page-scroll + body)
  useEffect(() => {
    if (!exportOpen && !menuOpen && !confirmDelete) return
    const scrollEl = document.querySelector('.page-scroll') as HTMLElement | null
    const prevBody = document.body.style.overflow
    const prevScroll = scrollEl?.style.overflow ?? ''
    document.body.style.overflow = 'hidden'
    if (scrollEl) scrollEl.style.overflow = 'hidden'
    const blockTouch = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('[data-modal-sheet]')) return
      e.preventDefault()
    }
    document.addEventListener('touchmove', blockTouch, { passive: false })
    return () => {
      document.body.style.overflow = prevBody
      if (scrollEl) scrollEl.style.overflow = prevScroll
      document.removeEventListener('touchmove', blockTouch)
    }
  }, [exportOpen, menuOpen, confirmDelete])

  // Live export preview — re-render when options change (debounced)
  useEffect(() => {
    if (!exportOpen || !entry) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return undefined
      })
      setPreviewing(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setPreviewing(true)
      const toy =
        toys.find((t) => t.id === entry.toyId) ||
        (currentToy?.id === entry.toyId ? currentToy : undefined)
      void renderDiaryCardPng({
        entry,
        toy,
        ownerName,
        layout,
        stickerFrame,
        showDayCount,
        showLocation,
      })
        .then((blob) => {
          if (cancelled) return
          const url = URL.createObjectURL(blob)
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return url
          })
        })
        .catch(() => {
          if (!cancelled) showToast('预览生成失败')
        })
        .finally(() => {
          if (!cancelled) setPreviewing(false)
        })
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    exportOpen,
    entry,
    toys,
    currentToy,
    ownerName,
    layout,
    stickerFrame,
    showDayCount,
    showLocation,
    showToast,
  ])

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
    if (!entry || regen) return
    setRegen(true)
    try {
      const toy =
        toys.find((t) => t.id === entry.toyId) ||
        (currentToy?.id === entry.toyId ? currentToy : undefined)
      if (!toy) throw new Error('找不到关联玩偶')

      // Client-side AI (Pages Function) with local template fallback
      const analysis = await analyzeEntry({
        toy,
        date: entry.date,
        location: entry.place?.displayName || entry.location,
        userNote: entry.userNote,
        imageUrl: entry.imageUrl,
        locale,
      })

      const patch = {
        aiDiary: analysis.aiDiary,
        imageAnalysis: analysis.imageAnalysis || entry.imageAnalysis,
        tags: analysis.tags?.length ? analysis.tags : entry.tags,
        mood: entry.mood || analysis.mood,
      }

      // Always persist rewrite to localStorage via api.updateEntry
      const next = await api.updateEntry(entry.id, patch)
      setEntry(next)
      if (currentToy) await refreshEntries(currentToy.id)
      showToast(
        analysis.source === 'api'
          ? '已用 AI 重新生成并保存到本机'
          : '已重新生成（本地模板）并保存到本机',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : '生成失败')
    } finally {
      setRegen(false)
    }
  }

  async function onDelete() {
    if (!entry || deleting) return
    setDeleting(true)
    try {
      await deletePersistedDiaryPhoto(entry.localImagePath)
      await api.deleteEntry(entry.id)
      await refreshEntries(entry.toyId)
      showToast('这篇日志已删除')
      nav(backTo, { replace: true })
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败，请重试')
    } finally {
      setDeleting(false)
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
        showLocation,
      })
      const filename = `toydairy-diary-${entry.date}.jpg`
      const mode = await shareOrDownloadFile({
        blob,
        filename,
        title: entry.title || '今日日记',
        text: '来自 Toy Diary 的双视角日记卡',
      })
      showToast(
        mode === 'shared'
          ? '请在系统菜单选择「存储图像」保存到相册'
          : '日记卡已下载',
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
        back={fromMeCollection ? true : backTo}
        soft
        right={
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="chip inline-flex items-center gap-1 !min-h-9 !px-2.5 !py-1.5 !text-xs"
              aria-label="导出日记卡"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>导出</span>
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="chip inline-flex min-h-9 min-w-9 items-center justify-center !px-2 !py-1.5 text-xs"
              aria-label="更多日志操作"
            >
              <Ellipsis className="h-4 w-4" />
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
          <span className="tag tag-mist">
            {entryTypeLabel(entry.type, locale)}
          </span>
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
                : '提示：主人备注会作为「我的视角」展示；点右上角「···」可重新生成玩偶视角。'
            }
          />
        </div>
      </article>

      {exportOpen &&
        createPortal(
          <div
            className="export-sheet-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="导出日记"
            onClick={() => !exporting && setExportOpen(false)}
          >
            <div
              data-modal-sheet
              className="export-sheet-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-lg text-ink">导出当日日记</p>
                  <p className="text-[10px] text-ink-muted">
                    手机：保存到相册 · 电脑：自动下载
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

              <div className="mt-3 overflow-hidden rounded-2xl bg-cream ring-1 ring-line/50">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="导出预览"
                    className="max-h-64 w-full object-contain"
                  />
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center gap-1.5 px-4 text-center text-xs text-ink-muted">
                    <Eye className="h-5 w-5 text-matcha-deep" />
                    {previewing ? '正在生成预览…' : '预览将显示在这里'}
                  </div>
                )}
                {previewing && previewUrl && (
                  <p className="border-t border-line/40 bg-white/70 py-1 text-center text-[10px] text-ink-muted">
                    更新预览中…
                  </p>
                )}
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
                  label="显示地点（📍 灰色文字）"
                  on={showLocation}
                  onChange={setShowLocation}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={exporting || previewing}
                  onClick={() => {
                    // Force re-preview by clearing then re-triggering via option touch
                    if (!entry || previewing) return
                    setPreviewing(true)
                    const toyForPreview =
                      toys.find((t) => t.id === entry.toyId) ||
                      (currentToy?.id === entry.toyId ? currentToy : undefined)
                    void renderDiaryCardPng({
                      entry,
                      toy: toyForPreview,
                      ownerName,
                      layout,
                      stickerFrame,
                      showDayCount,
                      showLocation,
                    })
                      .then((blob) => {
                        const url = URL.createObjectURL(blob)
                        setPreviewUrl((prev) => {
                          if (prev) URL.revokeObjectURL(prev)
                          return url
                        })
                      })
                      .catch(() => showToast('预览生成失败'))
                      .finally(() => setPreviewing(false))
                  }}
                  className="btn-secondary flex items-center justify-center gap-1.5 py-3 text-xs disabled:opacity-50"
                >
                  <Eye className="h-4 w-4" />
                  {previewing ? '预览中…' : '刷新预览'}
                </button>
                <button
                  type="button"
                  disabled={exporting || previewing}
                  onClick={() => void onExportCard()}
                  className="btn-primary flex items-center justify-center gap-1.5 py-3 text-xs disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {exporting
                    ? '生成中…'
                    : isMobileClient()
                      ? '保存到相册'
                      : '下载'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {menuOpen &&
        createPortal(
          <div
            className="ios-action-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="日志操作"
            onClick={() => setMenuOpen(false)}
          >
            <div
              data-modal-sheet
              className="ios-action-sheet"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="ios-action-group">
                <button
                  type="button"
                  className="ios-action-row"
                  onClick={() => {
                    setMenuOpen(false)
                    nav('/compose', {
                      state: { editEntry: entry, from: `/entries/${entry.id}` },
                    })
                  }}
                >
                  <Pencil className="h-5 w-5" />
                  编辑日志
                </button>
                <button
                  type="button"
                  disabled={regen}
                  className="ios-action-row disabled:opacity-45"
                  onClick={() => {
                    setMenuOpen(false)
                    void onRegenerate()
                  }}
                >
                  <RefreshCw className={`h-5 w-5 ${regen ? 'animate-spin' : ''}`} />
                  {regen ? '正在生成…' : '重新生成玩偶日记'}
                </button>
                <button
                  type="button"
                  className="ios-action-row ios-action-danger"
                  onClick={() => {
                    setMenuOpen(false)
                    setConfirmDelete(true)
                  }}
                >
                  <Trash2 className="h-5 w-5" />
                  删除这篇日志
                </button>
              </div>
              <button
                type="button"
                className="ios-action-cancel"
                onClick={() => setMenuOpen(false)}
              >
                取消
              </button>
            </div>
          </div>,
          document.body,
        )}

      {confirmDelete &&
        createPortal(
          <div
            className="ios-action-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-entry-title"
            onClick={() => !deleting && setConfirmDelete(false)}
          >
            <section
              data-modal-sheet
              className="ios-confirm-card"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="delete-entry-title" className="font-display text-lg text-ink">
                删除这篇日志？
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                删除后将从成长轨迹、地图、统计和回忆展厅中移除，且无法恢复。
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={deleting}
                  className="btn-secondary py-3 text-sm disabled:opacity-50"
                  onClick={() => setConfirmDelete(false)}
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  className="ios-confirm-delete"
                  onClick={() => void onDelete()}
                >
                  {deleting ? '正在删除…' : '删除'}
                </button>
              </div>
            </section>
          </div>,
          document.body,
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
