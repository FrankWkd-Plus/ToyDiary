import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export function PageHeader({
  title,
  subtitle,
  back,
  right,
  soft,
}: {
  title: string
  subtitle?: string
  back?: boolean | string
  right?: ReactNode
  /** soft gradient header band */
  soft?: boolean
}) {
  const nav = useNavigate()
  return (
    <header
      className={`sticky top-0 z-10 flex items-center gap-2.5 px-3.5 py-3.5 ${
        soft
          ? 'header-band pattern-soft'
          : 'border-b border-line/50 bg-paper/90 backdrop-blur-xl'
      }`}
    >
      {back !== undefined && back !== false && (
        <button
          type="button"
          onClick={() => {
            if (typeof back === 'string') nav(back)
            else nav(-1)
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper/95 text-ink-soft shadow-[var(--shadow-warm-sm)] ring-1 ring-line/40 transition-transform active:scale-95"
          aria-label="返回"
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
