import {
  CalendarDays,
  Camera,
  ChevronRight,
  MessageCircle,
  Pencil,
  Quote,
  Sparkles,
} from 'lucide-react'
import { companionDays, toySignature } from '../archive/archiveUtils'
import { uniqueCities } from '../places/placeUtils'
import type { Entry, Place, Toy } from '../types'

export interface ToyHighlightShot {
  src: string
  /** Real diary entry — clickable when present */
  entryId?: string
  title?: string
}

export interface ToyCardPhotos {
  profile: string
  highlights: ToyHighlightShot[]
}

export function ToyCard({
  toy,
  photos,
  onOpenConversation,
  onOpenHighlight,
  chatPreview,
  entries,
  onEditToy,
}: {
  toy: Toy
  photos: ToyCardPhotos
  onOpenConversation: () => void
  /** Open a highlight photo's diary entry (if it has an entryId) */
  onOpenHighlight?: (entryId: string) => void
  chatPreview: string
  entries: Entry[]
  onEditToy: () => void
}) {
  const cityCount = uniqueCities(
    entries
      .map((entry) => entry.place)
      .filter((place): place is Place => Boolean(place)),
  ).length
  const days = companionDays(toy)
  const captions = ['出发', '看海', '收藏风景'] as const

  return (
    <article
      className="toy-id-card"
      aria-label={`${toy.name}的玩偶身份卡`}
    >
      <div className="toy-id-card__topbar">
        <span className="flex gap-1.5" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="font-display text-sm tracking-[0.18em] text-white/90">
          ID CARD
        </span>
      </div>

      <div className="p-3.5 pb-4">
        <section className="grid grid-cols-[42%_1fr] gap-3">
          <div className="min-w-0">
            <button
              type="button"
              className="toy-profile-photo group relative block w-full text-left"
              onClick={(event) => {
                event.stopPropagation()
                onEditToy()
              }}
              aria-label={`编辑${toy.name}的档案`}
            >
              <img src={photos.profile} alt={`${toy.name}的介绍照`} />
              <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-semibold text-matcha-deep shadow-sm">
                MY TOY
              </span>
              <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/92 text-matcha-deep shadow-sm ring-1 ring-line/50 transition-transform group-active:scale-90">
                <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
              </span>
            </button>
          </div>

          <div className="min-w-0 py-0.5">
            <h2 className="font-display truncate text-[1.35rem] leading-none text-ink">
              {toy.name}
            </h2>

            <div className="toy-sketch-line" />

            <p className="text-[11px] font-semibold text-matcha-deep">
              {toy.zodiac || '神秘星座'}
            </p>

            <div className="mt-2 flex flex-wrap gap-1">
              {toy.traits.slice(0, 4).map((trait) => (
                <span
                  key={trait}
                  className="rounded-full bg-mist-soft px-2 py-0.5 text-[9px] font-medium text-matcha-deep"
                >
                  #{trait}
                </span>
              ))}
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-[10px] text-ink-muted">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-matcha-deep" />
              出生日期 {toy.birthDate.replaceAll('-', '.')}
            </p>
            <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-cream px-2 py-1.5 text-[10px] leading-4 text-ink-soft ring-1 ring-line/35">
              <Quote className="mt-0.5 h-3 w-3 shrink-0 text-terra-deep" />
              <span className="line-clamp-2">{toySignature(toy)}</span>
            </p>
          </div>
        </section>

        <button
          type="button"
          className="toy-chat-bubble"
          onClick={(event) => {
            event.stopPropagation()
            onOpenConversation()
          }}
          aria-label={`进入和${toy.name}的对话`}
        >
          <span className="toy-chat-bubble__icon" aria-hidden="true">
            <MessageCircle className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="toy-chat-bubble__content">
            <span className="toy-chat-bubble__label">{toy.name} 刚刚说</span>
            <span className="toy-chat-bubble__message">“{chatPreview}”</span>
          </span>
          <span className="toy-chat-bubble__action">
            去聊聊
            <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
          </span>
        </button>

        <section
          className="mt-4 grid grid-cols-3 gap-2"
          aria-label={`${toy.name}的陪伴数据`}
        >
          <ToyStat value={entries.length} label="日志" tone="peach" />
          <ToyStat value={cityCount} label="城市" tone="mist" />
          <ToyStat value={days} label="陪伴" suffix="天" tone="mustard" />
        </section>

        <section className="mt-4">
          <div className="flex items-center justify-center gap-2">
            <Camera className="h-4 w-4 text-matcha-deep" />
            <h3 className="font-display text-base tracking-wide text-ink">
              高光时刻
            </h3>
            <Sparkles className="h-3.5 w-3.5 text-mustard" />
          </div>

          <div className="toy-photo-line" aria-hidden="true" />
          {photos.highlights.length > 0 ? (
            <div className="toy-highlights">
              {photos.highlights.map((shot, index) => {
              const clickable = Boolean(shot.entryId && onOpenHighlight)
              const label =
                shot.title?.trim() || captions[index] || `高光 ${index + 1}`
              return (
                <figure
                  key={`${shot.src}-${shot.entryId || index}`}
                  className={`toy-polaroid toy-polaroid--${index + 1}${
                    clickable ? ' toy-polaroid--clickable' : ''
                  }`}
                >
                  <span className="toy-photo-clip" aria-hidden="true" />
                  {clickable ? (
                    <button
                      type="button"
                      className="toy-polaroid__hit"
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpenHighlight?.(shot.entryId!)
                      }}
                      aria-label={`查看「${label}」的日记`}
                    >
                      <div className="toy-polaroid__image">
                        <img
                          src={shot.src}
                          alt={`${toy.name}的高光时刻 · ${label}`}
                        />
                      </div>
                      <span className="toy-polaroid__caption">{label}</span>
                    </button>
                  ) : (
                    <>
                      <div className="toy-polaroid__image">
                        <img
                          src={shot.src}
                          alt={`${toy.name}的高光时刻 · ${label}`}
                        />
                      </div>
                      <figcaption>{label}</figcaption>
                    </>
                  )}
                </figure>
              )
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-line bg-cream/55 px-4 py-5 text-center">
              <p className="text-xs font-medium text-ink-soft">还没有高光时刻</p>
              <p className="mt-1 text-[10px] leading-4 text-ink-muted">
                通过「+」记录带照片的故事后，会出现在这里
              </p>
            </div>
          )}
        </section>

      </div>
    </article>
  )
}

function ToyStat({
  value,
  label,
  suffix,
  tone,
}: {
  value: number
  label: string
  suffix?: string
  tone: 'peach' | 'mist' | 'mustard'
}) {
  const toneClass = {
    peach: 'bg-peach-soft text-rose-deep',
    mist: 'bg-mist-soft text-matcha-deep',
    mustard: 'bg-mustard-soft text-terra-deep',
  }[tone]

  return (
    <div className={`rounded-2xl px-2 py-2.5 text-center ${toneClass}`}>
      <p className="font-display text-xl leading-none">
        {value}
        {suffix && <span className="ml-0.5 text-[9px] font-sans">{suffix}</span>}
      </p>
      <p className="mt-1 text-[10px] font-medium tracking-wide">{label}</p>
    </div>
  )
}
