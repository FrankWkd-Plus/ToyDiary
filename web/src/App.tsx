import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AppLayout } from './layout/AppLayout'
import { ComposePage } from './pages/ComposePage'
import { ConversationPage } from './pages/ConversationPage'
import { EntryDetailPage } from './pages/EntryDetailPage'
import { GrowthPage } from './pages/GrowthPage'
import { MePage } from './pages/MePage'
import { NewToyPage } from './pages/NewToyPage'
import { SettingsPage } from './pages/SettingsPage'
import { TimelinePage } from './pages/TimelinePage'
import { ToyArchiveDetailPage } from './pages/ToyArchiveDetailPage'
import { ToysPage } from './pages/ToysPage'
import { ThemeProvider } from './theme/ThemeProvider'

// Heavy / secondary routes — load on demand so cold start stays light.
const TravelMapPage = lazy(() =>
  import('./pages/TravelMapPage').then((m) => ({ default: m.TravelMapPage })),
)
const GrowthTimelinePage = lazy(() =>
  import('./pages/GrowthTimelinePage').then((m) => ({
    default: m.GrowthTimelinePage,
  })),
)
const GrowthStatsPage = lazy(() =>
  import('./pages/GrowthStatsPage').then((m) => ({ default: m.GrowthStatsPage })),
)
const MemoryHallPage = lazy(() =>
  import('./pages/MemoryHallPage').then((m) => ({ default: m.MemoryHallPage })),
)

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-ink-muted">
      加载中…
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/archive" replace />} />
                <Route path="archive" element={<TimelinePage />} />
                <Route
                  path="archive/toys/:id"
                  element={<ToyArchiveDetailPage />}
                />
                <Route path="memories/:id" element={<MemoryHallPage />} />
                <Route
                  path="timeline"
                  element={<Navigate to="/archive" replace />}
                />
                <Route path="growth" element={<GrowthPage />} />
                <Route path="growth/travel-map" element={<TravelMapPage />} />
                <Route path="growth/timeline" element={<GrowthTimelinePage />} />
                <Route path="growth/stats/:kind" element={<GrowthStatsPage />} />
                <Route path="compose" element={<ComposePage />} />
                <Route path="conversation" element={<ConversationPage />} />
                <Route
                  path="community/*"
                  element={<Navigate to="/conversation" replace />}
                />
                <Route path="toys" element={<ToysPage />} />
                <Route path="toys/new" element={<NewToyPage />} />
                <Route path="entries/:id" element={<EntryDetailPage />} />
                <Route path="me" element={<MePage />} />
                <Route path="me/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/archive" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AppProvider>
    </ThemeProvider>
  )
}
