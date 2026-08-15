export type ThemeId = 'mint' | 'warm' | 'sky' | 'peach' | 'lavender'

export interface ThemeMeta {
  id: ThemeId
  name: string
  desc: string
  /** preview swatches */
  swatches: [string, string, string]
  themeColor: string
}

/** CSS variable overrides applied to documentElement */
export type ThemeVars = Record<string, string>

export const THEMES: Record<ThemeId, ThemeMeta & { vars: ThemeVars }> = {
  mint: {
    id: 'mint',
    name: 'Matcha Mint',
    desc: 'Fresh & cuddly — default',
    swatches: ['#d4ecc8', '#b5a06a', '#fff6e0'],
    themeColor: '#d4ecc8',
    vars: {
      '--color-cream': '#f3f8ee',
      '--color-cream-dark': '#e5efdc',
      '--color-almond': '#f7faf3',
      '--color-paper': '#ffffff',
      '--color-ink': '#4a433c',
      '--color-ink-soft': '#6b635a',
      '--color-ink-muted': '#9a9186',
      '--color-terra': '#c4b08a',
      '--color-terra-deep': '#b5a06a',
      '--color-terra-soft': '#f5f0e0',
      '--color-mustard': '#f0c96a',
      '--color-mustard-soft': '#fff6e0',
      '--color-honey': '#f0c96a',
      '--color-mist': '#8fbfa8',
      '--color-mist-soft': '#e8f5ee',
      '--color-sky': '#8fbfa8',
      '--color-mint': '#cfe8c4',
      '--color-mint-deep': '#a8d48e',
      '--color-matcha': '#b5a06a',
      '--color-matcha-deep': '#9a8758',
      '--color-peach': '#ffd4c8',
      '--color-peach-soft': '#fff0eb',
      '--color-lavender': '#e8e0f5',
      '--color-rose': '#e8b4a8',
      '--color-rose-deep': '#d49488',
      '--color-sage': '#a8d48e',
      '--color-coral': '#e8b4a8',
      '--color-line': '#e8e4dc',
      '--shell-bg': '#e8efe3',
      '--header-from': '#d4ecc8',
      '--header-mid': '#e8f5dc',
      '--promo-bg': '#ff9e9e',
    },
  },
  warm: {
    id: 'warm',
    name: 'Warm Journal',
    desc: 'Cream apricot + terracotta',
    swatches: ['#f5e6d4', '#c4957a', '#efe4cd'],
    themeColor: '#f0e4d4',
    vars: {
      '--color-cream': '#f7f0e6',
      '--color-cream-dark': '#efe4d4',
      '--color-almond': '#f3e8d8',
      '--color-paper': '#fffaf3',
      '--color-ink': '#3c2f26',
      '--color-ink-soft': '#5c4a3c',
      '--color-ink-muted': '#8a7563',
      '--color-terra': '#c4957a',
      '--color-terra-deep': '#b07a5c',
      '--color-terra-soft': '#f0e4db',
      '--color-mustard': '#e2b75a',
      '--color-mustard-soft': '#f5ead0',
      '--color-honey': '#e2b75a',
      '--color-mist': '#b8a090',
      '--color-mist-soft': '#f0e8e0',
      '--color-sky': '#b8a090',
      '--color-mint': '#e8d5c4',
      '--color-mint-deep': '#c4a090',
      '--color-matcha': '#c4957a',
      '--color-matcha-deep': '#a67c68',
      '--color-peach': '#e8c4b0',
      '--color-peach-soft': '#faf0e8',
      '--color-lavender': '#ebe4dc',
      '--color-rose': '#d4a07e',
      '--color-rose-deep': '#b07a5c',
      '--color-sage': '#b0a890',
      '--color-coral': '#d4a07e',
      '--color-line': '#e8dfd2',
      '--shell-bg': '#ebe0d4',
      '--header-from': '#f0dcc8',
      '--header-mid': '#f5ebe0',
      '--promo-bg': '#e8a090',
    },
  },
  sky: {
    id: 'sky',
    name: 'Misty Sky',
    desc: 'Cool blue-gray, clean modern',
    swatches: ['#d4e8f0', '#6a9ab5', '#e8f4fa'],
    themeColor: '#d4e8f0',
    vars: {
      '--color-cream': '#f0f6f9',
      '--color-cream-dark': '#dceaf2',
      '--color-almond': '#eef5f9',
      '--color-paper': '#ffffff',
      '--color-ink': '#2f3a42',
      '--color-ink-soft': '#4a5a66',
      '--color-ink-muted': '#7a8e9a',
      '--color-terra': '#8ab0c4',
      '--color-terra-deep': '#6a9ab5',
      '--color-terra-soft': '#e4f0f6',
      '--color-mustard': '#a8c8d8',
      '--color-mustard-soft': '#e8f4fa',
      '--color-honey': '#a8c8d8',
      '--color-mist': '#7aadc4',
      '--color-mist-soft': '#e0f0f6',
      '--color-sky': '#7aadc4',
      '--color-mint': '#c4e0ec',
      '--color-mint-deep': '#8ab8cc',
      '--color-matcha': '#6a9ab5',
      '--color-matcha-deep': '#54809a',
      '--color-peach': '#c8dce8',
      '--color-peach-soft': '#f0f6fa',
      '--color-lavender': '#dce4f0',
      '--color-rose': '#a0b8c8',
      '--color-rose-deep': '#6a9ab5',
      '--color-sage': '#90b8a8',
      '--color-coral': '#90b0c4',
      '--color-line': '#d8e4ec',
      '--shell-bg': '#dce8f0',
      '--header-from': '#c4e0ec',
      '--header-mid': '#e0f0f6',
      '--promo-bg': '#7ab0c8',
    },
  },
  peach: {
    id: 'peach',
    name: 'Peach Blush',
    desc: 'Soft peach-pink, cozy vibe',
    swatches: ['#ffd8d0', '#e8a090', '#fff0eb'],
    themeColor: '#ffd8d0',
    vars: {
      '--color-cream': '#fff5f2',
      '--color-cream-dark': '#ffe8e2',
      '--color-almond': '#fff8f5',
      '--color-paper': '#ffffff',
      '--color-ink': '#4a3834',
      '--color-ink-soft': '#6b524c',
      '--color-ink-muted': '#a08a84',
      '--color-terra': '#e8a898',
      '--color-terra-deep': '#d48878',
      '--color-terra-soft': '#fff0eb',
      '--color-mustard': '#f0c0a8',
      '--color-mustard-soft': '#fff4ec',
      '--color-honey': '#f0c0a8',
      '--color-mist': '#e8b0a8',
      '--color-mist-soft': '#fff0ee',
      '--color-sky': '#e8b0a8',
      '--color-mint': '#ffd8d0',
      '--color-mint-deep': '#f0b0a0',
      '--color-matcha': '#e8a090',
      '--color-matcha-deep': '#c87868',
      '--color-peach': '#ffd4c8',
      '--color-peach-soft': '#fff0eb',
      '--color-lavender': '#f5e0e8',
      '--color-rose': '#f0b0a8',
      '--color-rose-deep': '#d48878',
      '--color-sage': '#e0b8a8',
      '--color-coral': '#e8a090',
      '--color-line': '#f0e0dc',
      '--shell-bg': '#f5e4e0',
      '--header-from': '#ffd8d0',
      '--header-mid': '#fff0eb',
      '--promo-bg': '#f09090',
    },
  },
  lavender: {
    id: 'lavender',
    name: 'Lavender Haze',
    desc: 'Soft purple, quiet comfort',
    swatches: ['#e4dcf0', '#9a88b8', '#f4f0fa'],
    themeColor: '#e4dcf0',
    vars: {
      '--color-cream': '#f6f3fa',
      '--color-cream-dark': '#e8e2f2',
      '--color-almond': '#f4f0f8',
      '--color-paper': '#ffffff',
      '--color-ink': '#3a3548',
      '--color-ink-soft': '#5a5468',
      '--color-ink-muted': '#9088a0',
      '--color-terra': '#b0a0c8',
      '--color-terra-deep': '#9a88b8',
      '--color-terra-soft': '#f0ecf8',
      '--color-mustard': '#c8b8e0',
      '--color-mustard-soft': '#f4f0fa',
      '--color-honey': '#c8b8e0',
      '--color-mist': '#a898c0',
      '--color-mist-soft': '#eeeaf6',
      '--color-sky': '#a898c0',
      '--color-mint': '#ddd4f0',
      '--color-mint-deep': '#b0a0d0',
      '--color-matcha': '#9a88b8',
      '--color-matcha-deep': '#7a6898',
      '--color-peach': '#e0d4f0',
      '--color-peach-soft': '#f6f2fa',
      '--color-lavender': '#e8e0f5',
      '--color-rose': '#c0b0d8',
      '--color-rose-deep': '#9a88b8',
      '--color-sage': '#b0a8c8',
      '--color-coral': '#b0a0c8',
      '--color-line': '#e4dceb',
      '--shell-bg': '#e4dcec',
      '--header-from': '#ddd4f0',
      '--header-mid': '#eeeaf6',
      '--promo-bg': '#b898c8',
    },
  },
}

export const THEME_LIST = Object.values(THEMES).map(
  ({ vars: _v, ...meta }) => meta,
)

export const DEFAULT_THEME: ThemeId = 'mint'
export const THEME_STORAGE_KEY = 'toydairy.theme'

export function isThemeId(v: string | null | undefined): v is ThemeId {
  return !!v && v in THEMES
}

export function applyTheme(id: ThemeId) {
  const theme = THEMES[id]
  const root = document.documentElement
  root.setAttribute('data-theme', id)
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value)
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme.themeColor)
}

export function loadStoredTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemeId(raw)) return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME
}

export function storeTheme(id: ThemeId) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}
