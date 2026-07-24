import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  bgLayerStyle,
  getFont,
  getPalette,
  loadDayCountStyle,
  type DayCountStyle,
} from '../daysmatter/dayCountTheme'

export type DayCountSize = 'hero' | 'card' | 'stat' | 'inline'

/**
 * Days Matter–style big number: 正数日 / 统计数字统一视觉。
 */
export function DayCountNumber({
  value,
  label,
  unit = '天',
  size = 'card',
  style: styleOverride,
  photoUrl,
  sublabel,
  to,
  onClick,
  className = '',
  /** Allow album custom bg only for export preview — never site chrome by default */
  allowExportBg = false,
}: {
  value: number | string
  label: string
  unit?: string
  size?: DayCountSize
  style?: Partial<DayCountStyle>
  photoUrl?: string
  sublabel?: string
  to?: string
  onClick?: () => void
  className?: string
  allowExportBg?: boolean
}) {
  const [saved, setSaved] = useState(loadDayCountStyle)
  useEffect(() => {
    const onStorage = () => setSaved(loadDayCountStyle())
    window.addEventListener('storage', onStorage)
    // same-tab updates
    window.addEventListener('toydairy-daycount-style', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('toydairy-daycount-style', onStorage)
    }
  }, [])

  const style: DayCountStyle = {
    ...saved,
    ...styleOverride,
  }
  // Site-wide day-count never uses album custom photo; only pattern / photo-blur optional
  const siteBg =
    style.bg === 'custom' && !allowExportBg
      ? 'mesh'
      : style.bg
  const palette = getPalette(style.palette)
  const font = getFont(style.font)
  const display =
    typeof value === 'number' && Number.isFinite(value)
      ? String(Math.max(0, Math.floor(value)))
      : String(value)

  const sizeClass =
    size === 'hero'
      ? 'daycount daycount--hero'
      : size === 'stat'
        ? 'daycount daycount--stat'
        : size === 'inline'
          ? 'daycount daycount--inline'
          : 'daycount daycount--card'

  const body = (
    <div
      className={`${sizeClass} ${className}`.trim()}
      style={
        {
          '--dc-number': palette.number,
          '--dc-label': palette.labelColor,
          '--dc-unit': palette.unit,
          '--dc-border': palette.border,
          '--dc-font': font.family,
          background: palette.surface,
        } as CSSProperties
      }
    >
      <div
        className="daycount__bg"
        style={bgLayerStyle(
          siteBg,
          // diary photo blur only when bg === 'photo' and explicitly passed
          siteBg === 'photo' ? photoUrl : undefined,
          allowExportBg ? style.customBgUrl : undefined,
        )}
        aria-hidden
      />
      <div className="daycount__content">
        <p className="daycount__label">{label}</p>
        <p className="daycount__row">
          <span className="daycount__number">{display}</span>
          {unit ? <span className="daycount__unit">{unit}</span> : null}
        </p>
        {sublabel ? <p className="daycount__sub">{sublabel}</p> : null}
      </div>
    </div>
  )

  if (to) {
    return (
      <Link to={to} className="block no-underline" aria-label={`${label} ${display}${unit}`}>
        {body}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full border-0 bg-transparent p-0 text-left"
        aria-label={`${label} ${display}${unit}`}
      >
        {body}
      </button>
    )
  }
  return body
}

/** Compact 2×2 / row of stats with shared day-count styling. */
export function DayCountStatGrid({
  items,
}: {
  items: {
    key: string
    value: number | string
    label: string
    unit?: string
    to?: string
  }[]
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <DayCountNumber
          key={item.key}
          value={item.value}
          label={item.label}
          unit={item.unit ?? ''}
          size="stat"
          to={item.to}
        />
      ))}
    </div>
  )
}

export function DayCountStyleProviderNote({ children }: { children?: ReactNode }) {
  return children ?? null
}

/** Broadcast style changes to mounted DayCountNumber instances. */
export function broadcastDayCountStyle() {
  window.dispatchEvent(new Event('toydairy-daycount-style'))
}
