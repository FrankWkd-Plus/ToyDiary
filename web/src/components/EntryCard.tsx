import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { useLocale } from '../i18n'
import type { Entry } from '../types'
import { entryTypeLabel } from '../types'

export function EntryCard({ entry }: { entry: Entry }) {
  const { locale, t } = useLocale()
  return (
    <Link
      to={`/entries/${entry.id}`}
      className="card-paper block overflow-hidden transition-transform active:scale-[0.99]"
    >
      {entry.imageUrl && (
        <div className="relative aspect-[16/10] bg-cream-dark">
          <img
            src={entry.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-ink/15 to-transparent" />
        </div>
      )}
      <div className="p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="tag tag-mist">
            {entryTypeLabel(entry.type, locale)}
          </span>
          <time className="text-xs tabular-nums text-ink-muted">{entry.date}</time>
        </div>
        <h3 className="mt-2 line-clamp-1 font-medium text-ink">
          {entry.title || entry.location || t('empty.noEntries')}
        </h3>
        {entry.location && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-muted">
            <MapPin className="h-3 w-3 shrink-0 text-matcha" />
            <span className="truncate">{entry.location}</span>
          </p>
        )}
        {entry.aiDiary && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">
            {entry.aiDiary}
          </p>
        )}
      </div>
    </Link>
  )
}
