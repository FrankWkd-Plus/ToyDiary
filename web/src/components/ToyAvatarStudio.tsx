import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  Check,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import {
  createFallbackAvatar,
  createStickerAvatar,
  PREVIEW_BG,
  type StickerBorder,
  type StickerPreviewBg,
} from '../image/createStickerAvatar'
import {
  progressLabel,
  removeToyBackground,
  type RemoveBgProgress,
} from '../image/removeToyBackground'

type Stage = 'pick' | 'processing' | 'confirm'

/**
 * Upload → local AI cutout → white sticker border → confirm avatar.
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
  const [progress, setProgress] = useState<RemoveBgProgress | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(value)
  const [border, setBorder] = useState<StickerBorder>('standard')
  const [previewBg, setPreviewBg] = useState<StickerPreviewBg>('cream')
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  )
  const rebuildToken = useRef(0)
  const skipRef = useRef(false)

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
      } catch (err) {
        console.warn(err)
        onToast('生成贴纸失败，请重试')
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
    skipRef.current = false
    setSourceFile(file)
    setStage('processing')
    setProgress({
      phase: 'import',
      progress: 0.03,
      detail: '即将下载约 40MB 最小模型（仅首次）',
    })
    setOffset({ x: 0, y: 0 })
    setZoom(1)

    const result = await removeToyBackground(file, (p) => {
      if (!skipRef.current) setProgress(p)
    })
    if (skipRef.current) return

    setCutoutBlob(result.blob)
    setRemoved(result.removed)
    if (result.fallback) {
      onToast(result.message || '抠图失败，已切换原图裁切')
    }

    setProgress({ phase: 'done', progress: 0.95, detail: '生成贴纸…' })
    await rebuildPreview(result.blob, {
      border,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      useSticker: true,
    })
    if (skipRef.current) return
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
      })
    }, 80)
    return () => window.clearTimeout(t)
  }, [border, zoom, offset.x, offset.y, cutoutBlob, stage, rebuildPreview])

  async function applyOriginalOnly() {
    const file = sourceFile
    if (!file) {
      onToast('请先选择照片')
      return
    }
    skipRef.current = true
    setStage('processing')
    setProgress({ phase: 'fallback', progress: 0.6, detail: '使用原图生成贴纸…' })
    setCutoutBlob(file)
    setRemoved(false)
    await rebuildPreview(file, {
      border,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      useSticker: true,
    })
    setStage('confirm')
    setProgress(null)
    onToast('已跳过 AI 抠图，使用原图贴纸')
  }

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
          本地 AI 抠图 · 最小模型约 40MB（仅首次下载）· AGPL 演示用
        </p>
      </div>
    )
  }

  if (stage === 'processing') {
    const pct = Math.round((progress?.progress ?? 0.08) * 100)
    const label = progress ? progressLabel(progress) : '正在处理…'
    const detail = progress?.detail
    return (
      <div className="card-paper space-y-3 p-5 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mist-soft text-matcha-deep">
          <LoaderCircle className="h-7 w-7 animate-spin" />
        </span>
        <p className="font-display text-base text-ink">{label}</p>
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
          使用最小量化模型 <code className="text-[9px]">isnet_quint8</code>
          （约 40MB）。首次需从 CDN 下载，完成后浏览器会缓存；弱网可能要 1–3 分钟。
          等不及可点下方跳过。
        </p>
        <button
          type="button"
          onClick={() => {
            if (sourceFile) void applyOriginalOnly()
          }}
          className="btn-secondary mx-auto py-2 px-4 text-xs"
        >
          跳过抠图，直接用原图
        </button>
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
          <p className="font-display text-base text-ink">现在的档案照</p>
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
          {removed ? '贴纸头像预览' : '原图贴纸预览'}
        </div>
        <button
          type="button"
          onClick={() => {
            setStage('pick')
            setCutoutBlob(null)
            setSourceFile(null)
            setPreviewUrl(value)
          }}
          className="text-[10px] text-ink-muted"
        >
          重选照片
        </button>
      </div>

      <div
        className="relative mx-auto flex h-56 w-56 touch-none items-center justify-center overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-warm)] ring-1 ring-line/50"
        style={{
          background:
            previewBg === 'transparent'
              ? 'repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 16px 16px'
              : PREVIEW_BG[previewBg],
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

      <div>
        <span className="mb-1.5 block text-[10px] text-ink-muted">预览背景</span>
        <div className="flex gap-2">
          {(
            [
              ['transparent', '透明'],
              ['cream', '奶油白'],
              ['mint', '淡绿色'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPreviewBg(id)}
              className={previewBg === id ? 'chip chip-soft-active' : 'chip'}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={() => void applyOriginalOnly()}
          className="btn-secondary py-2.5 text-xs"
        >
          <X className="h-3.5 w-3.5" />
          使用原图
        </button>
        <button
          type="button"
          onClick={() => {
            if (sourceFile) void processFile(sourceFile)
          }}
          className="btn-secondary py-2.5 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          重新抠图
        </button>
      </div>

      <button
        type="button"
        disabled={!previewUrl}
        onClick={() => {
          if (!previewUrl) return
          onConfirm(previewUrl)
          onToast('头像已确认')
        }}
        className="btn-primary w-full py-3 text-sm"
      >
        <Check className="h-4 w-4" />
        确认作为头像
      </button>
    </div>
  )
}
