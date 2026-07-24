import { Camera, Check, MapPin, Sparkles } from 'lucide-react'
import { getToyVitality } from '../archive/toyVitality'
import type { Entry, Toy } from '../types'

export interface ToyCardPhotos {
  profile: string
  highlights: [string, string, string]
}

export function ToyCard({
  toy,
  photos,
  active,
  onSelect,
  entries = [],
}: {
  toy: Toy
  photos: ToyCardPhotos
  active: boolean
  onSelect: () => void
  entries?: Entry[]
}) {
  const vitality = getToyVitality(toy, entries)

  return (
    <article className="toy-id-card">
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
          <div className="toy-profile-photo relative">
            <img src={photos.profile} alt={`${toy.name}的介绍照`} />
            <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-semibold text-matcha-deep shadow-sm">
              MY TOY
            </span>
            <span
              className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-paper text-sm shadow-sm"
              title={`${vitality.label} · 电量 ${vitality.energy}`}
              aria-label={`状态 ${vitality.label}`}
            >
              {vitality.emoji}
            </span>
          </div>

          <div className="min-w-0 py-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="font-display truncate text-[1.35rem] leading-none text-ink">
                {toy.name}
              </h2>
              <span className="toy-role-tag">{toy.role}</span>
            </div>

            <div className="toy-sketch-line" />

            <p className="text-[11px] font-medium text-matcha-deep">
              {vitality.emoji} {vitality.line}
            </p>

            <h3 className="mt-1.5 text-xs font-semibold text-ink">玩偶简介</h3>
            <p className="mt-1 line-clamp-3 text-[11px] leading-[1.55] text-ink-soft">
              {toy.bio ||
                `${toy.name}是一位温柔的${toy.role}，喜欢和你一起收集日常里的小小快乐。`}
            </p>

            <div className="mt-2 flex flex-wrap gap-1">
              <span className="rounded-full bg-peach-soft px-2 py-0.5 text-[9px] font-medium text-rose-deep">
                {vitality.label} ·{vitality.energy}
              </span>
              {toy.traits.slice(0, 2).map((trait) => (
                <span
                  key={trait}
                  className="rounded-full bg-mist-soft px-2 py-0.5 text-[9px] font-medium text-matcha-deep"
                >
                  #{trait}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-cream px-3 py-2 text-[10px] text-ink-muted">
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0 text-matcha-deep" />
            <span className="truncate">{toy.birthPlace}</span>
          </span>
          <span className="shrink-0">{toy.birthDate.replaceAll('-', '.')}</span>
        </div>

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

        <button
          type="button"
          onClick={onSelect}
          disabled={active}
          className={
            active
              ? 'toy-current-button toy-current-button--active'
              : 'toy-current-button'
          }
        >
          {active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          {active ? '当前玩偶' : '设为当前玩偶'}
        </button>
      </div>
    </article>
  )
}
