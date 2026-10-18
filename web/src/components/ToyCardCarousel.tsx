import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { latestToyChatLine } from '../conversation/chatStorage'
import { useApp } from '../context/AppContext'
import type { Entry, Toy } from '../types'
import { ToyCard, type ToyCardPhotos } from './ToyCard'

function photosForToy(
  toy: { avatarUrl?: string },
  toyEntries: Entry[],
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
  return {
    profile: toy.avatarUrl || '/toy-cards/profile.jpg',
    highlights,
  }
}

/** Shared by 档案 and 我的 → 玩偶 so both surfaces always stay identical. */
export function ToyCardCarousel({
  onVisibleToyChange,
  browseOnly = false,
}: {
  onVisibleToyChange?: (toy: Toy) => void
  /** Browse profiles without changing the app-wide active toy. */
  browseOnly?: boolean
}) {
  const navigate = useNavigate()
  const { toys, currentToy, entries, setCurrentToyId } = useApp()
  const carouselRef = useRef<HTMLDivElement>(null)
  const programmaticTargetIndexRef = useRef<number | null>(null)
  const [entriesByToy, setEntriesByToy] = useState<Record<string, Entry[]>>({})
  const initialVisibleIndex = Math.max(
    0,
    browseOnly ? 0 : toys.findIndex((toy) => toy.id === currentToy?.id),
  )
  const visibleIndexRef = useRef(initialVisibleIndex)
  const [visibleIndex, setVisibleIndex] = useState(initialVisibleIndex)

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
    if (browseOnly) return
    const nextIndex = Math.max(
      0,
      toys.findIndex((toy) => toy.id === currentToy?.id),
    )
    visibleIndexRef.current = nextIndex
    setVisibleIndex(nextIndex)
    const carousel = carouselRef.current
    if (!carousel) return

    // The top picker changes the global toy before this carousel moves. While
    // it is moving, intermediate cards must not overwrite that new selection.
    programmaticTargetIndexRef.current = nextIndex
    const frame = window.requestAnimationFrame(() => {
      carousel.scrollTo({
        left: carousel.clientWidth * nextIndex,
        behavior: 'smooth',
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [browseOnly, currentToy?.id, toys])

  function syncVisibleCard() {
    const carousel = carouselRef.current
    if (!carousel || carousel.clientWidth === 0 || toys.length === 0) return
    const index = Math.max(
      0,
      Math.min(toys.length - 1, Math.round(carousel.scrollLeft / carousel.clientWidth)),
    )

    const programmaticTarget = programmaticTargetIndexRef.current
    if (programmaticTarget !== null) {
      if (index === programmaticTarget) {
        programmaticTargetIndexRef.current = null
        visibleIndexRef.current = index
        setVisibleIndex(index)
      }
      return
    }

    if (index === visibleIndexRef.current) return
    visibleIndexRef.current = index
    setVisibleIndex(index)
    const visibleToy = toys[index]
    if (!visibleToy) return

    // A carousel card is not only a preview: it represents the active toy
    // across the app. Keep the global selection (and its entry set) in sync.
    if (!browseOnly && visibleToy.id !== currentToy?.id) {
      setCurrentToyId(visibleToy.id)
    }
    onVisibleToyChange?.(visibleToy)
  }

  return (
    <>
      <div
        ref={carouselRef}
        onScroll={syncVisibleCard}
        className="toy-card-carousel flex snap-x snap-mandatory overflow-x-auto"
        aria-label={browseOnly ? '左右滑动浏览玩偶档案' : '左右滑动切换玩偶'}
      >
        {toys.map((toy) => {
          const toyEntries =
            entriesByToy[toy.id] ??
            entries.filter((entry) => entry.toyId === toy.id)
          return (
            <div key={toy.id} className="w-full min-w-full snap-center">
              <ToyCard
                toy={toy}
                photos={photosForToy(toy, toyEntries)}
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
                  if (!browseOnly) setCurrentToyId(toy.id)
                  navigate(`/toys/${toy.id}/edit`, {
                    state: {
                      from: browseOnly ? 'me' : 'archive',
                    },
                  })
                }}
                onOpenHighlight={(entryId) => {
                  if (!browseOnly) setCurrentToyId(toy.id)
                  navigate(`/entries/${entryId}`, {
                    state: { from: browseOnly ? 'me-toys' : 'archive' },
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
