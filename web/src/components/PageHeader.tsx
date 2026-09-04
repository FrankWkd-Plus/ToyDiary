import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useLocale } from '../i18n'

export function PageHeader({
  title,
  subtitle,
  back,
  right,
  soft,
  bare,
}: {
  title: string
  subtitle?: string
  back?: boolean | string
  right?: ReactNode
  /** soft gradient header band */
  soft?: boolean
  /** transparent header for collection sub-pages that sit on the app canvas */
  bare?: boolean
}) {
  const nav = useNavigate()
  const { t } = useLocale()
  return (
    <header
      className={`page-header z-10 flex items-center gap-2.5 px-3.5 ${
        bare
          ? 'bg-transparent'
          : soft
          ? 'header-band pattern-soft'
          : 'border-b border-line/50 bg-paper/90 backdrop-blur-xl'
      }`}
    >
      {/*
       * NOTE: vertical padding is intentionally NOT set via Tailwind here.
       * `.page-header` in index.css owns padding-top / padding-bottom
       * and also sets `position: relative; z-index: 10`. Adding a `py-*`
       * utility here would race with that CSS rule (same specificity,
       * load-order dependent) and cause the header to randomly clip under
       * the Dynamic Island.
       *
       * NOTE: this header is intentionally NOT `sticky`. A sticky header
       * floats over the first card on any scroll and visually clips its
       * rounded top. Detail pages are short and the title scrolling away
       * is the lesser evil.
       */}
      {back !== undefined && back !== false && (
        <button
          type="button"
          onClick={() => {
            if (typeof back === 'string') nav(back)
            else nav(-1)
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper/95 text-ink-soft shadow-[var(--shadow-warm-sm)] ring-1 ring-line/40 transition-transform active:scale-95"
          aria-label={t('app.back')}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {/* Avoid display font for CJK titles — ZCOOL XiaoWei can render 回 as a black blob */}
        <h1 className="truncate text-[1.15rem] font-semibold leading-tight tracking-wide text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-ink-muted">{subtitle}</p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  )
}
