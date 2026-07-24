/**
 * Days Matter–style 正数日 (count-up) presentation.
 * Custom backgrounds, color themes, digit fonts.
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

export const DAY_COUNT_PALETTES: {
  id: DayCountPalette
  label: string
  /** CSS color tokens used on the card */
  number: string
  labelColor: string
  unit: string
  surface: string
  border: string
}[] = [
  {
    id: 'matcha',
    label: '抹茶',
    number: '#6b8f5e',
    labelColor: '#6b635a',
    unit: '#9a8758',
    surface: 'linear-gradient(145deg, #f3f8ee 0%, #e8f5ee 55%, #fff6e0 100%)',
    border: 'rgb(184 196 168 / 0.65)',
  },
  {
    id: 'peach',
    label: '蜜桃',
    number: '#d48878',
    labelColor: '#6b524c',
    unit: '#e8a090',
    surface: 'linear-gradient(145deg, #fff5f2 0%, #ffe8e2 50%, #fff4ec 100%)',
    border: 'rgb(240 200 190 / 0.7)',
  },
  {
    id: 'sky',
    label: '雾蓝',
    number: '#54809a',
    labelColor: '#4a5a66',
    unit: '#6a9ab5',
    surface: 'linear-gradient(145deg, #f0f6f9 0%, #e0f0f6 55%, #e8f4fa 100%)',
    border: 'rgb(180 208 224 / 0.7)',
  },
  {
    id: 'lavender',
    label: '薰衣',
    number: '#7a6898',
    labelColor: '#5a5468',
    unit: '#9a88b8',
    surface: 'linear-gradient(145deg, #f6f3fa 0%, #eeeaf6 55%, #f4f0fa 100%)',
    border: 'rgb(200 190 220 / 0.7)',
  },
  {
    id: 'ink',
    label: '墨色',
    number: '#3c2f26',
    labelColor: '#5c4a3c',
    unit: '#8a7563',
    surface: 'linear-gradient(145deg, #f7f0e6 0%, #efe4d4 60%, #f5ead0 100%)',
    border: 'rgb(200 184 168 / 0.65)',
  },
  {
    id: 'sunset',
    label: '晚霞',
    number: '#c47850',
    labelColor: '#6b4a38',
    unit: '#d4a07e',
    surface: 'linear-gradient(145deg, #fff8f0 0%, #ffe8d4 45%, #ffd8c8 100%)',
    border: 'rgb(232 196 168 / 0.7)',
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

/** Background layer CSS (on top of palette surface). */
export function bgLayerStyle(
  bg: DayCountBg,
  photoUrl?: string,
  customBgUrl?: string,
): CSSProperties {
  switch (bg) {
    case 'cream':
      return {
        backgroundImage:
          'radial-gradient(ellipse 80% 60% at 20% 0%, rgb(255 255 255 / 0.7), transparent 55%)',
      }
    case 'mesh':
      return {
        backgroundImage:
          'radial-gradient(circle at 12% 20%, rgb(255 255 255 / 0.75) 0%, transparent 42%), radial-gradient(circle at 88% 10%, rgb(255 246 224 / 0.9) 0%, transparent 40%), radial-gradient(circle at 70% 90%, rgb(255 255 255 / 0.5) 0%, transparent 45%)',
      }
    case 'dots':
      return {
        backgroundImage:
          'radial-gradient(rgb(74 67 60 / 0.07) 1px, transparent 1px)',
        backgroundSize: '10px 10px',
      }
    case 'stripes':
      return {
        backgroundImage:
          'repeating-linear-gradient(-12deg, rgb(74 67 60 / 0.04) 0 2px, transparent 2px 10px)',
      }
    case 'custom': {
      const url = customBgUrl || photoUrl
      return url
        ? {
            backgroundImage: `linear-gradient(180deg, rgb(255 255 255 / 0.55), rgb(255 255 255 / 0.78)), url(${url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : {
            backgroundImage:
              'radial-gradient(circle at 50% 0%, rgb(255 255 255 / 0.6), transparent 60%)',
          }
    }
    case 'photo':
      return photoUrl
        ? {
            backgroundImage: `linear-gradient(180deg, rgb(255 255 255 / 0.72), rgb(255 255 255 / 0.88)), url(${photoUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : {
            backgroundImage:
              'radial-gradient(circle at 50% 0%, rgb(255 255 255 / 0.6), transparent 60%)',
          }
    case 'paper':
    default:
      return {}
  }
}
