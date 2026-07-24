import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Heart, MapPin, Sparkles } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import type { Entry } from '../types'

export function GrowthPage() {
  const {
    currentToy,
    entries,
    toys,
    setCurrentToyId,
    showToast,
  } = useApp()
  const [pickerOpen, setPickerOpen] = useState(false)
  const selectableToys = toys

  useEffect(() => {
    if (
      selectableToys.length > 0 &&
      !selectableToys.some((toy) => toy.id === currentToy?.id)
    ) {
      setCurrentToyId(selectableToys[0].id)
    }
  }, [currentToy?.id, selectableToys, setCurrentToyId])

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  return (
    <>
      <PageHeader
        title="成长轨迹"
        subtitle="和玩偶一起走过的日子"
        soft
      />

      <div className="px-3.5 pb-5 pt-3">
        <div className="relative mb-3 flex items-center justify-between gap-3">
          <div className="growth-toy-bubble">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-sm shadow-sm">
              🧸
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] text-ink-muted">正在查看</span>
              <strong className="block max-w-36 truncate text-xs text-ink">
                {currentToy?.name || '请选择玩偶'}
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-white px-3 py-2 text-xs font-medium text-matcha-deep shadow-[var(--shadow-warm-sm)] active:scale-95 transition-transform"
            aria-expanded={pickerOpen}
            aria-haspopup="listbox"
          >
            选择玩偶
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${pickerOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {pickerOpen && (
            <div
              className="absolute right-0 top-12 z-20 w-48 overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-[var(--shadow-elevated)]"
              role="listbox"
              aria-label="选择要查看的玩偶"
            >
              {selectableToys.map((toy) => {
                const selected = toy.id === currentToy?.id
                return (
                  <button
                    key={toy.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setCurrentToyId(toy.id)
                      setPickerOpen(false)
                      showToast(`已切换到 ${toy.name}的成长轨迹`)
                    }}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm ${
                      selected
                        ? 'bg-mist-soft font-medium text-matcha-deep'
                        : 'text-ink-soft active:bg-cream'
                    }`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm shadow-sm">
                      🧸
                    </span>
                    <span className="min-w-0 flex-1 truncate">{toy.name}</span>
                    {selected && <Check className="h-4 w-4" strokeWidth={2.5} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {sortedEntries.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mist-soft text-matcha-deep">
              <Sparkles className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-display text-lg text-ink">还没有成长轨迹</h2>
            <p className="mt-1 text-sm text-ink-muted">记下一个瞬间，故事就从这里开始。</p>
            <Link to="/compose" className="btn-primary mt-5 px-5 py-2.5 text-sm">
              新建记录
            </Link>
          </div>
        ) : (
          <div className="growth-timeline">
            {sortedEntries.map((entry, index) => (
              <TimelineItem key={entry.id} entry={entry} isFirst={index === 0} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function TimelineItem({ entry, isFirst }: { entry: Entry; isFirst: boolean }) {
  const { monthDay, year } = splitDate(entry.date)
  const hasImage = Boolean(entry.imageUrl)
  const hasUserText = Boolean(entry.title?.trim() || entry.userNote?.trim())
  const imageOnly = hasImage && !hasUserText
  const text = entry.aiDiary?.trim() || entry.userNote?.trim()

  return (
    <article className="growth-row">
      <div className="growth-date">
        <time dateTime={entry.date}>
          <span className="block font-display text-[15px] leading-none text-ink">{monthDay}</span>
          <span className="mt-1 block text-[9px] text-ink-muted">{year}</span>
        </time>
      </div>

      <div className={`growth-dot ${isFirst ? 'growth-dot-current' : ''}`} />

      <Link
        to={`/entries/${entry.id}`}
        className={`growth-entry-card ${imageOnly ? 'growth-entry-card--image-only' : ''}`}
      >
        {hasImage && (
          <div className={imageOnly ? 'growth-entry-image growth-entry-image--only' : 'growth-entry-image'}>
            <img src={entry.imageUrl} alt={entry.title || '成长记录'} />
            {imageOnly && entry.location && (
              <span className="growth-image-location">
                <MapPin className="h-3 w-3" />
                {entry.location}
              </span>
            )}
          </div>
        )}

        {!imageOnly && (
          <div className="p-3.5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="min-w-0 flex-1 font-medium leading-snug text-ink">
                {entry.title || (hasImage ? '这一刻，想和你分享' : '写给你的话')}
              </h2>
              {entry.mood && (
                <span className="shrink-0 rounded-full bg-mustard-soft px-2 py-1 text-[10px] text-ink-soft">
                  {moodEmoji(entry.mood)} {entry.mood}
                </span>
              )}
            </div>

            {entry.location && (
              <p className="mt-2 flex items-center gap-1 text-[11px] text-ink-muted">
                <MapPin className="h-3.5 w-3.5 text-matcha-deep" />
                {entry.location}
              </p>
            )}

            {text && (
              <p className={`mt-2 text-[13px] leading-relaxed text-ink-soft ${hasImage ? 'line-clamp-2' : 'line-clamp-4'}`}>
                {text}
              </p>
            )}

            {entry.tags && entry.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {entry.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-mist-soft px-2 py-0.5 text-[9px] text-matcha-deep"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {!hasImage && (
              <div className="mt-3 flex items-center gap-1 text-[10px] text-matcha-deep">
                <Heart className="h-3 w-3 fill-current" />
                纯文字记录
              </div>
            )}
          </div>
        )}
      </Link>
    </article>
  )
}

function splitDate(date: string) {
  const [year, month, day] = date.split('-')
  return { year, monthDay: `${Number(month)}/${Number(day)}` }
}

function moodEmoji(mood: string) {
  const emojis: Record<string, string> = {
    '开心': '☀️',
    '平静': '🌿',
    '好奇': '✨',
    '想家': '🏠',
    '兴奋': '🎉',
    '温柔': '🌙',
  }
  return emojis[mood] || '💭'
}
