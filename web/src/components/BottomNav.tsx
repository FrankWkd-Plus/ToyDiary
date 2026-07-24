import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import {
  ConversationNavIcon,
  DiaryNavIcon,
  GrowthNavIcon,
  MeNavIcon,
} from './NavIcons'
import { RecordMethodSheet } from './RecordMethodSheet'

const tabs = [
  { to: '/archive', label: '档案', icon: DiaryNavIcon },
  { to: '/growth', label: '成长', icon: GrowthNavIcon },
  { to: '/compose', label: '', icon: Plus, center: true },
  { to: '/conversation', label: '对话', icon: ConversationNavIcon },
  { to: '/me', label: '我的', icon: MeNavIcon },
] as const

export function BottomNav() {
  const { pathname } = useLocation()
  const [composerOpen, setComposerOpen] = useState(false)

  return (
    <nav
      className="bottom-nav z-20"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="relative flex h-[4.5rem] items-end justify-around px-1">
        {tabs.map((tab) => {
          if ('center' in tab && tab.center) {
            return (
              <button
                key={tab.to}
                type="button"
                onClick={() => setComposerOpen(true)}
                className="fab-float -mt-7 flex flex-col items-center"
                aria-label="新增记录"
              >
                <span className="relative flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full bg-gradient-to-b from-[color-mix(in_srgb,var(--color-matcha)_90%,white)] to-[var(--color-matcha-deep)] text-white shadow-[var(--shadow-glow)] ring-[3px] ring-paper transition-transform active:scale-95">
                  <Plus className="h-7 w-7" strokeWidth={2.5} />
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-peach text-[9px] shadow-sm ring-2 ring-paper">
                    ✨
                  </span>
                </span>
              </button>
            )
          }
          const active =
            pathname === tab.to ||
            (tab.to === '/me' &&
              (pathname.startsWith('/me') || pathname.startsWith('/toys'))) ||
            (tab.to === '/conversation' &&
              pathname.startsWith('/conversation')) ||
            (tab.to === '/archive' &&
              (pathname.startsWith('/archive') ||
                pathname.startsWith('/entries') ||
                pathname.startsWith('/memories')))
          const TabIcon = tab.icon
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-all duration-200 ${
                active ? 'font-semibold text-matcha-deep' : 'text-ink-muted'
              }`}
            >
              {active && (
                <span className="absolute -top-0.5 left-1/2 h-11 w-11 -translate-x-1/2 rounded-2xl bg-mustard-soft/90 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.6)]" />
              )}
              <TabIcon
                className={`relative h-7 w-7 transition-transform duration-200 ${
                  active ? 'scale-110' : ''
                }`}
              />
              <span className="relative tracking-wide">{tab.label}</span>
              {active && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-matcha" />
              )}
            </Link>
          )
        })}
      </div>

      <RecordMethodSheet
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
      />
    </nav>
  )
}
