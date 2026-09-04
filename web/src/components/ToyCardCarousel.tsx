import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { latestToyChatLine } from '../conversation/chatStorage'
import { useApp } from '../context/AppContext'
import type { Entry, Toy } from '../types'
import { ToyCard, type ToyCardPhotos } from './ToyCard'

const FALLBACK_PHOTOS = [
  '/toy-cards/highlight-1.jpg',
  '/toy-cards/highlight-2.jpg',
  '/toy-cards/highlight-3.jpg',
] as const

const FALLBACK_TITLES = ['出发', '看海', '收藏风景'] as const

function photosForToy(
  toy: { avatarUrl?: string },
  toyEntries: Entry[],
  index: number,
): ToyCardPhotos {
  // Prefer real diary photos (newest first) so highlights open the matching entry
  const fromEntries = [...toyEntries]
    .filter((entry) => Boolean(entry.imageUrl))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .map((entry) => ({
      src: entry.imageUrl as string,
      entryId: entry.id,
      title: entry.title || entry.location || '这一刻',
    }))

  const seen = new Set<string>()
  const highlights: ToyCardPhotos['highlights'][number][] = []
  for (const shot of fromEntries) {
    if (seen.has(shot.src)) continue
    seen.add(shot.src)
    highlights.push(shot)
    if (highlights.length >= 3) break
  }
  for (let i = 0; highlights.length < 3 && i < FALLBACK_PHOTOS.length * 2; i++) {
    const src = FALLBACK_PHOTOS[i % FALLBACK_PHOTOS.length]
    if (seen.has(src)) continue
    seen.add(src)
    highlights.push({ src, title: FALLBACK_TITLES[i % FALLBACK_TITLES.length] })
  }
  // Hard pad if still short (duplicate last real shot as non-clickable filler)
  while (highlights.length < 3) {
    const last = highlights[highlights.length - 1] || {
      src: FALLBACK_PHOTOS[0],
      title: FALLBACK_TITLES[0],
    }
    highlights.push({ src: last.src, title: last.title })
  }

  return {
    profile:
      toy.avatarUrl ||
      (index === 0 ? '/toy-cards/profile.jpg' : FALLBACK_PHOTOS[index % 3]),
    highlights: highlights as ToyCardPhotos['highlights'],
  }
}

/** Shared by 档案 and 我的 → 玩偶 so both surfaces always stay identical. */
export function ToyCardCarousel({
  onVisibleToyChange,
}: {
  onVisibleToyChange?: (toy: Toy) => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { toys, currentToy, entries, setCurrentToyId } = useApp()
  const carouselRef = useRef<HTMLDivElement>(null)
  const [entriesByToy, setEntriesByToy] = useState<Record<string, Entry[]>>({})
  const [visibleIndex, setVisibleIndex] = useState(() =>
    Math.max(0, toys.findIndex((toy) => toy.id === currentToy?.id)),
  )

  useEffect(() => {
    let cancelled = false
    void Promise.all(
      toys.map(async (toy) => [toy.id, await api.listEntries(toy.id)] as const),
    ).then((pairs) => {
      if (!cancelled) setEntriesByToy(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [toys])

  useEffect(() => {
    const nextIndex = Math.max(
      0,
      toys.findIndex((toy) => toy.id === currentToy?.id),
    )
    setVisibleIndex(nextIndex)
    const carousel = carouselRef.current
    if (!carousel) return
    window.requestAnimationFrame(() => {
      carousel.scrollTo({
        left: carousel.clientWidth * nextIndex,
        behavior: 'smooth',
      })
    })
  }, [currentToy?.id, toys])

  function syncVisibleCard() {
    const carousel = carouselRef.current
    if (!carousel || carousel.clientWidth === 0 || toys.length === 0) return
    const index = Math.max(
      0,
      Math.min(toys.length - 1, Math.round(carousel.scrollLeft / carousel.clientWidth)),
    )
    if (index === visibleIndex) return
    setVisibleIndex(index)
    const visibleToy = toys[index]
    if (!visibleToy) return

    // A carousel card is not only a preview: it represents the active toy
    // across the app. Keep the global selection (and its entry set) in sync.
    if (visibleToy.id !== currentToy?.id) setCurrentToyId(visibleToy.id)
    onVisibleToyChange?.(visibleToy)
  }

  return (
    <>
      <div
        ref={carouselRef}
        onScroll={syncVisibleCard}
        className="toy-card-carousel flex snap-x snap-mandatory overflow-x-auto"
        aria-label="左右滑动切换玩偶"
      >
        {toys.map((toy, index) => {
          const toyEntries =
            entriesByToy[toy.id] ??
            entries.filter((entry) => entry.toyId === toy.id)
          return (
            <div key={toy.id} className="w-full min-w-full snap-center">
              <ToyCard
                toy={toy}
                photos={photosForToy(toy, toyEntries, index)}
                entries={toyEntries}
                chatPreview={latestToyChatLine(
                  toy.id,
                  toy.monologue ||
                    `你来啦，今天有什么想和${toy.name}说的吗？`,
                )}
                onOpenConversation={() => {
                  setCurrentToyId(toy.id)
                  navigate('/conversation')
                }}
                onEditToy={() => {
                  setCurrentToyId(toy.id)
                  navigate(`/toys/${toy.id}/edit`, {
                    state: {
                      from:
                        location.pathname === '/toys'
                          ? 'me'
                          : 'archive',
                    },
                  })
                }}
                onOpenHighlight={(entryId) => {
                  setCurrentToyId(toy.id)
                  navigate(`/entries/${entryId}`, {
                    state: { from: 'archive' },
                  })
                }}
              />
            </div>
          )
        })}
      </div>

      {toys.length > 1 && (
        <div
          className="mt-3 flex items-center justify-center gap-1.5"
          aria-label={`当前是第 ${visibleIndex + 1} 张，共 ${toys.length} 张`}
        >
          {toys.map((toy, index) => (
            <span
              key={toy.id}
              className={`h-1.5 rounded-full transition-all ${
                visibleIndex === index ? 'w-5 bg-matcha' : 'w-1.5 bg-line'
              }`}
            />
          ))}
        </div>
      )}
    </>
  )
}
