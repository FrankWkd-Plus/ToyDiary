import {
  Check,
  ChevronDown,
  Plus,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toyAvatar } from '../archive/archiveUtils'
import { ToyCardCarousel } from '../components/ToyCardCarousel'
import { useApp } from '../context/AppContext'
import { useLocale } from '../i18n'

export function TimelinePage() {
  const navigate = useNavigate()
  const { t } = useLocale()
  const { currentToy, toys, setCurrentToyId, showToast } = useApp()
  const [pickerOpen, setPickerOpen] = useState(false)

  function goNewToy() {
    navigate('/toys/new')
  }

  return (
    <div className="min-h-full">
      <header className="header-band sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3.5">
        <div className="flex min-w-0 flex-1 items-center">
          <button
            type="button"
            onClick={() => (toys.length ? setPickerOpen(true) : goNewToy())}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl py-0.5 pr-2 text-left transition-transform active:scale-[0.98]"
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
          >
            {currentToy ? (
              <img
                src={toyAvatar(
                  currentToy,
                  toys.findIndex((toy) => toy.id === currentToy.id),
                )}
                alt=""
                className="h-9 w-9 shrink-0 rounded-xl border-2 border-white object-cover shadow-sm ring-1 ring-line/50"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-dashed border-matcha/45 bg-white/75 text-matcha-deep shadow-sm">
                <Plus className="h-4 w-4" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-[9px] font-semibold tracking-[0.12em] text-ink-muted">
                TOY DIARY
              </span>
              <span className="mt-0.5 flex items-center gap-1">
                <strong className="max-w-full truncate font-display text-sm text-ink">
                  {currentToy?.name || t('archive.selectToy')}
                </strong>
                {toys.length > 0 && (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-matcha-deep" />
                )}
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
          <ToyCardCarousel />
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
