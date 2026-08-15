import type { Locale } from './types'

const KEY = 'toydairy.locale'

export function loadLocale(): Locale {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === 'en' || raw === 'zh') return raw
  } catch {
    /* ignore */
  }
  // Prefer browser language for first visit; default Chinese for this product.
  try {
    const nav = navigator.language?.toLowerCase() || ''
    if (nav.startsWith('en')) return 'en'
  } catch {
    /* ignore */
  }
  return 'zh'
}

export function saveLocale(locale: Locale) {
  try {
    localStorage.setItem(KEY, locale)
  } catch {
    /* ignore */
  }
}
