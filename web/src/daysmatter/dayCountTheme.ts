/**
 * Days Matter–style 正数日 (count-up) presentation.
 * Palettes are built from global theme CSS variables so they follow
 * mint / warm / sky / peach / lavender when the site theme changes.
 */

import type { CSSProperties } from 'react'

export type DayCountPalette =
  | 'matcha'
  | 'peach'
  | 'sky'
  | 'lavender'
  | 'ink'
  | 'sunset'

export type DayCountFont = 'display' | 'rounded' | 'mono' | 'serif'

export type DayCountBg =
  | 'paper'
  | 'cream'
  | 'mesh'
  | 'dots'
  | 'stripes'
  | 'photo'
  | 'custom'

export interface DayCountStyle {
  palette: DayCountPalette
  font: DayCountFont
  bg: DayCountBg
  /** Data URL / object URL for custom album background */
  customBgUrl?: string
}

/** Solid + surface tokens as CSS (var / color-mix / gradient). Safe for DOM. */
export interface DayCountPaletteColors {
  id: DayCountPalette
  label: string
  number: string
  labelColor: string
  unit: string
  surface: string
  border: string
}

/**
 * All daycount color roles point at global theme tokens
 * (`web/src/theme/themes.ts` / `index.css` @theme).
 * Switching site theme re-tints every palette automatically.
 */
export const DAY_COUNT_PALETTES: DayCountPaletteColors[] = [
  {
    id: 'matcha',
    label: '主色',
    number: 'var(--color-matcha-deep)',
    labelColor: 'var(--color-ink-soft)',
    unit: 'var(--color-matcha)',
    surface:
      'linear-gradient(145deg, var(--color-cream) 0%, var(--color-mist-soft) 55%, var(--color-mustard-soft) 100%)',
    border: 'color-mix(in srgb, var(--color-matcha) 38%, transparent)',
  },
  {
    id: 'peach',
    label: '蜜桃',
    number: 'var(--color-rose-deep)',
    labelColor: 'var(--color-ink-soft)',
    unit: 'var(--color-coral)',
    surface:
      'linear-gradient(145deg, var(--color-cream) 0%, var(--color-peach-soft) 50%, var(--color-mustard-soft) 100%)',
    border: 'color-mix(in srgb, var(--color-peach) 55%, transparent)',
  },
  {
    id: 'sky',
    label: '雾蓝',
    // Deepen sky/mist so digits stay readable across all site themes
    number: 'color-mix(in srgb, var(--color-sky) 58%, var(--color-ink))',
    labelColor: 'var(--color-ink-soft)',
    unit: 'var(--color-mist)',
    surface:
      'linear-gradient(145deg, var(--color-cream) 0%, var(--color-mist-soft) 55%, color-mix(in srgb, var(--color-sky) 18%, white) 100%)',
    border: 'color-mix(in srgb, var(--color-sky) 42%, transparent)',
  },
  {
    id: 'lavender',
    label: '薰衣',
    number: 'color-mix(in srgb, var(--color-lavender) 42%, var(--color-ink))',
    labelColor: 'var(--color-ink-soft)',
    unit: 'color-mix(in srgb, var(--color-lavender) 55%, var(--color-matcha-deep))',
    surface:
      'linear-gradient(145deg, var(--color-cream) 0%, color-mix(in srgb, var(--color-lavender) 55%, white) 55%, var(--color-peach-soft) 100%)',
    border: 'color-mix(in srgb, var(--color-lavender) 60%, transparent)',
  },
  {
    id: 'ink',
    label: '墨色',
    number: 'var(--color-ink)',
    labelColor: 'var(--color-ink-soft)',
    unit: 'var(--color-ink-muted)',
    surface:
      'linear-gradient(145deg, var(--color-cream) 0%, var(--color-cream-dark) 60%, var(--color-almond) 100%)',
    border: 'color-mix(in srgb, var(--color-ink) 16%, transparent)',
  },
  {
    id: 'sunset',
    label: '晚霞',
    number: 'var(--color-terra-deep)',
    labelColor: 'var(--color-ink-soft)',
    unit: 'var(--color-terra)',
    surface:
      'linear-gradient(145deg, var(--color-mustard-soft) 0%, var(--color-terra-soft) 45%, var(--color-peach-soft) 100%)',
    border: 'color-mix(in srgb, var(--color-terra) 40%, transparent)',
  },
]

export const DAY_COUNT_FONTS: {
  id: DayCountFont
  label: string
  /** CSS font-family stack (for DOM DayCountNumber) */
  family: string
}[] = [
  {
    id: 'display',
    label: '手帐标题',
    family: "'ZCOOL XiaoWei', 'Noto Serif SC', Georgia, serif",
  },
  {
    id: 'rounded',
    label: '圆润数字',
    family:
      "'Nunito', 'Noto Sans SC', ui-rounded, system-ui, sans-serif",
  },
  {
    id: 'mono',
    label: '等宽数码',
    family:
      "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  {
    id: 'serif',
    label: '衬线典雅',
    family: "Georgia, 'Noto Serif SC', 'Songti SC', serif",
  },
]

export const DAY_COUNT_BGS: { id: DayCountBg; label: string }[] = [
  { id: 'paper', label: '素纸' },
  { id: 'cream', label: '奶油' },
  { id: 'mesh', label: '光斑' },
  { id: 'dots', label: '点点' },
  { id: 'stripes', label: '细条' },
  { id: 'photo', label: '照片晕' },
  { id: 'custom', label: '相册' },
]

export const DEFAULT_DAY_COUNT_STYLE: DayCountStyle = {
  palette: 'matcha',
  font: 'display',
  bg: 'mesh',
}

const STYLE_KEY = 'toydairy.daycount.style'

export function loadDayCountStyle(): DayCountStyle {
  try {
    const raw = localStorage.getItem(STYLE_KEY)
    if (!raw) return { ...DEFAULT_DAY_COUNT_STYLE }
    const parsed = JSON.parse(raw) as Partial<DayCountStyle>
    // customBgUrl is export-only and must never drive site chrome
    const bg =
      DAY_COUNT_BGS.some((b) => b.id === parsed.bg) && parsed.bg !== 'custom'
        ? (parsed.bg as DayCountBg)
        : DEFAULT_DAY_COUNT_STYLE.bg
    return {
      palette: DAY_COUNT_PALETTES.some((p) => p.id === parsed.palette)
        ? (parsed.palette as DayCountPalette)
        : DEFAULT_DAY_COUNT_STYLE.palette,
      font: DAY_COUNT_FONTS.some((f) => f.id === parsed.font)
        ? (parsed.font as DayCountFont)
        : DEFAULT_DAY_COUNT_STYLE.font,
      bg,
      // Intentionally dropped — album photo is session/export-only
      customBgUrl: undefined,
    }
  } catch {
    return { ...DEFAULT_DAY_COUNT_STYLE }
  }
}

export function saveDayCountStyle(style: DayCountStyle) {
  try {
    // Never persist album custom photo into site theme storage
    const safe: DayCountStyle = {
      palette: style.palette,
      font: style.font,
      bg: style.bg === 'custom' ? 'mesh' : style.bg,
    }
    localStorage.setItem(STYLE_KEY, JSON.stringify(safe))
  } catch {
    /* ignore */
  }
}

export function getPalette(id: DayCountPalette) {
  return DAY_COUNT_PALETTES.find((p) => p.id === id) || DAY_COUNT_PALETTES[0]
}

export function getFont(id: DayCountFont) {
  return DAY_COUNT_FONTS.find((f) => f.id === id) || DAY_COUNT_FONTS[0]
}

/** Resolve a CSS color expression against the live document theme. */
export function resolveCssColor(
  cssColor: string,
  fallback = '#4a433c',
): string {
  if (typeof document === 'undefined') return fallback
  // Bare hex / rgb already canvas-safe
  if (/^#|^rgb|^hsl/i.test(cssColor.trim())) return cssColor.trim()
  try {
    const probe = document.createElement('span')
    probe.style.color = cssColor
    probe.style.position = 'absolute'
    probe.style.visibility = 'hidden'
    probe.style.pointerEvents = 'none'
    document.documentElement.appendChild(probe)
    const resolved = getComputedStyle(probe).color
    probe.remove()
    return resolved && resolved !== 'rgba(0, 0, 0, 0)' ? resolved : fallback
  } catch {
    return fallback
  }
}

/** Read a theme custom property from :root (e.g. '--color-cream'). */
export function resolveThemeVar(
  varName: string,
  fallback: string,
): string {
  if (typeof document === 'undefined') return fallback
  const name = varName.startsWith('--') ? varName : `--${varName}`
  try {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim()
    return v || fallback
  } catch {
    return fallback
  }
}

/**
 * Canvas-safe solid colors for a daycount palette (vars resolved).
 * Use in PNG export paths only — DOM should keep CSS var strings.
 */
export function resolvePaletteForCanvas(id: DayCountPalette = 'matcha') {
  const p = getPalette(id)
  return {
    id: p.id,
    label: p.label,
    number: resolveCssColor(p.number, '#9a8758'),
    labelColor: resolveCssColor(p.labelColor, '#6b635a'),
    unit: resolveCssColor(p.unit, '#b5a06a'),
    border: resolveCssColor(p.border, 'rgba(184,196,168,0.65)'),
    cream: resolveThemeVar('--color-cream', '#f3f8ee'),
    creamDark: resolveThemeVar('--color-cream-dark', '#e5efdc'),
    mistSoft: resolveThemeVar('--color-mist-soft', '#e8f5ee'),
    mustardSoft: resolveThemeVar('--color-mustard-soft', '#fff6e0'),
    ink: resolveThemeVar('--color-ink', '#4a433c'),
    matcha: resolveThemeVar('--color-matcha', '#b5a06a'),
    headerFrom: resolveThemeVar('--header-from', '#d4ecc8'),
    headerMid: resolveThemeVar('--header-mid', '#e8f5dc'),
  }
}

/** Background layer CSS (on top of palette surface) — theme-aware. */
export function bgLayerStyle(
  bg: DayCountBg,
  photoUrl?: string,
  customBgUrl?: string,
): CSSProperties {
  switch (bg) {
    case 'cream':
      return {
        backgroundImage:
          'radial-gradient(ellipse 80% 60% at 20% 0%, color-mix(in srgb, var(--color-paper) 70%, transparent), transparent 55%)',
      }
    case 'mesh':
      return {
        backgroundImage:
          'radial-gradient(circle at 12% 20%, color-mix(in srgb, var(--color-paper) 75%, transparent) 0%, transparent 42%), radial-gradient(circle at 88% 10%, color-mix(in srgb, var(--color-mustard-soft) 90%, transparent) 0%, transparent 40%), radial-gradient(circle at 70% 90%, color-mix(in srgb, var(--color-paper) 50%, transparent) 0%, transparent 45%)',
      }
    case 'dots':
      return {
        backgroundImage:
          'radial-gradient(color-mix(in srgb, var(--color-ink) 7%, transparent) 1px, transparent 1px)',
        backgroundSize: '10px 10px',
      }
    case 'stripes':
      return {
        backgroundImage:
          'repeating-linear-gradient(-12deg, color-mix(in srgb, var(--color-ink) 4%, transparent) 0 2px, transparent 2px 10px)',
      }
    case 'custom': {
      const url = customBgUrl || photoUrl
      return url
        ? {
            backgroundImage: `linear-gradient(180deg, color-mix(in srgb, var(--color-paper) 55%, transparent), color-mix(in srgb, var(--color-paper) 78%, transparent)), url(${url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : {
            backgroundImage:
              'radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--color-paper) 60%, transparent), transparent 60%)',
          }
    }
    case 'photo':
      return photoUrl
        ? {
            backgroundImage: `linear-gradient(180deg, color-mix(in srgb, var(--color-paper) 72%, transparent), color-mix(in srgb, var(--color-paper) 88%, transparent)), url(${photoUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : {
            backgroundImage:
              'radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--color-paper) 60%, transparent), transparent 60%)',
          }
    case 'paper':
    default:
      return {}
  }
}
