import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MapPin, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import { LoadingBear } from '../components/LoadingBear'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import type { Entry } from '../types'
import { ENTRY_TYPE_LABEL } from '../types'

export function EntryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { showToast, refreshEntries, currentToy } = useApp()
  const [entry, setEntry] = useState<Entry | null>(null)
  const [loading, setLoading] = useState(true)
  const [regen, setRegen] = useState(false)

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
          nav('/archive')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, nav, showToast])

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
        <PageHeader title="详情" back="/archive" soft />
        <div className="loading-inline">
          <div className="loading-bear-wrap">
            <LoadingBear className="loading-bear h-16 w-16" />
          </div>
          <p>加载中…</p>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={entry.title || '日记详情'}
        back="/archive"
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
          {entry.tags?.map((tag) => (
            <span key={tag} className="tag tag-cream">
              #{tag}
            </span>
          ))}
        </div>

        {entry.location && (
          <p className="mb-3.5 flex items-center gap-1.5 text-sm text-ink-soft">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-mist-soft">
              <MapPin className="h-3.5 w-3.5 text-matcha-deep" />
            </span>
            {entry.location}
          </p>
        )}

        {entry.userNote && (
          <p className="mb-4 rounded-2xl bg-gradient-to-br from-cream-dark to-cream px-3.5 py-3 text-sm leading-relaxed text-ink-soft ring-1 ring-line/40">
            <span className="text-xs font-medium text-ink-muted">主人备注 · </span>
            {entry.userNote}
          </p>
        )}

        {entry.imageAnalysis && (
          <p className="mb-4 rounded-2xl bg-mist-soft/70 px-3.5 py-3 text-xs leading-relaxed text-matcha-deep">
            <span className="font-medium">照片理解 · </span>
            {entry.imageAnalysis}
          </p>
        )}

        <div className="card-paper overflow-hidden">
          <div className="bg-gradient-to-r from-mustard-soft via-peach-soft/60 to-mustard-soft px-4 py-3.5">
            <h2 className="font-display flex items-center gap-2 text-base text-ink">
              <span>✨</span>
              玩偶日记
            </h2>
          </div>
          <div className="px-4 py-5">
            <div className="whitespace-pre-wrap text-sm leading-7 text-ink-soft">
              {entry.aiDiary || '（暂无 AI 文案）'}
            </div>
          </div>
        </div>
      </article>
    </>
  )
}
