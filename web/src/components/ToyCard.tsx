import {
  CalendarDays,
  Camera,
  ChevronRight,
  MessageCircle,
  Sparkles,
} from 'lucide-react'
import { companionDays } from '../archive/archiveUtils'
import { uniqueCities } from '../places/placeUtils'
import type { Entry, Place, Toy } from '../types'

export interface ToyCardPhotos {
  profile: string
  highlights: [string, string, string]
}

export function ToyCard({
  toy,
  photos,
  onOpenConversation,
  chatPreview,
  entries,
}: {
  toy: Toy
  photos: ToyCardPhotos
  onOpenConversation: () => void
  chatPreview: string
  entries: Entry[]
}) {
  const cityCount = uniqueCities(
    entries
      .map((entry) => entry.place)
      .filter((place): place is Place => Boolean(place)),
  ).length
  const days = companionDays(toy)

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
            <div className="toy-profile-photo relative">
              <img src={photos.profile} alt={`${toy.name}的介绍照`} />
              <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-semibold text-matcha-deep shadow-sm">
                MY TOY
              </span>
            </div>
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
          <div className="toy-highlights">
            {photos.highlights.map((photo, index) => (
              <figure
                key={photo}
                className={`toy-polaroid toy-polaroid--${index + 1}`}
              >
                <span className="toy-photo-clip" aria-hidden="true" />
                <div className="toy-polaroid__image">
                  <img
                    src={photo}
                    alt={`${toy.name}的高光时刻 ${index + 1}`}
                  />
                </div>
                <figcaption>
                  {['出发', '看海', '收藏风景'][index]}
                </figcaption>
              </figure>
            ))}
          </div>
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
