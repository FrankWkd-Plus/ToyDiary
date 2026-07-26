import { useLocale } from '../i18n'
import { useApp } from '../context/AppContext'

/**
 * Compact ZH | EN toggle — used on archive home top-left.
 */
export function LanguageSwitch({
  className = '',
  showToastOnSwitch = true,
}: {
  className?: string
  showToastOnSwitch?: boolean
}) {
  const { locale, setLocale, t } = useLocale()
  const { showToast } = useApp()

  function pick(next: 'zh' | 'en') {
    if (next === locale) return
    setLocale(next)
    if (showToastOnSwitch) {
      showToast(next === 'zh' ? t('lang.toastZh') : t('lang.toastEn'))
    }
  }

  return (
    <div
      className={`inline-flex items-center rounded-full bg-white/90 p-0.5 text-[10px] font-semibold shadow-[var(--shadow-warm-sm)] ring-1 ring-line/50 ${className}`}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => pick('zh')}
        className={`min-h-7 min-w-[2.1rem] rounded-full px-2 py-1 transition-colors ${
          locale === 'zh'
            ? 'bg-matcha text-white'
            : 'text-ink-muted active:bg-cream'
        }`}
        aria-pressed={locale === 'zh'}
        title={t('lang.switchToZh')}
      >
        {t('lang.zh')}
      </button>
      <button
        type="button"
        onClick={() => pick('en')}
        className={`min-h-7 min-w-[2.1rem] rounded-full px-2 py-1 transition-colors ${
          locale === 'en'
            ? 'bg-matcha text-white'
            : 'text-ink-muted active:bg-cream'
        }`}
        aria-pressed={locale === 'en'}
        title={t('lang.switchToEn')}
      >
        {t('lang.en')}
      </button>
    </div>
  )
}
