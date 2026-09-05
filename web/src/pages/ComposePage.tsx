import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ImagePlus,
  LoaderCircle,
  ScanText,
  Sparkles,
  X,
} from 'lucide-react'
import { analyzeEntry, summarizeEntryTitle } from '../ai/analyzeEntry'
import { api } from '../api/client'
import { PlacePicker } from '../components/PlacePicker'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import { useLocale } from '../i18n'
import {
  deletePersistedDiaryPhoto,
  persistDiaryPhoto,
} from '../media/photoStorage'
import {
  COMPOSE_ENTRY_TYPES,
  entryTypeLabel,
  type EntryType,
  type Entry,
  type Place,
} from '../types'

interface ComposeRouteState {
  mode?: 'photo' | 'text'
  imageUrl?: string
  imageFile?: File
  nativeImageUri?: string
  ocrText?: string
  fromCamera?: boolean
  fromConversation?: boolean
  /** Opens the regular compose form with an existing diary prefilled. */
  editEntry?: Entry
  from?: string
}

export function ComposePage() {
  const nav = useNavigate()
  const { locale } = useLocale()
  const routeState = useLocation().state as ComposeRouteState | null
  const { currentToy, toys, setCurrentToyId, refreshEntries, showToast } =
    useApp()
  const editingEntry = routeState?.editEntry
  const [date, setDate] = useState(
    () => editingEntry?.date || new Date().toISOString().slice(0, 10),
  )
  const [entryType, setEntryType] = useState<EntryType>(
    () => editingEntry?.type || 'daily',
  )
  const [place, setPlace] = useState<Place | undefined>(() => editingEntry?.place)
  const [userNote, setUserNote] = useState(
    () => editingEntry?.userNote || routeState?.ocrText || '',
  )
  const [imageUrl, setImageUrl] = useState<string | undefined>(
    () => editingEntry?.imageUrl || routeState?.imageUrl,
  )
  const [imageFile, setImageFile] = useState<File | undefined>(routeState?.imageFile)
  const [nativeImageUri, setNativeImageUri] = useState<string | undefined>(
    routeState?.nativeImageUri,
  )
  const [title, setTitle] = useState(() => editingEntry?.title || '')
  const [aiDiary, setAiDiary] = useState(() => editingEntry?.aiDiary || '')
  const [mood, setMood] = useState(() => editingEntry?.mood || '温柔')
  const [imageRemoved, setImageRemoved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!currentToy && toys[0]) setCurrentToyId(toys[0].id)
  }, [currentToy, toys, setCurrentToyId])

  useEffect(() => {
    if (editingEntry?.toyId && editingEntry.toyId !== currentToy?.id) {
      setCurrentToyId(editingEntry.toyId)
    }
  }, [editingEntry?.toyId, currentToy?.id, setCurrentToyId])

  useEffect(() => {
    if (routeState?.imageUrl) setImageUrl(routeState.imageUrl)
    if (routeState?.imageFile) setImageFile(routeState.imageFile)
    if (routeState?.nativeImageUri) setNativeImageUri(routeState.nativeImageUri)
    if (routeState?.mode === 'text') setImageUrl(undefined)
    if (routeState?.ocrText) setUserNote(routeState.ocrText)
  }, [
    routeState?.imageFile,
    routeState?.imageUrl,
    routeState?.mode,
    routeState?.nativeImageUri,
    routeState?.ocrText,
  ])

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
    setImageFile(file)
    setNativeImageUri(undefined)
    setImageRemoved(false)
  }

  async function onCreate(e?: FormEvent) {
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

    setSaving(true)
    let persistedPhoto: Awaited<ReturnType<typeof persistDiaryPhoto>>
    let createdEntry: Entry | undefined
    try {
      // The user's original photo and words are committed first. Diary
      // generation enriches that record afterwards and can never block it.
      persistedPhoto = await persistDiaryPhoto({
        file: imageFile,
        nativeUri: nativeImageUri,
        previewUrl: imageUrl,
      })
      const savedType: EntryType = entryType === 'heart' ? 'daily' : entryType
      const provisionalTitle = summarizeEntryTitle({
        note: userNote.trim(),
        location: place?.displayName,
        toyName: currentToy.name,
        hasImage: Boolean(imageUrl),
        locale,
      })
      createdEntry = await api.createEntry(currentToy.id, {
        type: savedType,
        date,
        location: place?.displayName,
        place,
        title: provisionalTitle,
        userNote: userNote.trim() || undefined,
        mood: locale === 'en' ? 'gentle' : '温柔',
        imageUrl: persistedPhoto?.url,
        localImagePath: persistedPhoto?.nativePath,
        aiDiary: userNote.trim() || provisionalTitle,
        tags: [entryTypeLabel(savedType, locale)],
      })

      try {
        const result = await analyzeEntry({
          toy: currentToy,
          date,
          location: place?.displayName,
          userNote: userNote.trim() || undefined,
          imageUrl,
          locale,
        })
        createdEntry = await api.updateEntry(createdEntry.id, {
          title: result.title,
          aiDiary: result.aiDiary,
          mood: result.mood,
          tags: result.tags,
          imageAnalysis: result.imageAnalysis,
        })
      } catch (generationError) {
        console.warn('[ComposePage] diary generation failed:', generationError)
        showToast('原始记录已保存，玩偶日记可稍后重新生成')
      }

      await refreshEntries(currentToy.id)
      showToast(`${currentToy.name} 已把这一刻存进本机手帐`)
      nav(`/entries/${createdEntry.id}`, {
        replace: true,
        state: { from: 'growth-timeline' },
      })
    } catch (error) {
      // If the durable file was written but no entry owns it, clean it up.
      if (!createdEntry && persistedPhoto?.nativePath) {
        await deletePersistedDiaryPhoto(persistedPhoto.nativePath)
      }
      showToast(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function onSaveEdit() {
    if (!editingEntry || !currentToy) return
    if (entryType === 'travel' && !place) {
      showToast('旅行记录需要地点')
      return
    }
    setSaving(true)
    try {
      const nextPhoto = imageFile || nativeImageUri
        ? await persistDiaryPhoto({
            file: imageFile,
            nativeUri: nativeImageUri,
            previewUrl: imageUrl,
          })
        : undefined
      await api.updateEntry(editingEntry.id, {
        toyId: currentToy.id,
        type: entryType,
        date,
        location: place?.displayName,
        place,
        title: title.trim() || undefined,
        aiDiary: aiDiary.trim() || undefined,
        mood: mood.trim() || undefined,
        userNote: userNote.trim() || undefined,
        imageUrl: imageRemoved
          ? undefined
          : nextPhoto?.url ||
            (editingEntry.localImagePath
              ? `toydiary-media://${editingEntry.localImagePath}`
              : imageUrl),
        localImagePath: imageRemoved
          ? undefined
          : nextPhoto?.nativePath || editingEntry.localImagePath,
      })
      if (
        (imageRemoved || nextPhoto?.nativePath) &&
        editingEntry.localImagePath !== nextPhoto?.nativePath
      ) {
        await deletePersistedDiaryPhoto(editingEntry.localImagePath)
      }
      await refreshEntries(currentToy.id)
      showToast('日志修改已保存')
      nav(routeState?.from || `/entries/${editingEntry.id}`, { replace: true })
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (!currentToy) {
    return (
      <>
        <PageHeader title={editingEntry ? '编辑日志' : '记录这一刻'} back={routeState?.from || '/archive'} soft />
        <div className="px-4 py-16 text-center text-sm text-ink-muted">
          请先在档案页创建一只玩偶
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title={editingEntry ? '编辑日志' : '记录这一刻'} back={routeState?.from || '/archive'} soft />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (editingEntry) void onSaveEdit()
          else void onCreate()
        }}
        className="space-y-5 px-4 py-4"
      >
        <section className="rounded-[1.35rem] bg-gradient-to-br from-mustard-soft via-white to-mist-soft p-4 ring-1 ring-line/50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-terra-deep" />
            <strong className="font-display text-base text-ink">
              {editingEntry ? `修改和${currentToy.name}的这一刻` : '写下这一刻'}
            </strong>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
            {editingEntry
              ? '修改原始记录后保存；玩偶日记不会自动改写。'
              : `照片和文字会先安全保存，${currentToy.name}会自动整理成日记。`}
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
                  setImageFile(undefined)
                  setNativeImageUri(undefined)
                  setImageRemoved(true)
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
              onChange={(event) => setCurrentToyId(event.target.value)}
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
              {COMPOSE_ENTRY_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEntryType(type)}
                  className={entryType === type ? 'chip chip-active' : 'chip'}
                >
                  {entryTypeLabel(type, locale)}
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

          {editingEntry && (
            <div className="space-y-4 border-t border-line/60 pt-5">
              <p className="text-[11px] font-medium tracking-wide text-ink-muted">
                日记呈现
              </p>
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
                  玩偶视角
                </span>
                <textarea
                  className="input min-h-[150px] resize-none !rounded-2xl !leading-7"
                  value={aiDiary}
                  onChange={(event) => setAiDiary(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-ink-soft">
                  心情
                </span>
                <input
                  className="input !rounded-2xl"
                  value={mood}
                  onChange={(event) => setMood(event.target.value)}
                />
              </label>
            </div>
          )}
        </section>

        <button
          type="submit"
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
              <Sparkles className="h-4 w-4" />
              {editingEntry ? '保存修改' : '保存并生成日志'}
            </>
          )}
        </button>
      </form>
    </>
  )
}
