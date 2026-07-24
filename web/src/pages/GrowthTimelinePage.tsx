import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, MapPin, Sparkles } from 'lucide-react'
import { useApp } from '../context/AppContext'

/** Secondary page: full growth timeline list */
export function GrowthTimelinePage() {
  const navigate = useNavigate()
  const { currentToy, entries } = useApp()

  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [entries],
  )

  if (!currentToy) {
    return (
      <Empty back={() => navigate('/growth')} message="请先选择玩偶" />
    )
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line/60 bg-white/95 px-3 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate('/growth')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-ink-soft"
          aria-label="返回成长"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-base text-ink">成长时间线</h1>
          <p className="text-[10px] text-ink-muted">
            {currentToy.name} · {sortedEntries.length} 条记录
          </p>
        </div>
      </header>

      <div className="px-3.5 py-4">
        {sortedEntries.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center text-center">
            <Sparkles className="h-6 w-6 text-matcha-deep" />
            <p className="mt-2 text-sm text-ink-muted">还没有成长轨迹</p>
            <Link to="/compose" className="btn-primary mt-4 px-5 py-2.5 text-sm">
              新建记录
            </Link>
          </div>
        ) : (
          <div className="growth-timeline">
            {sortedEntries.map((entry, index) => {
              const { monthDay, year } = splitDate(entry.date)
              const location = entry.place?.displayName || entry.location
              const text = entry.aiDiary?.trim() || entry.userNote?.trim()
              return (
                <article key={entry.id} className="growth-row">
                  <div className="growth-date">
                    <time dateTime={entry.date}>
                      <span className="block font-display text-[15px] leading-none text-ink">
                        {monthDay}
                      </span>
                      <span className="mt-1 block text-[9px] text-ink-muted">
                        {year}
                      </span>
                    </time>
                  </div>
                  <div
                    className={`growth-dot ${index === 0 ? 'growth-dot-current' : ''}`}
                  />
                  <Link
                    to={`/entries/${entry.id}`}
                    state={{ from: 'growth-timeline' }}
                    className="growth-entry-card"
                  >
                    {entry.imageUrl && (
                      <div className="growth-entry-image">
                        <img
                          src={entry.imageUrl}
                          alt={entry.title || '成长记录'}
                        />
                      </div>
                    )}
                    <div className="p-3.5">
                      <h2 className="font-medium leading-snug text-ink">
                        {entry.title || '这一刻'}
                      </h2>
                      {location && (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-muted">
                          <MapPin className="h-3.5 w-3.5 text-matcha-deep" />
                          {location}
                        </p>
                      )}
                      {text && (
                        <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-ink-soft">
                          {text}
                        </p>
                      )}
                    </div>
                  </Link>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function splitDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return { year: y, monthDay: `${Number(m)}/${Number(d)}` }
}

function Empty({ back, message }: { back: () => void; message: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-ink-muted">{message}</p>
      <button type="button" className="btn-primary mt-4 px-4 py-2 text-sm" onClick={back}>
        返回成长
      </button>
    </div>
  )
}
