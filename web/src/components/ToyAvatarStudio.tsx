import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  Check,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import {
  createFallbackAvatar,
  createStickerAvatar,
  type StickerBorder,
} from '../image/createStickerAvatar'
import { removeToyBackgroundNative } from '../image/removeToyBackgroundNative'
type Stage = 'pick' | 'processing' | 'confirm'
type AvatarProgress = { progress: number; detail: string }

/**
 * Upload → on-device cutout → sticker preview → automatically use as avatar.
 */
export function ToyAvatarStudio({
  value,
  onConfirm,
  onToast,
}: {
  value?: string
  onConfirm: (dataUrl: string) => void
  onToast: (msg: string) => void
}) {
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>(value ? 'confirm' : 'pick')
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [cutoutBlob, setCutoutBlob] = useState<Blob | null>(null)
  const [removed, setRemoved] = useState(false)
  const [processingNote, setProcessingNote] = useState<string | null>(null)
  const [progress, setProgress] = useState<AvatarProgress | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(value)
  const [border, setBorder] = useState<StickerBorder>('standard')
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  )
  const rebuildToken = useRef(0)
  const onConfirmRef = useRef(onConfirm)

  useEffect(() => {
    onConfirmRef.current = onConfirm
  }, [onConfirm])

  const rebuildPreview = useCallback(
    async (
      blob: Blob,
      opts: {
        border: StickerBorder
        zoom: number
        offsetX: number
        offsetY: number
        useSticker: boolean
      },
    ) => {
      const token = ++rebuildToken.current
      try {
        const dataUrl = opts.useSticker
          ? await createStickerAvatar(blob, {
              border: opts.border,
              zoom: opts.zoom,
              offsetX: opts.offsetX,
              offsetY: opts.offsetY,
              subjectScale: 0.8,
              size: 512,
            })
          : await createFallbackAvatar(blob, {
              border: opts.border,
              zoom: opts.zoom,
              offsetX: opts.offsetX,
              offsetY: opts.offsetY,
              size: 512,
            })
        if (token === rebuildToken.current) setPreviewUrl(dataUrl)
        return dataUrl
      } catch (err) {
        console.warn(err)
        onToast('生成贴纸失败，请重试')
        return undefined
      }
    },
    [onToast],
  )

  async function processFile(file: File) {
    if (!file.type.startsWith('image/')) {
      onToast('请选择图片')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      onToast('图片请小于 12MB')
      return
    }
    setSourceFile(file)
    setProcessingNote(null)
    setStage('processing')
    setProgress({
      progress: 0.2,
      detail: '正在本机识别玩偶主体…',
    })
    setOffset({ x: 0, y: 0 })
    setZoom(1)

    const result = await removeToyBackgroundNative(file)
    setCutoutBlob(result.blob)
    setRemoved(result.removed)
    setProcessingNote(result.message ?? null)
    if (result.message) onToast(result.message)
    setProgress({ progress: 0.75, detail: '正在生成贴纸头像…' })
    const nextAvatar = await rebuildPreview(result.blob, {
      border,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      useSticker: true,
    })
    if (!nextAvatar) {
      setStage('pick')
      setProgress(null)
      return
    }
    onConfirmRef.current(nextAvatar)
    setStage('confirm')
    setProgress(null)
  }

  // Rebuild when border / zoom / offset change
  useEffect(() => {
    if (stage !== 'confirm' || !cutoutBlob) return
    const t = window.setTimeout(() => {
      void rebuildPreview(cutoutBlob, {
        border,
        zoom,
        offsetX: offset.x,
        offsetY: offset.y,
        useSticker: true,
      }).then((nextAvatar) => {
        if (nextAvatar) onConfirmRef.current(nextAvatar)
      })
    }, 80)
    return () => window.clearTimeout(t)
  }, [border, zoom, offset.x, offset.y, cutoutBlob, stage, rebuildPreview])

  function onPointerDown(e: React.PointerEvent) {
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    const dx = (e.clientX - dragRef.current.x) / 220
    const dy = (e.clientY - dragRef.current.y) / 220
    setOffset({
      x: Math.max(-0.35, Math.min(0.35, dragRef.current.ox + dx)),
      y: Math.max(-0.35, Math.min(0.35, dragRef.current.oy + dy)),
    })
  }

  function onPointerUp() {
    dragRef.current = null
  }

  if (stage === 'pick') {
    return (
      <div className="card-paper space-y-3 p-4 text-center">
        <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-[1.5rem] border-2 border-dashed border-line bg-cream text-4xl shadow-[var(--shadow-warm-sm)]">
          {value ? (
            <img src={value} alt="当前头像" className="h-full w-full object-cover" />
          ) : (
            '🧸'
          )}
        </div>
        <p className="text-xs leading-relaxed text-ink-soft">
          拍一张玩偶照片，我们会把它「抱」进手帐，做成白色贴纸头像。
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="btn-secondary py-2.5 text-xs"
          >
            <ImagePlus className="h-4 w-4" />
            相册上传
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="btn-primary py-2.5 text-xs"
          >
            <Camera className="h-4 w-4" />
            拍照
          </button>
        </div>
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void processFile(f)
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void processFile(f)
          }}
        />
        <p className="text-[9px] text-ink-muted">
          照片仅在本机处理，不会因制作头像自动上传
        </p>
      </div>
    )
  }

  if (stage === 'processing') {
    const pct = Math.round((progress?.progress ?? 0.08) * 100)
    const label = '正在制作头像…'
    const detail = progress?.detail
    return (
      <div className="card-paper space-y-3 p-5 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mist-soft text-matcha-deep">
          <LoaderCircle className="h-7 w-7 animate-spin" />
        </span>
        <p className="text-base font-semibold text-ink">{label}</p>
        {detail && (
          <p className="text-[11px] leading-relaxed text-ink-muted">{detail}</p>
        )}
        <div className="h-2.5 overflow-hidden rounded-full bg-cream-dark">
          <span
            className="block h-full rounded-full bg-matcha transition-[width] duration-200"
            style={{ width: `${Math.max(6, Math.min(100, pct))}%` }}
          />
        </div>
        <p className="text-sm font-medium tabular-nums text-matcha-deep">
          {pct}%
        </p>
        <p className="text-[10px] leading-relaxed text-ink-muted">
          所有裁切、缩放和贴纸边框都在当前设备完成。
        </p>
      </div>
    )
  }

  const isSavedAvatar = Boolean(value && !sourceFile && !cutoutBlob)
  if (isSavedAvatar) {
    return (
      <div className="card-paper flex items-center gap-4 overflow-hidden p-4">
        <div className="relative h-24 w-24 shrink-0 rounded-[1.55rem] bg-gradient-to-br from-cream to-mist-soft p-2 shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50">
          <img
            src={value}
            alt="当前玩偶头像"
            className="h-full w-full rounded-[1.2rem] object-contain"
          />
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-matcha-deep shadow-sm ring-1 ring-line/50">
            <Check className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">现在的档案照</p>
          <p className="mt-1 text-[11px] leading-5 text-ink-muted">
            保留这张照片，或重新制作一枚玩偶贴纸头像。
          </p>
          <button
            type="button"
            onClick={() => {
              setStage('pick')
              setPreviewUrl(undefined)
            }}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-mist-soft px-3 py-1.5 text-[11px] font-medium text-matcha-deep"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            更换照片
          </button>
        </div>
      </div>
    )
  }

  // confirm
  return (
    <div className="card-paper space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-matcha-deep">
          <Sparkles className="h-3.5 w-3.5" />
          {removed ? '已自动抠出玩偶主体' : '原图裁切预览'}
        </div>
        <button
          type="button"
          onClick={() => {
            setStage('pick')
            setCutoutBlob(null)
            setSourceFile(null)
            setProcessingNote(null)
            setPreviewUrl(value)
          }}
          className="text-[10px] text-ink-muted"
        >
          重选照片
        </button>
      </div>

      {processingNote && (
        <p className="rounded-2xl bg-cream px-3 py-2 text-[10px] leading-5 text-ink-muted">
          {processingNote}
        </p>
      )}

      <div
        className="relative mx-auto flex h-56 w-56 touch-none items-center justify-center overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-warm)] ring-1 ring-line/50"
        style={{
          background: '#ffffff',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="贴纸预览"
            className="pointer-events-none h-[88%] w-[88%] object-contain"
            draggable={false}
          />
        ) : (
          <LoaderCircle className="h-6 w-6 animate-spin text-ink-muted" />
        )}
        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink/55 px-2 py-0.5 text-[9px] text-white">
          拖动调整位置
        </span>
      </div>

      <label className="block px-1">
        <span className="mb-1 flex justify-between text-[10px] text-ink-muted">
          <span>缩放</span>
          <span>{zoom.toFixed(2)}×</span>
        </span>
        <input
          type="range"
          min={0.7}
          max={1.45}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-[var(--color-matcha)]"
        />
      </label>

      <div>
        <span className="mb-1.5 block text-[10px] text-ink-muted">白边粗细</span>
        <div className="flex gap-2">
          {(
            [
              ['thin', '细'],
              ['standard', '标准'],
              ['thick', '粗'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setBorder(id)}
              className={border === id ? 'chip chip-active' : 'chip'}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-1">
        <button
          type="button"
          onClick={() => {
            setZoom(1)
            setOffset({ x: 0, y: 0 })
          }}
          className="btn-secondary w-full py-2.5 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          恢复居中
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-2xl bg-mist-soft px-3.5 py-3 text-xs text-matcha-deep">
        <Check className="h-4 w-4 shrink-0" />
        <span>已作为档案照，可继续调整或直接填写资料</span>
      </div>
    </div>
  )
}
