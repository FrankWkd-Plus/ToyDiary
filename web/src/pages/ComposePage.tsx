import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  ScanText,
  Sparkles,
  X,
} from 'lucide-react'
import { analyzeEntry, type EntryAnalysis } from '../ai/analyzeEntry'
import { api } from '../api/client'
import { PlacePicker } from '../components/PlacePicker'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import {
  COMPOSE_ENTRY_TYPES,
  ENTRY_TYPE_LABEL,
  MOOD_OPTIONS,
  type EntryType,
  type Place,
} from '../types'

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
  const [entryType, setEntryType] = useState<EntryType>('daily')
  const [place, setPlace] = useState<Place | undefined>()
  const [userNote, setUserNote] = useState(routeState?.ocrText || '')
  const [imageUrl, setImageUrl] = useState<string | undefined>(routeState?.imageUrl)
  const [aiEnabled, setAiEnabled] = useState(true)
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
    if (entryType === 'travel' && !place) {
      showToast('旅行记录需要选择地点')
      return
    }
    if (!imageUrl && !userNote.trim()) {
      showToast('上传一张照片，或者写下今天的故事吧')
      return
    }

    setAnalyzing(true)
    try {
      if (aiEnabled) {
        const result = await analyzeEntry({
          toy: currentToy,
          date,
          location: place?.displayName,
          userNote: userNote.trim() || undefined,
          imageUrl,
        })
        // Respect user-selected type (heart maps to daily for AI if needed)
        setAnalysis({
          ...result,
          entryType:
            entryType === 'heart'
              ? 'daily'
              : entryType === 'text'
                ? result.entryType
                : entryType,
        })
        setTitle(result.title)
        setAiDiary(result.aiDiary)
        setMood(result.mood)
        if (result.source === 'local') {
          showToast('AI 暂时不可用，已用本地模板生成')
        }
      } else {
        const fallbackTitle =
          userNote.trim().slice(0, 18) ||
          (place ? `${place.city || place.displayName}的一天` : '今天的小记录')
        const fallbackDiary =
          `${date}，${place?.displayName || '某个温柔的地方'}。\n\n` +
          (userNote.trim()
            ? `主人说：${userNote.trim()}\n\n`
            : '') +
          `我是${currentToy.name}，把这一刻悄悄收进绒毛里。`
        const local: EntryAnalysis = {
          title: fallbackTitle,
          aiDiary: fallbackDiary,
          toyReply: '好呀，我已经准备好把这一刻记下来啦。',
          mood,
          tags: [ENTRY_TYPE_LABEL[entryType], place?.city || '日常'].filter(Boolean),
          entryType: entryType === 'heart' ? 'daily' : entryType,
          processedImageUrl: imageUrl,
          source: 'local',
        }
        setAnalysis(local)
        setTitle(local.title)
        setAiDiary(local.aiDiary)
      }
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
    if (entryType === 'travel' && !place) {
      showToast('旅行记录需要地点')
      return
    }
    setSaving(true)
    try {
      const savedType: EntryType =
        entryType === 'heart' ? 'daily' : analysis.entryType || entryType
      await api.createEntry(currentToy.id, {
        type: savedType,
        date,
        location: place?.displayName,
        place,
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
      nav(place ? '/growth?tab=map' : '/growth')
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
          请先在档案页创建一只玩偶
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
                  {analysis.source === 'local' ? ' · 本地模板' : ' · AI'}
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
            </div>
          )}

          {place && (
            <div className="rounded-2xl bg-mist-soft px-3.5 py-2.5 text-xs text-matcha-deep">
              📍 {place.displayName}
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
              className="btn-secondary flex items-center justify-center gap-1.5 py-3 text-xs disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
              {analyzing ? '生成中…' : '重新生成'}
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
            选择类型与地点，再让玩偶用第一视角记下来。
          </p>
        </section>

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
                className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-ink/75 text-white shadow-md"
                aria-label="移除照片"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {routeState?.fromCamera && (
              <div className="flex items-center gap-2 bg-mist-soft/80 px-3.5 py-2.5 text-[10px] text-matcha-deep">
                <ScanText className="h-3.5 w-3.5 shrink-0" />
                照片已准备好，可继续补充故事
              </div>
            )}
          </div>
        ) : (
          <div className="card-paper p-4">
            <span className="mb-2.5 block text-xs font-medium text-ink-soft">
              照片（可选）
            </span>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-line/80 bg-cream/50 py-10 text-ink-muted">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-mustard-soft to-peach-soft text-matcha-deep">
                <ImagePlus className="h-6 w-6" />
              </span>
              <span className="text-sm font-medium">添加一张照片</span>
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
                  {toy.name}
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

          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">
              类型
            </span>
            <div className="flex flex-wrap gap-2">
              {COMPOSE_ENTRY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEntryType(t)}
                  className={entryType === t ? 'chip chip-active' : 'chip'}
                >
                  {ENTRY_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <PlacePicker
            value={place}
            onChange={setPlace}
            required={entryType === 'travel'}
          />

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-soft">
              今天发生了什么
            </span>
            <textarea
              className="input min-h-[130px] resize-none !rounded-2xl"
              placeholder="例如：今天带熊看日落…"
              value={userNote}
              onChange={(event) => setUserNote(event.target.value)}
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-2xl bg-cream/80 px-3.5 py-3">
            <span className="text-xs text-ink-soft">
              <strong className="text-ink">AI 生成玩偶日记</strong>
              <span className="mt-0.5 block text-[10px] text-ink-muted">
                关闭后使用本地模板，保证演示不中断
              </span>
            </span>
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="h-5 w-5 accent-[var(--color-matcha)]"
            />
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
              {aiEnabled ? '让玩偶写下来' : '用模板生成并预览'}
            </>
          )}
        </button>
      </form>

      {analyzing && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/45 px-6 backdrop-blur-sm"
          role="status"
        >
          <section className="w-full max-w-[330px] rounded-[1.75rem] bg-white p-5 text-center shadow-2xl">
            <Sparkles className="mx-auto h-8 w-8 animate-pulse text-matcha-deep" />
            <h2 className="mt-3 font-display text-lg text-ink">
              {currentToy.name} 正在写日记…
            </h2>
          </section>
        </div>
      )}
    </>
  )
}
