import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ImagePlus,
  LoaderCircle,
  MapPin,
  RefreshCw,
  ScanText,
  Sparkles,
  X,
} from 'lucide-react'
import {
  analyzeEntry,
  type EntryAnalysis,
} from '../ai/analyzeEntry'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import { MOOD_OPTIONS } from '../types'

interface ComposeRouteState {
  mode?: 'photo' | 'text'
  imageUrl?: string
  imageFile?: File
  ocrText?: string
  fromCamera?: boolean
  fromConversation?: boolean
}

export function ComposePage() {
  const nav = useNavigate()
  const routeState = useLocation().state as ComposeRouteState | null
  const { currentToy, toys, setCurrentToyId, refreshEntries, showToast } =
    useApp()
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [location, setLocation] = useState('')
  const [userNote, setUserNote] = useState(routeState?.ocrText || '')
  const [imageUrl, setImageUrl] = useState<string | undefined>(routeState?.imageUrl)
  const [analysis, setAnalysis] = useState<EntryAnalysis | null>(null)
  const [title, setTitle] = useState('')
  const [aiDiary, setAiDiary] = useState('')
  const [mood, setMood] = useState('温柔')
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!currentToy && toys[0]) setCurrentToyId(toys[0].id)
  }, [currentToy, toys, setCurrentToyId])

  useEffect(() => {
    if (routeState?.imageUrl) setImageUrl(routeState.imageUrl)
    if (routeState?.mode === 'text') setImageUrl(undefined)
    if (routeState?.ocrText) setUserNote(routeState.ocrText)
  }, [routeState?.imageUrl, routeState?.mode, routeState?.ocrText])

  function onPickFile(file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      showToast('图片请小于 12MB')
      return
    }
    setImageUrl(URL.createObjectURL(file))
    setAnalysis(null)
  }

  async function onAnalyze(e?: FormEvent) {
    e?.preventDefault()
    if (!currentToy) {
      showToast('请先选择或创建玩偶')
      return
    }
    if (!imageUrl && !userNote.trim()) {
      showToast('上传一张照片，或者写下今天的故事吧')
      return
    }

    setAnalyzing(true)
    try {
      const result = await analyzeEntry({
        toy: currentToy,
        date,
        location: location.trim() || undefined,
        userNote: userNote.trim() || undefined,
        imageUrl,
      })
      setAnalysis(result)
      setTitle(result.title)
      setAiDiary(result.aiDiary)
      setMood(result.mood)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '分析失败，请重试')
    } finally {
      setAnalyzing(false)
    }
  }

  async function onSave() {
    if (!currentToy || !analysis) return
    if (!title.trim() || !aiDiary.trim()) {
      showToast('标题和玩偶日记不能为空')
      return
    }
    setSaving(true)
    try {
      await api.createEntry(currentToy.id, {
        type: analysis.entryType,
        date,
        location: location.trim() || undefined,
        title: title.trim(),
        userNote: userNote.trim() || undefined,
        mood,
        imageUrl: analysis.processedImageUrl || imageUrl,
        aiDiary: aiDiary.trim(),
        tags: analysis.tags,
        imageAnalysis: analysis.imageAnalysis,
      })
      await refreshEntries(currentToy.id)
      showToast(`${currentToy.name} 已把这一刻放进成长轨迹`)
      nav('/growth')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (!currentToy) {
    return (
      <>
        <PageHeader title="记录这一刻" back="/archive" soft />
        <div className="px-4 py-16 text-center text-sm text-ink-muted">
          请先在「玩偶」页创建一只玩偶
        </div>
      </>
    )
  }

  if (analysis) {
    return (
      <>
        <PageHeader title="玩偶写好了" back="/growth" soft />
        <main className="space-y-4 px-4 py-4">
          <section className="overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-mist-soft via-white to-mustard-soft p-4 shadow-[var(--shadow-warm)] ring-1 ring-line/50">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-lg shadow-sm">
                ✨
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium tracking-wider text-matcha-deep">
                  {currentToy.name} 的成长记录
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  {analysis.toyReply}
                </p>
              </div>
            </div>
          </section>

          {imageUrl && (
            <div className="overflow-hidden rounded-[1.25rem] bg-cream shadow-[var(--shadow-warm)] ring-1 ring-line/50">
              <img
                src={analysis.processedImageUrl || imageUrl}
                alt="本次成长记录"
                className="max-h-64 w-full object-cover"
              />
              {analysis.imageAnalysis && (
                <div className="flex items-start gap-2 bg-mist-soft/75 px-3.5 py-3 text-[11px] leading-relaxed text-matcha-deep">
                  <ScanText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong className="font-medium">照片理解：</strong>
                    {analysis.imageAnalysis}
                  </span>
                </div>
              )}
            </div>
          )}

          {userNote.trim() && (
            <div className="rounded-2xl bg-cream/80 px-3.5 py-3 text-xs leading-relaxed text-ink-soft ring-1 ring-line/60">
              <span className="font-medium text-ink-muted">你写下的：</span>
              {userNote.trim()}
            </div>
          )}

          <section className="card-paper space-y-4 p-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-soft">
                日记标题
              </span>
              <input
                className="input !rounded-2xl"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-soft">
                玩偶视角记录
              </span>
              <textarea
                className="input min-h-[210px] resize-none !rounded-2xl !leading-7"
                value={aiDiary}
                onChange={(event) => setAiDiary(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-soft">
                这一刻的心情
              </span>
              <select
                className="input !rounded-2xl"
                value={mood}
                onChange={(event) => setMood(event.target.value)}
              >
                {MOOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="mb-2 block text-xs font-medium text-ink-soft">
                自动标签
              </span>
              <div className="flex flex-wrap gap-2">
                {analysis.tags.map((tag) => (
                  <span key={tag} className="tag tag-mist">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAnalysis(null)}
              className="btn-secondary py-3 text-xs"
            >
              <ChevronLeft className="h-4 w-4" />
              返回修改
            </button>
            <button
              type="button"
              onClick={() => void onAnalyze()}
              disabled={analyzing}
              className="btn-secondary py-3 text-xs"
            >
              <RefreshCw className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
              重新生成
            </button>
          </div>

          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className="btn-primary w-full py-3.5 text-sm"
          >
            {saving ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                正在保存…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                保存到成长轨迹
              </>
            )}
          </button>
        </main>

        {analyzing && (
          <AnalyzingOverlay
            toyName={currentToy.name}
            hasImage={Boolean(imageUrl)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <PageHeader title="记录这一刻" back="/archive" soft />
      <form onSubmit={(event) => void onAnalyze(event)} className="space-y-5 px-4 py-4">
        <section className="rounded-[1.35rem] bg-gradient-to-br from-mustard-soft via-white to-mist-soft p-4 ring-1 ring-line/50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-terra-deep" />
            <strong className="font-display text-base text-ink">
              让{currentToy.name}写下这一刻
            </strong>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
            系统会理解照片和文字，再根据玩偶性格生成成长记录。
          </p>
        </section>

        {routeState?.fromConversation && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-mist-soft px-3.5 py-3 text-xs leading-relaxed text-matcha-deep">
            <span className="mt-0.5 shrink-0">✨</span>
            <span>
              已根据刚才的对话整理成草稿，你可以继续补充照片或文字。
            </span>
          </div>
        )}

        {imageUrl ? (
          <div className="card-paper overflow-hidden p-0">
            <div className="relative overflow-hidden bg-cream-dark">
              <img
                src={imageUrl}
                alt="已选照片"
                className="max-h-64 w-full object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setImageUrl(undefined)
                  setAnalysis(null)
                }}
                className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-ink/75 text-white shadow-md backdrop-blur-sm transition-transform active:scale-95"
                aria-label="移除照片"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {routeState?.fromCamera && (
              <div className="flex items-center gap-2 bg-mist-soft/80 px-3.5 py-2.5 text-[10px] text-matcha-deep">
                <ScanText className="h-3.5 w-3.5 shrink-0" />
                {routeState.ocrText
                  ? '已识别照片中的文字，可继续补充今天发生的事情'
                  : '照片已拍摄完成，可以补充这一刻的故事'}
              </div>
            )}
          </div>
        ) : (
          <div className="card-paper p-4">
            <span className="mb-2.5 block text-xs font-medium text-ink-soft">
              照片（可选）
            </span>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-line/80 bg-cream/50 py-10 text-ink-muted transition-colors active:bg-cream">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-mustard-soft to-peach-soft text-matcha-deep shadow-[var(--shadow-warm-sm)]">
                <ImagePlus className="h-6 w-6" />
              </span>
              <span className="text-sm font-medium">添加一张照片</span>
              <span className="text-[11px] text-ink-muted">
                系统会分析场景、色彩和画面氛围
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => onPickFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        )}

        <section className="card-paper space-y-5 p-4">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">
              关联玩偶
            </span>
            <select
              className="input !rounded-2xl"
              value={currentToy.id}
              onChange={(event) => {
                setCurrentToyId(event.target.value)
                setAnalysis(null)
              }}
            >
              {toys.map((toy) => (
                <option key={toy.id} value={toy.id}>
                  {toy.name} · {toy.traits.slice(0, 2).join('、')}
                </option>
              ))}
            </select>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">
              日期
            </span>
            <input
              type="date"
              className="input !rounded-2xl"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">
              地点（可选）
            </span>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                className="input !rounded-2xl !pl-10"
                placeholder="例如：海边、鼓浪屿"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">
              今天发生了什么
            </span>
            <textarea
              className="input min-h-[130px] resize-none !rounded-2xl"
              placeholder="例如：今天带熊看日落，但是心情不好…"
              value={userNote}
              onChange={(event) => setUserNote(event.target.value)}
            />
            <span className="mt-1.5 block text-[10px] text-ink-muted">
              文字中明确表达的心情会优先作为生成依据。
            </span>
          </label>
        </section>

        <button
          type="submit"
          disabled={analyzing}
          className="btn-primary w-full py-3.5 text-sm"
        >
          {analyzing ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              正在理解这一刻…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              让玩偶写下来
            </>
          )}
        </button>
      </form>

      {analyzing && (
        <AnalyzingOverlay toyName={currentToy.name} hasImage={Boolean(imageUrl)} />
      )}
    </>
  )
}

function AnalyzingOverlay({
  toyName,
  hasImage,
}: {
  toyName: string
  hasImage: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/45 px-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <section className="w-full max-w-[330px] rounded-[1.75rem] bg-white p-5 text-center shadow-2xl">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-mustard-soft to-mist-soft">
          <Sparkles className="h-7 w-7 animate-pulse text-matcha-deep" />
        </span>
        <h2 className="mt-4 font-display text-lg text-ink">
          {toyName} 正在回想这一刻
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          {hasImage
            ? '正在理解照片场景、文字和你的心情…'
            : '正在理解文字，再用玩偶的方式写下来…'}
        </p>
        <div className="mx-auto mt-4 h-1.5 w-32 overflow-hidden rounded-full bg-cream-dark">
          <span className="block h-full w-2/3 animate-pulse rounded-full bg-matcha" />
        </div>
      </section>
    </div>
  )
}
