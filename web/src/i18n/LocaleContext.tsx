import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { MESSAGES } from './messages'
import { loadLocale, saveLocale } from './storage'
import type { Locale } from './types'

export type TranslateFn = (
  key: string,
  vars?: Record<string, string | number>,
) => string

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  toggleLocale: () => void
  t: TranslateFn
  /** BCP-47 tag for dates / Accept-Language */
  dateLocale: string
  acceptLanguage: string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function format(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] === undefined || vars[k] === null ? `{${k}}` : String(vars[k]),
  )
}

export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dict = MESSAGES[locale] || MESSAGES.zh
  const fallback = MESSAGES.zh[key]
  const raw = dict[key] ?? fallback ?? key
  return format(raw, vars)
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Chinese-only MVP: keep the localization infrastructure, but always start
  // in Chinese until every product surface has a complete English version.
  const [locale, setLocaleState] = useState<Locale>('zh')

  useEffect(() => {
    saveLocale('zh')
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    saveLocale(next)
  }, [])

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next: Locale = prev === 'zh' ? 'en' : 'zh'
      saveLocale(next)
      return next
    })
  }, [])

  const t = useCallback<TranslateFn>(
    (key, vars) => translate(locale, key, vars),
    [locale],
  )

  useEffect(() => {
    try {
      document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN'
      document.title =
        locale === 'en' ? 'Toy Diary' : 'Toy Diary · 玩偶日记'
    } catch {
      /* ignore */
    }
  }, [locale])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t,
      dateLocale: locale === 'en' ? 'en-US' : 'zh-CN',
      acceptLanguage:
        locale === 'en' ? 'en,en-US;q=0.9,zh;q=0.3' : 'zh-CN,zh;q=0.9,en;q=0.4',
    }),
    [locale, setLocale, toggleLocale, t],
  )

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}

/** Safe helper when outside provider (e.g. pure utils during tests). */
export function getStoredLocale(): Locale {
  return loadLocale()
}
