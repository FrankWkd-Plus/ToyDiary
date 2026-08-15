import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  companionDayStatus,
  toyAvatar,
} from '../archive/archiveUtils'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { ToyCardCarousel } from '../components/ToyCardCarousel'
import { useApp } from '../context/AppContext'
import { useLocale } from '../i18n'
import { seedPlaceForLabel, uniqueCities } from '../places/placeUtils'

export function TimelinePage() {
  const navigate = useNavigate()
  const { t } = useLocale()
  const { currentToy, toys, entries, setCurrentToyId, showToast } = useApp()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [viewedToyId, setViewedToyId] = useState(currentToy?.id)
  const viewedToy =
    toys.find((toy) => toy.id === viewedToyId) ?? currentToy
  const viewedToyIndex = toys.findIndex((toy) => toy.id === viewedToy?.id)
  const avatar = toyAvatar(viewedToy, viewedToyIndex)
  const companion = viewedToy ? companionDayStatus(viewedToy) : null

  // Stats only make sense for the currently loaded entry set
  const statsReady = Boolean(viewedToy && currentToy?.id === viewedToy.id)
  const travelCount = useMemo(
    () => (statsReady ? entries.filter((e) => e.type === 'travel').length : 0),
    [entries, statsReady],
  )
  const cityCount = useMemo(() => {
    if (!statsReady) return 0
    const places = entries
      .map((e) => e.place || seedPlaceForLabel(e.location))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
    return uniqueCities(places).length
  }, [entries, statsReady])
  const momentCount = statsReady ? entries.length : 0
  const companionDaysValue = companion?.isFuture ? 0 : companion?.days ?? 0

  useEffect(() => {
    if (currentToy?.id) setViewedToyId(currentToy.id)
  }, [currentToy?.id])

  function goNewToy() {
    navigate('/toys/new')
  }

  function requireViewedToy(path: string) {
    if (!viewedToy) {
      showToast(t('archive.pickToyFirst'))
      return
    }
    if (viewedToy.id !== currentToy?.id) {
      setCurrentToyId(viewedToy.id)
    }
    navigate(path)
  }

  return (
    <div className="min-h-full">
      <header className="header-band sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <LanguageSwitch className="shrink-0" />
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex min-w-0 items-center gap-2.5 rounded-2xl py-0.5 pr-2 text-left transition-transform active:scale-[0.98]"
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
          >
            <img
              src={toyAvatar(
                currentToy,
                toys.findIndex((toy) => toy.id === currentToy?.id),
              )}
              alt=""
              className="h-9 w-9 shrink-0 rounded-xl border-2 border-white object-cover shadow-sm ring-1 ring-line/50"
            />
            <span className="min-w-0">
              <span className="block text-[9px] font-semibold tracking-[0.12em] text-ink-muted">
                TOY DAIRY
              </span>
              <span className="mt-0.5 flex items-center gap-1">
                <strong className="max-w-[7rem] truncate font-display text-sm text-ink sm:max-w-[8rem]">
                  {currentToy?.name || t('archive.selectToy')}
                </strong>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-matcha-deep" />
              </span>
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={goNewToy}
          className="flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-mustard-soft px-3 py-2 text-[11px] font-semibold text-matcha-deep shadow-[var(--shadow-warm-sm)] ring-1 ring-line/30 transition-transform active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          {t('archive.addToy')}
        </button>
      </header>

      <main className="space-y-3.5 px-4 pb-5 pt-4">
        {toys.length > 0 ? (
          <ToyCardCarousel
            onVisibleToyChange={(toy) => setViewedToyId(toy.id)}
          />
        ) : (
          <button
            type="button"
            onClick={goNewToy}
            className="card-paper w-full p-6 text-center"
          >
            <span className="text-3xl">🧸</span>
            <p className="mt-2 text-sm font-medium text-ink">
              {t('archive.createFirst')}
            </p>
          </button>
        )}

        {viewedToy && companion && (
          <button
            type="button"
            onClick={() => navigate(`/memories/${viewedToy.id}`)}
            className="archive-milestone-card w-full overflow-hidden text-left transition-transform active:scale-[0.99]"
          >
            <div className="relative z-[1] max-w-[65%]">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/65 px-2.5 py-1 text-[10px] font-medium text-terra-deep">
                <Sparkles className="h-3 w-3" />
                {t('archive.memorial')}
              </span>

              {companion.isFuture ? (
                <>
                  <p className="mt-3 text-xs font-medium text-ink-soft">
                    {t('archive.daysUntilMeet', { n: companion.daysUntil })}
                  </p>
                  <p className="mt-0.5 font-display text-[1.9rem] leading-none text-ink">
                    COMING SOON
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-xs font-medium text-ink-soft">
                    {t('archive.dayNumber', { n: companion.days })}
                  </p>
                  <p className="mt-0.5 font-display text-[2.25rem] leading-none text-ink">
                    {companion.days} DAYS
                  </p>
                </>
              )}

              <span className="mt-3 inline-flex items-center text-[10px] font-semibold text-matcha-deep">
                {t('archive.enterMemoryHall')}
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="absolute -bottom-5 -right-2 h-36 w-36 rotate-6 overflow-hidden rounded-[2rem] border-[5px] border-white bg-white shadow-lg">
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            </div>
            <Bell className="absolute right-32 top-5 h-4 w-4 rotate-12 text-terra-deep/60" />
          </button>
        )}

        {viewedToy && companion && (
          <section className="grid grid-cols-2 gap-2">
            <ArchiveStatCard
              badge={t('archive.statCompanion')}
              value={companionDaysValue}
              unit={t('archive.unitDay')}
              hint={
                companion.isFuture
                  ? t('archive.hintUntilMeet', { n: companion.daysUntil })
                  : t('archive.hintTogether')
              }
              onClick={() => requireViewedToy('/growth/stats/companion')}
            />
            <ArchiveStatCard
              badge={t('archive.statTravel')}
              value={travelCount}
              unit={t('archive.unitTrip')}
              hint={t('archive.hintTravel')}
              onClick={() => requireViewedToy('/growth/stats/travel')}
            />
            <ArchiveStatCard
              badge={t('archive.statCities')}
              value={cityCount}
              unit={t('archive.unitCity')}
              hint={t('archive.hintCities')}
              onClick={() => requireViewedToy('/growth/stats/cities')}
            />
            <ArchiveStatCard
              badge={t('archive.statMoments')}
              value={momentCount}
              unit={t('archive.unitMoment')}
              hint={t('archive.hintMoments')}
              onClick={() => requireViewedToy('/growth/stats/moments')}
            />
          </section>
        )}
      </main>

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 backdrop-blur-[2px]"
          onClick={() => setPickerOpen(false)}
        >
          <section
            className="composer-sheet w-full max-w-[390px] rounded-t-[1.75rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-12px_40px_rgb(74_67_60_/_0.18)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="toy-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="mx-auto mb-3 h-1 w-10 rounded-full bg-line"
              aria-hidden="true"
            />
            <div className="flex items-center justify-between">
              <div>
                <h2
                  id="toy-picker-title"
                  className="font-display text-lg text-ink"
                >
                  {t('archive.pickerTitle')}
                </h2>
                <p className="mt-0.5 text-[10px] text-ink-muted">
                  {t('archive.pickerHint')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-ink-muted"
                aria-label={t('archive.closePicker')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {toys.map((toy, index) => {
                const selected = toy.id === currentToy?.id
                return (
                  <button
                    key={toy.id}
                    type="button"
                    onClick={() => {
                      setCurrentToyId(toy.id)
                      setViewedToyId(toy.id)
                      setPickerOpen(false)
                      showToast(t('archive.setCurrent', { name: toy.name }))
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                      selected
                        ? 'border-matcha/50 bg-mist-soft/70'
                        : 'border-line/70 bg-cream/55'
                    }`}
                    aria-current={selected ? 'true' : undefined}
                  >
                    <img
                      src={toyAvatar(toy, index)}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-[0.9rem] border-2 border-white object-cover shadow-sm"
                    />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate font-display text-sm text-ink">
                        {toy.name}
                      </strong>
                      <span className="mt-1 block truncate text-[10px] text-ink-muted">
                        {[toy.zodiac, ...toy.traits.slice(0, 2)]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        selected
                          ? 'bg-matcha text-white'
                          : 'border border-line bg-white text-transparent'
                      }`}
                      aria-label={selected ? t('archive.currentAria') : undefined}
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setPickerOpen(false)
                goNewToy()
              }}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-matcha/45 bg-white py-3 text-xs font-semibold text-matcha-deep"
            >
              <Plus className="h-4 w-4" />
              {t('archive.addToy')}
            </button>
          </section>
        </div>
      )}
    </div>
  )
}

function ArchiveStatCard({
  badge,
  value,
  unit,
  hint,
  onClick,
}: {
  badge: string
  value: number
  unit: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="archive-stat-card text-left active:scale-[0.99]"
    >
      <span className="inline-flex items-center rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-medium text-terra-deep">
        {badge}
      </span>
      <p className="mt-2 font-display text-[1.55rem] leading-none text-ink">
        {value}
        {unit ? (
          <span className="ml-0.5 font-sans text-[11px] font-medium text-ink-muted">
            {unit}
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-[10px] leading-snug text-ink-soft">{hint}</p>
    </button>
  )
}
