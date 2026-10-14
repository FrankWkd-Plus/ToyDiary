import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Download,
  Ellipsis,
  MapPin,
  Pencil,
  RefreshCw,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { analyzeEntry } from '../ai/analyzeEntry'
import { api } from '../api/client'
import { LoadingBear } from '../components/LoadingBear'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import { useLocale } from '../i18n'
import { renderDiaryCardPng } from '../share/renderDiaryCardPng'
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
  const fromMeToyArchive = fromState === 'me-toys'
  const backTo =
    fromMeCollection || fromMeToyArchive
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
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [previewBlob, setPreviewBlob] = useState<Blob>()
  const previewObjectUrl = useRef<string | undefined>(undefined)
  const exportPanelRef = useRef<HTMLDivElement>(null)
  const exportCloseRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  useEffect(() => {
    if (!exportOpen || !entry) {
      if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current)
      previewObjectUrl.current = undefined
      setPreviewUrl(undefined)
      setPreviewBlob(undefined)
      setPreviewing(false)
      return
    }
    let cancelled = false
    setPreviewing(true)
    setPreviewBlob(undefined)
    const toy = toys.find((item) => item.id === entry.toyId)
    void renderDiaryCardPng({ entry, toy }).then((blob) => {
      if (cancelled) return
      const url = URL.createObjectURL(blob)
      if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current)
      previewObjectUrl.current = url
      setPreviewUrl(url)
      setPreviewBlob(blob)
    }).catch((error) => {
      if (!cancelled) showToast(error instanceof Error ? error.message : '预览生成失败')
    }).finally(() => {
      if (!cancelled) setPreviewing(false)
    })
    return () => { cancelled = true }
  }, [exportOpen, entry, toys, showToast])

  useEffect(() => () => {
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current)
  }, [])

  useEffect(() => {
    if (!exportOpen) return
    const previousFocus = document.activeElement as HTMLElement | null
    exportCloseRef.current?.focus()
    return () => previousFocus?.focus()
  }, [exportOpen])

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

  async function onExportCard(action: 'save' | 'share') {
    if (!entry || exporting || previewing || !previewBlob) return
    setExporting(true)
    try {
      const mode = await shareOrDownloadFile({
        blob: previewBlob,
        filename: `toydiary-diary-${entry.id}-${entry.date}.jpg`,
        title: entry.title || '陪伴日记',
        text: '来自 Toy Diary 的照片日记',
      })
      showToast(mode === 'downloaded' ? '照片日记已下载' : action === 'save'
        ? '请在系统菜单选择「存储图像」保存到相册'
        : '已打开系统分享')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '导出失败')
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
    entry.aiDiary?.trim() || buildToyFallback(toy, entry)

  return (
    <>
      <PageHeader
        title={entry.title || '事件详情'}
        back={fromMeCollection || fromMeToyArchive ? true : backTo}
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
          <div className="mb-4 flex max-h-[68vh] items-center justify-center overflow-hidden rounded-[1.25rem] bg-paper shadow-[var(--shadow-elevated)] ring-1 ring-line/40">
            <img
              src={entry.imageUrl}
              alt=""
              className="max-h-[68vh] w-full object-contain"
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
            <span className="font-medium">画面印象 · </span>
            {entry.imageAnalysis}
          </p>
        )}

        <div className="space-y-3.5">
          <PerspectiveCard
            tone="owner"
            badge="你写下的话"
            icon={<Pencil className="h-4 w-4" />}
            body={ownerText}
            emptyHint="还没有写下这段记录"
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
                : '提示：你写下的文字会保存在上方；点右上角「···」可重新生成玩偶视角。'
            }
          />
        </div>
      </article>

      {exportOpen && createPortal(
        <div className="export-sheet-overlay" role="dialog" aria-modal="true" aria-labelledby="diary-export-title"
          onClick={() => !exporting && setExportOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !exporting) setExportOpen(false)
            if (event.key !== 'Tab') return
            const buttons = exportPanelRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
            if (!buttons?.length) return
            const first = buttons[0]
            const last = buttons[buttons.length - 1]
            if (!exportPanelRef.current?.contains(document.activeElement)) { event.preventDefault(); first.focus() }
            else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
          }}>
          <div ref={exportPanelRef} data-modal-sheet className="export-sheet-panel diary-photo-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="memory-editorial-header">
              <div>
                <h2 id="diary-export-title">导出照片日记</h2>
                <p>把这一天的陪伴，好好收藏。</p>
              </div>
              <button ref={exportCloseRef} type="button" className="memory-editorial-close" disabled={exporting} onClick={() => setExportOpen(false)} aria-label="关闭导出"><X size={20} /></button>
            </div>
            <div className="diary-export-preview" aria-busy={previewing}>
              {previewUrl ? <img src={previewUrl} alt="照片日记导出预览" /> : <div className="diary-export-placeholder">{previewing ? '正在整理这一天的回忆…' : '照片暂时无法载入，请重新打开试试'}</div>}
            </div>
            <div className="memory-editorial-actions">
              <button type="button" disabled={exporting || previewing || !previewBlob} onClick={() => void onExportCard('save')}><Download size={17} />{isMobileClient() ? '保存到相册' : '下载图片'}</button>
              <button type="button" disabled={exporting || previewing || !previewBlob} onClick={() => void onExportCard('share')}><Share2 size={17} />{exporting ? '正在导出…' : '分享日记'}</button>
            </div>
          </div>
        </div>, document.body,
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
): string {
  if (!toy) return '（暂无玩偶视角文案）'
  const place = entry.location || '某个温柔的地方'
  const mood = entry.mood ? `今天心里有点${entry.mood}。` : ''
  const trait = toy.traits[0] || '安静'
  return (
    `${entry.date.replace(/-/g, '年').replace(/年(\d+)$/, '月$1日')}，${place}。\n\n` +
    `你带着我来到这里。我有点${trait}，但还是把眼睛睁得大大的。\n\n` +
    `${mood}我想，这些瞬间以后都会变成我们的小秘密。` +
    (entry.title ? `\n\n—— 关于「${entry.title}」` : '')
  )
}
