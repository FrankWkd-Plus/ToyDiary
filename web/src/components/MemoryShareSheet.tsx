import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Download, ImagePlus, Share2, Shuffle, X } from 'lucide-react'
import { companionDayStatus } from '../archive/archiveUtils'
import type { Entry, Toy } from '../types'
import { memorySharePhotos, randomDiary, randomMemoryPhotos } from '../share/memoryShareContent'
import { renderMemoryShareCard, type MemoryShareCardOptions } from '../share/renderMemoryShareCard'
import { isMobileClient, shareOrDownloadFile } from '../share/shareHelpers'

interface Props {
  toy: Toy
  entries: Entry[]
  initialPhotoId?: string
  onClose: () => void
  showToast: (message: string) => void
}

export function MemoryShareSheet({ toy, entries, initialPhotoId, onClose, showToast }: Props) {
  const toyEntries = useMemo(() => entries.filter((entry) => entry.toyId === toy.id), [entries, toy.id])
  const photos = useMemo(() => memorySharePhotos(toyEntries), [toyEntries])
  const [selectedIds, setSelectedIds] = useState<(string | undefined)[]>([undefined, undefined, undefined])
  const [diaryId, setDiaryId] = useState<string>()
  const [pickerSlot, setPickerSlot] = useState<number | null>(null)
  const [preview, setPreview] = useState<{ url: string; blob: Blob; options: MemoryShareCardOptions }>()
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const initialized = useRef(false)
  const previewUrl = useRef<string | undefined>(undefined)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Also handles opening while the hall is still loading this toy's entries.
  useEffect(() => {
    if (initialized.current || !toyEntries.length) return
    initialized.current = true
    const first = photos.find((photo) => photo.id === initialPhotoId)
    const ordered = first ? [first, ...photos.filter((photo) => photo.id !== first.id)] : photos
    setSelectedIds(Array.from({ length: 3 }, (_, index) => ordered[index]?.id))
    setDiaryId(randomDiary(toyEntries)?.id)
  }, [toyEntries, photos, initialPhotoId])

  const options = useMemo<MemoryShareCardOptions>(() => ({
    toy,
    photos: selectedIds.map((id) => photos.find((photo) => photo.id === id)),
    diary: toyEntries.find((entry) => entry.id === diaryId),
  }), [toy, selectedIds, photos, toyEntries, diaryId])
  const ready = preview?.options === options

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    void renderMemoryShareCard(options).then((blob) => {
      if (cancelled) return
      const url = URL.createObjectURL(blob)
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
      previewUrl.current = url
      setPreview({ url, blob, options })
    }).catch(() => {
      if (!cancelled) {
        setFailed(true)
        showToast('纪念图生成失败，请重新打开试试')
      }
    })
    return () => { cancelled = true }
  }, [options, showToast])

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
  }, [])

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => previousFocus?.focus()
  }, [])

  useEffect(() => {
    // Picker controls unmount when switching views; keep keyboard focus in the dialog.
    if (!panelRef.current?.contains(document.activeElement)) closeRef.current?.focus()
  }, [pickerSlot])

  function randomize() {
    setSelectedIds(randomMemoryPhotos(photos, selectedIds))
    setDiaryId(randomDiary(toyEntries, diaryId)?.id)
  }

  function selectPhoto(id: string) {
    if (pickerSlot === null) return
    setSelectedIds((current) => {
      const next = [...current]
      const otherSlot = next.indexOf(id)
      if (otherSlot >= 0 && otherSlot !== pickerSlot) next[otherSlot] = next[pickerSlot]
      next[pickerSlot] = id
      return next
    })
    setPickerSlot(null)
  }

  async function save(mode: 'save' | 'share') {
    if (!ready || !preview || saving) return
    setSaving(true)
    try {
      const status = companionDayStatus(toy)
      // Reuse the ready preview blob, preserving mobile share activation and exact content.
      const result = await shareOrDownloadFile({
        blob: preview.blob,
        filename: `Toy-Diary-${toy.id}-${status.days}-days.jpg`,
        title: `${toy.name}的陪伴日记`,
        text: status.isFuture ? `期待和 ${toy.name} 相遇。` : `我和 ${toy.name} 已经相伴 ${status.days} 天。`,
      })
      showToast(result === 'downloaded' ? '纪念图已下载' : mode === 'save' ? '请选择「存储图像」保存到相册' : '已打开系统分享')
    } catch {
      showToast('分享失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="export-sheet-overlay" role="dialog" aria-modal="true" aria-labelledby="memory-share-title"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          if (pickerSlot !== null) setPickerSlot(null)
          else onClose()
        }
        if (event.key === 'Tab') {
          const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
          if (!buttons?.length) return
          const first = buttons[0]
          const last = buttons[buttons.length - 1]
          if (!panelRef.current?.contains(document.activeElement)) { event.preventDefault(); first.focus(); return }
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
        }
      }}>
      <div ref={panelRef} data-export-sheet className="export-sheet-panel memory-editorial-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="memory-editorial-header">
          <div>
            <h2 id="memory-share-title">分享纪念图</h2>
            <p>把一起走过的日子，收藏成一页。</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭分享纪念图" className="memory-editorial-close"><X size={20} /></button>
        </div>

        <div className="memory-editorial-preview" aria-busy={!ready && !failed}>
          {preview ? <img src={preview.url} alt={`${toy.name}的陪伴日记纪念图`} /> : <div className="memory-editorial-placeholder">{failed ? '生成失败，请重新打开' : '正在排版你的回忆…'}</div>}
          {preview && !ready && !failed && <span className="memory-editorial-updating" role="status">正在更新…</span>}
        </div>

        {pickerSlot !== null ? (
          <section className="memory-photo-picker" aria-label={`选择第 ${pickerSlot + 1} 张照片`}>
            <div className="memory-editorial-tools">
              <button type="button" onClick={() => setPickerSlot(null)}><ChevronLeft size={15} />返回</button>
              <span>选择第 {pickerSlot + 1} 个瞬间</span>
            </div>
            <div className="memory-photo-grid">
              {photos.map((photo) => <button key={photo.id} type="button" onClick={() => selectPhoto(photo.id)} aria-label={`选择 ${photo.title} ${photo.date}`} aria-pressed={selectedIds[pickerSlot] === photo.id}>
                <img src={photo.src} alt={photo.title} loading="lazy" />
                <span>{photo.title}<small>{photo.date}</small></span>
              </button>)}
            </div>
          </section>
        ) : (
          <>
            <p className="memory-editorial-hint">已选 {options.photos.filter(Boolean).length} 张 · 点击照片可更换</p>
            <div className="memory-editorial-selection">
              {options.photos.map((photo, slot) => <button key={slot} type="button" className="memory-moment-slot" onClick={() => setPickerSlot(slot)} disabled={!photos.length || saving} aria-label={`更换第 ${slot + 1} 张照片`}>
                {photo ? <img src={photo.src} alt={photo.title} /> : <ImagePlus size={20} />}
                <span>{slot + 1}</span>
              </button>)}
              <button type="button" className="memory-shuffle-button" onClick={randomize} disabled={saving || (!photos.length && !toyEntries.length)}><Shuffle size={19} /><span>随机换一组</span></button>
            </div>
            {!photos.length && <p className="memory-editorial-hint">记录带照片的日志后，就可以在这里选择瞬间。</p>}
            <div className="memory-editorial-tools">
              <span>{options.diary ? `日记摘录 · ${options.diary.date}` : '还没有日记摘录'}</span>
              <button type="button" onClick={() => setDiaryId(randomDiary(toyEntries, diaryId)?.id)} disabled={saving || !options.diary}><Shuffle size={13} />换一篇摘录</button>
            </div>
          </>
        )}

        <div className="memory-editorial-actions">
          <button type="button" disabled={!ready || saving} onClick={() => void save('save')}><Download size={17} />{isMobileClient() ? '保存到相册' : '下载图片'}</button>
          <button type="button" disabled={!ready || saving} onClick={() => void save('share')}><Share2 size={17} />{saving ? '正在分享…' : '分享纪念图'}</button>
        </div>
      </div>
    </div>, document.body,
  )
}
