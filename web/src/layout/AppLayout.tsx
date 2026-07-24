import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { LoadingBear } from '../components/LoadingBear'
import { ToyNudgeHost } from '../components/ToyNudgeHost'
import { useApp } from '../context/AppContext'

export function AppLayout() {
  const { loading } = useApp()
  const { pathname } = useLocation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const lockPageScroll = pathname.startsWith('/conversation')

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="app-shell">
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
                Toy Dairy
              </p>
              <p className="mt-1.5 text-sm text-ink-muted">正在打开手帐…</p>
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
            <BottomNav />
            <ToyNudgeHost />
          </>
        )}
      </div>
    </div>
  )
}
