import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Plus } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { ToyCard, type ToyCardPhotos } from '../components/ToyCard'
import { useApp } from '../context/AppContext'

const PROFILE = '/toy-cards/profile.jpg'
const HIGHLIGHT_1 = '/toy-cards/highlight-1.jpg'
const HIGHLIGHT_2 = '/toy-cards/highlight-2.jpg'
const HIGHLIGHT_3 = '/toy-cards/highlight-3.jpg'

const PHOTO_SETS: [ToyCardPhotos, ToyCardPhotos] = [
  {
    profile: PROFILE,
    highlights: [HIGHLIGHT_1, HIGHLIGHT_2, HIGHLIGHT_3],
  },
  {
    profile: HIGHLIGHT_3,
    highlights: [PROFILE, HIGHLIGHT_1, HIGHLIGHT_2],
  },
]

export function ToysPage() {
  const navigate = useNavigate()
  const { isLoggedIn } = useAuth()
  const { toys, currentToy, entries, setCurrentToyId, showToast } = useApp()
  const displayToys = toys

  function goNewToy() {
    if (!isLoggedIn) {
      showToast('创建玩偶档案需要先登录')
      navigate('/login')
      return
    }
    navigate('/toys/new')
  }
  const [visibleToyId, setVisibleToyId] = useState<string | null>(
    displayToys.find((toy) => toy.id === currentToy?.id)?.id ??
      displayToys[0]?.id ??
      null,
  )

  useEffect(() => {
    if (!displayToys.some((toy) => toy.id === visibleToyId)) {
      setVisibleToyId(displayToys[0]?.id ?? null)
    }
  }, [displayToys, visibleToyId])

  const visibleIndex = Math.max(
    0,
    displayToys.findIndex((toy) => toy.id === visibleToyId),
  )
  const visibleToy = displayToys[visibleIndex]

  return (
    <>
      <PageHeader
        title="我的玩偶"
        subtitle={`${displayToys.length} 位陪伴伙伴`}
        soft
        right={
          <button
            type="button"
            onClick={goNewToy}
            className="btn-primary h-9 w-9"
            aria-label="新增玩偶"
            title="新增玩偶"
          >
            <Plus className="h-5 w-5" strokeWidth={2.4} />
          </button>
        }
      />

      <div className="px-4 pb-5 pt-3">
        {displayToys.length === 0 ? (
          <EmptyState
            title="还没有玩偶"
            desc={
              isLoggedIn
                ? '创建第一只玩偶，生成身份卡吧。'
                : '游客可浏览演示数据；创建档案需登录。'
            }
            action={
              <button
                type="button"
                onClick={goNewToy}
                className="btn-primary px-6 py-2.5 text-sm"
              >
                {isLoggedIn ? '新建玩偶' : '去登录'}
              </button>
            }
          />
        ) : (
          <>
            <div className="toy-selector-scroll mb-3 flex gap-2 overflow-x-auto rounded-2xl bg-cream p-1.5">
              {displayToys.map((toy) => {
                const selected = toy.id === visibleToy?.id
                const active = toy.id === currentToy?.id
                return (
                  <button
                    key={toy.id}
                    type="button"
                    onClick={() => setVisibleToyId(toy.id)}
                    className={`relative flex min-w-[7.5rem] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-all ${
                      selected
                        ? 'bg-white font-semibold text-ink shadow-[var(--shadow-warm-sm)]'
                        : 'text-ink-muted'
                    }`}
                  >
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-matcha-deep" />}
                    <span className="truncate">{toy.name}</span>
                  </button>
                )
              })}
            </div>

            {visibleToy && (
              <div key={visibleToy.id} className="toy-card-enter">
                <ToyCard
                  toy={visibleToy}
                  photos={PHOTO_SETS[visibleIndex % PHOTO_SETS.length]}
                  active={currentToy?.id === visibleToy.id}
                  entries={entries.filter((e) => e.toyId === visibleToy.id)}
                  onSelect={() => {
                    setCurrentToyId(visibleToy.id)
                    showToast(`已切换到 ${visibleToy.name}`)
                  }}
                />
              </div>
            )}

            {displayToys.length > 1 && (
              <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
                {displayToys.map((toy) => (
                  <span
                    key={toy.id}
                    className={`h-1.5 rounded-full transition-all ${
                      toy.id === visibleToy?.id ? 'w-5 bg-matcha' : 'w-1.5 bg-line'
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
