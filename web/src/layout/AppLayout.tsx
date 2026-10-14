import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { LoadingBear } from '../components/LoadingBear'
import { ToyNudgeHost } from '../components/ToyNudgeHost'
import { useApp } from '../context/AppContext'
import { useLocale } from '../i18n'

export function AppLayout() {
  const { loading } = useApp()
  const { t } = useLocale()
  const { pathname, search } = useLocation()
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lockPageScroll =
    pathname.startsWith('/conversation') ||
    (pathname === '/growth' &&
      new URLSearchParams(search).get('tab') === 'map')
  const hideChrome =
    pathname === '/toys/new' || /^\/toys\/[^/]+\/edit$/.test(pathname)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  useEffect(() => {
    const viewport = window.visualViewport
    const update = () => {
      const typing = document.activeElement?.matches('input, textarea, [contenteditable="true"]')
      const reduced = Boolean(viewport && window.innerHeight - viewport.height > 70)
      setKeyboardOpen(Boolean(typing && (reduced || window.innerWidth < 430)))
      if (viewport) document.documentElement.style.setProperty('--visible-height', `${viewport.height}px`)
      if (typing && lockPageScroll) window.scrollTo(0, 0)
    }
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    update()
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
      document.documentElement.style.removeProperty('--visible-height')
    }
  }, [lockPageScroll])

  return (
    <div className={`app-shell${keyboardOpen ? ' keyboard-open' : ''}`}>
      <div className="app-frame">
        {loading ? (
          <div className="loading-screen">
            <div className="loading-screen__glow" aria-hidden="true" />
            <div className="loading-screen__orbit" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="loading-bear-wrap">
              <LoadingBear className="loading-bear h-28 w-28" />
            </div>
            <div className="loading-screen__copy">
              <p className="font-display text-xl tracking-wide text-ink">
                Toy Diary
              </p>
              <p className="mt-1.5 text-sm text-ink-muted">{t('app.opening')}</p>
              <div className="loading-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              className={`page-scroll${lockPageScroll ? ' page-scroll--locked' : ''}`}
            >
              <Outlet />
            </div>
            {!hideChrome && !keyboardOpen && <BottomNav />}
            {!hideChrome && <ToyNudgeHost />}
          </>
        )}
      </div>
    </div>
  )
}
