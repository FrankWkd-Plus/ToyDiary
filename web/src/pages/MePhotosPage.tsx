import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImageOff, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import type { Entry } from '../types'

export function MePhotosPage() {
  const location = useLocation()
  const { currentToy: activeToy, entries: activeEntries, toys } = useApp()
  const toyId = (location.state as { toyId?: string } | null)?.toyId
  const currentToy =
    (toyId ? toys.find((toy) => toy.id === toyId) : null) || activeToy
  const [scopedEntries, setScopedEntries] = useState<{
    toyId: string
    entries: Entry[]
  } | null>(null)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  useEffect(() => {
    if (!currentToy) return
    let cancelled = false
    void api.listEntries(currentToy.id).then((list) => {
      if (!cancelled) setScopedEntries({ toyId: currentToy.id, entries: list })
    })
    return () => {
      cancelled = true
    }
  }, [currentToy])

  const entries =
    scopedEntries && scopedEntries.toyId === currentToy?.id
      ? scopedEntries.entries
      : currentToy?.id === activeToy?.id
        ? activeEntries
        : []
  const photos = entries
    .filter((entry) => Boolean(entry.imageUrl))
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="min-h-full">
      <PageHeader
        title="🖼️ 照片收藏"
        subtitle={
          currentToy
            ? `${currentToy.name} · ${photos.length} 张共同回忆`
            : '选择一只玩偶查看照片'
        }
        back="/me"
        bare
      />

      {photos.length === 0 ? (
        <div className="flex min-h-[55vh] flex-col items-center justify-center px-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mist-soft text-matcha-deep">
            <ImageOff className="h-6 w-6" />
          </span>
          <h2 className="mt-4 font-display text-lg text-ink">还没有照片</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
            为{currentToy?.name || '玩偶'}记录一个带照片的瞬间，就会收藏到这里。
          </p>
        </div>
      ) : (
        <main className="grid auto-rows-[7.2rem] grid-cols-2 gap-2 px-3 pb-5 pt-3">
          {photos.map((entry, index) => {
            const featured = index === 0
            const lastNeedsFullRow =
              index === photos.length - 1 && (photos.length - 1) % 2 === 1
            const portrait =
              photos.length > 6 && !featured && !lastNeedsFullRow && index % 5 === 3
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setPreviewIndex(index)}
                className={`group relative overflow-hidden rounded-[1.15rem] bg-cream shadow-[var(--shadow-warm-sm)] ring-1 ring-line/40 active:scale-[0.99] ${
                  featured
                    ? 'col-span-2 row-span-2'
                    : lastNeedsFullRow
                      ? 'col-span-2'
                    : portrait
                      ? 'row-span-2'
                      : ''
                }`}
                aria-label={`查看照片：${entry.title || entry.date}`}
              >
                <img
                  src={entry.imageUrl}
                  alt={entry.title || `${currentToy?.name || '玩偶'}的照片`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/5 opacity-70" />
              </button>
            )
          })}
        </main>
      )}

      {previewIndex !== null &&
        photos[previewIndex]?.imageUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/88 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="照片预览"
            onClick={() => setPreviewIndex(null)}
          >
            <button
              type="button"
              onClick={() => setPreviewIndex(null)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md"
              aria-label="关闭照片预览"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={photos[previewIndex].imageUrl}
              alt=""
              className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            />
            <span className="absolute bottom-5 rounded-full bg-black/35 px-3 py-1.5 text-[11px] text-white/90 backdrop-blur-md">
              {previewIndex + 1} / {photos.length}
            </span>
          </div>,
          document.body,
        )}
    </div>
  )
}
