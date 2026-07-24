import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

function photosForToy(
  toy: { avatarUrl?: string },
  toyEntries: { imageUrl?: string }[],
  index: number,
): ToyCardPhotos {
  const entryPhotos = toyEntries
    .map((entry) => entry.imageUrl)
    .filter((url): url is string => Boolean(url))
  const highlights = [...entryPhotos, ...FALLBACK_PHOTOS]
    .filter((url, photoIndex, all) => all.indexOf(url) === photoIndex)
    .slice(0, 3) as [string, string, string]

  return {
    profile:
      toy.avatarUrl ||
      (index === 0 ? '/toy-cards/profile.jpg' : FALLBACK_PHOTOS[index % 3]),
    highlights,
  }
}

/** Shared by 档案 and 我的 → 玩偶 so both surfaces always stay identical. */
export function ToyCardCarousel({
  onVisibleToyChange,
}: {
  onVisibleToyChange?: (toy: Toy) => void
}) {
  const navigate = useNavigate()
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
    setVisibleIndex(index)
    const visibleToy = toys[index]
    if (visibleToy) onVisibleToyChange?.(visibleToy)
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
