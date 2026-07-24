import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  BookHeart,
  CalendarDays,
  Camera,
  ChevronRight,
  MapPinned,
  Sparkles,
} from 'lucide-react'
import {
  archivePhotos,
  companionDays,
  toyAvatar,
} from '../archive/archiveUtils'
import { getToyVitality } from '../archive/toyVitality'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'

export function ToyArchiveDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toys, currentToy, entries, setCurrentToyId } = useApp()
  const toy = toys.find((item) => item.id === id)
  const toyIndex = toys.findIndex((item) => item.id === id)

  useEffect(() => {
    if (toy && currentToy?.id !== toy.id) setCurrentToyId(toy.id)
  }, [currentToy?.id, setCurrentToyId, toy])

  if (!toy) {
    return (
      <>
        <PageHeader title="玩偶档案" back="/archive" soft />
        <div className="px-4 py-16 text-center text-sm text-ink-muted">
          没有找到这份玩偶档案
        </div>
      </>
    )
  }

  const days = companionDays(toy)
  // Only trust global entries once AppContext has switched to this toy.
  const ready = currentToy?.id === toy.id
  const photos = ready ? archivePhotos(entries) : []
  const cities = new Set(
    ready
      ? entries
          .map((entry) => entry.location)
          .filter((place): place is string => Boolean(place && place !== '家'))
      : [],
  )
  const entryCount = ready ? entries.length : 0
  const vitality = getToyVitality(toy, ready ? entries : [])

  return (
    <>
      <PageHeader title="玩偶档案" subtitle="每一次陪伴，都被认真收藏" back="/archive" soft />
      <main className="space-y-4 px-4 pb-5 pt-4">
        <section className="archive-profile-card">
          <div className="archive-profile-card__top">
            <span className="flex gap-1" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="font-display text-xs tracking-[0.18em] text-white/90">
              TOY ARCHIVE
            </span>
          </div>
          <div className="p-4">
            <div className="flex gap-4">
              <div className="relative h-28 w-28 shrink-0">
                <div className="h-full w-full overflow-hidden rounded-[1.3rem] border-[5px] border-white bg-cream shadow-md">
                  <img
                    src={toyAvatar(toy, toyIndex)}
                    alt={toy.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <span
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-paper text-base shadow-sm"
                  title={`${vitality.label} · 电量 ${vitality.energy}`}
                  aria-label={`状态 ${vitality.label}`}
                >
                  {vitality.emoji}
                </span>
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-mist-soft px-2 py-1 text-[10px] font-semibold text-matcha-deep">
                    {toy.role}
                  </span>
                  <span className="rounded-full bg-peach-soft px-2 py-1 text-[10px] font-medium text-rose-deep">
                    {vitality.emoji} {vitality.label}
                  </span>
                  <span className="rounded-full bg-cream px-2 py-1 text-[10px] text-ink-muted">
                    电量 {vitality.energy}
                  </span>
                </div>
                <h1 className="mt-2 font-display text-2xl text-ink">{toy.name}</h1>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  出生于 {toy.birthPlace}
                  <br />
                  {toy.birthDate.replaceAll('-', '.')} · {toy.zodiac}
                </p>
              </div>
            </div>
            <div className="my-4 h-px bg-line/80" />
            <p className="text-xs font-medium text-matcha-deep">
              {vitality.emoji} {vitality.line}
            </p>
            <p className="mt-3 text-xs font-semibold text-ink">玩偶独白</p>
            <p className="mt-1.5 text-xs leading-6 text-ink-soft">
              “{toy.monologue || '谢谢你，让我的每一天都有了名字。'}”
            </p>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2">
          {[
            { value: days, unit: '天', label: '陪伴日子', icon: CalendarDays },
            { value: entryCount, unit: '篇', label: '共同记录', icon: BookHeart },
            { value: cities.size, unit: '城', label: '到访足迹', icon: MapPinned },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-line/70 bg-white px-2 py-3 text-center shadow-[var(--shadow-warm-sm)]">
              <stat.icon className="mx-auto h-4 w-4 text-matcha-deep" />
              <p className="mt-1.5 font-display text-xl leading-none text-ink">
                {stat.value}
                <span className="ml-0.5 text-[10px]">{stat.unit}</span>
              </p>
              <p className="mt-1 text-[9px] text-ink-muted">{stat.label}</p>
            </div>
          ))}
        </section>

        <section className="card-paper border border-line/60 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-terra-deep" />
            <h2 className="font-display text-base text-ink">关于 {toy.name}</h2>
          </div>
          <p className="mt-2 text-xs leading-6 text-ink-soft">
            {toy.bio || `${toy.name} 是一位温柔的陪伴伙伴，喜欢和你一起收藏生活里的小小闪光。`}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {toy.traits.map((trait) => (
              <span key={trait} className="rounded-full bg-mustard-soft px-2.5 py-1 text-[10px] text-terra-deep">
                # {trait}
              </span>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base text-ink">高光时刻</h2>
              <p className="mt-0.5 text-[10px] text-ink-muted">我们一起收藏的闪光碎片</p>
            </div>
            <Camera className="h-4 w-4 text-terra-deep" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {photos.slice(0, 3).map((photo, index) => {
              const clickable = Boolean(photo.entryId)
              const frameClass = `rounded-xl bg-white p-1.5 shadow-[var(--shadow-warm)] ${
                index === 0 ? '-rotate-2' : index === 2 ? 'rotate-2' : ''
              }${clickable ? ' active:scale-[0.98]' : ''}`
              const image = (
                <img
                  src={photo.src}
                  alt={photo.title}
                  className="aspect-square w-full rounded-lg object-cover"
                />
              )
              const captionClass =
                'truncate px-1 pb-1 pt-1.5 text-center text-[8px] text-ink-muted'

              if (clickable) {
                return (
                  <button
                    key={`${photo.src}-${photo.entryId || index}`}
                    type="button"
                    className={`${frameClass} w-full text-left`}
                    onClick={() =>
                      navigate(`/entries/${photo.entryId}`, {
                        state: { from: 'archive' },
                      })
                    }
                    aria-label={`查看「${photo.title}」的日记`}
                  >
                    {image}
                    <span className={`block ${captionClass}`}>{photo.title}</span>
                  </button>
                )
              }

              return (
                <figure
                  key={`${photo.src}-${index}`}
                  className={frameClass}
                >
                  {image}
                  <figcaption className={captionClass}>{photo.title}</figcaption>
                </figure>
              )
            })}
          </div>
        </section>

        <button
          type="button"
          onClick={() => navigate(`/memories/${toy.id}`)}
          className="flex w-full items-center gap-3 rounded-2xl bg-mist-soft p-3.5 text-left active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-matcha-deep">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-sm text-ink">进入回忆展厅</strong>
            <span className="text-[10px] text-ink-muted">重温属于我们的照片、故事与纪念日</span>
          </span>
          <ChevronRight className="h-4 w-4 text-matcha-deep" />
        </button>
      </main>
    </>
  )
}
