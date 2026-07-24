import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireLogin, RequireSession } from './auth/RequireAuth'
import { Toast } from './components/Toast'
import { AppProvider } from './context/AppContext'
import { AppLayout } from './layout/AppLayout'
import { ComposePage } from './pages/ComposePage'
import { ConversationPage } from './pages/ConversationPage'
import { EntryDetailPage } from './pages/EntryDetailPage'
import { GrowthPage } from './pages/GrowthPage'
import { LoginPage } from './pages/LoginPage'
import { MePage } from './pages/MePage'
import { DayCountStudioPage } from './pages/DayCountStudioPage'
import {
  DataBackupPage,
  HelpAboutPage,
  HelpCenterPage,
  HelpDocsPage,
  HelpSupportPage,
  LegalPage,
  NotifySoundPage,
  ProfileSettingsPage,
  ThemePickerPage,
  VersionPage,
} from './pages/MeSubpages'
import { NewToyPage } from './pages/NewToyPage'
import { TimelinePage } from './pages/TimelinePage'
import { ToyArchiveDetailPage } from './pages/ToyArchiveDetailPage'
import { ToysPage } from './pages/ToysPage'
import { ThemeProvider } from './theme/ThemeProvider'

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
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="login" element={<LoginPage />} />
                <Route path="legal/terms" element={<LegalPage kind="terms" />} />
                <Route
                  path="legal/privacy"
                  element={<LegalPage kind="privacy" />}
                />

                <Route
                  element={
                    <RequireSession>
                      <AppLayout />
                    </RequireSession>
                  }
                >
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
                  <Route
                    path="growth/timeline"
                    element={<GrowthTimelinePage />}
                  />
                  <Route
                    path="growth/stats/:kind"
                    element={<GrowthStatsPage />}
                  />
                  <Route path="compose" element={<ComposePage />} />
                  <Route path="conversation" element={<ConversationPage />} />
                  <Route
                    path="community/*"
                    element={<Navigate to="/conversation" replace />}
                  />
                  <Route path="toys" element={<ToysPage />} />
                  <Route
                    path="toys/new"
                    element={
                      <RequireLogin>
                        <NewToyPage />
                      </RequireLogin>
                    }
                  />
                  <Route path="entries/:id" element={<EntryDetailPage />} />
                  <Route path="me" element={<MePage />} />
                  <Route path="days" element={<DayCountStudioPage />} />
                  <Route path="me/profile" element={<ProfileSettingsPage />} />
                  <Route path="me/theme" element={<ThemePickerPage />} />
                  <Route path="me/notify" element={<NotifySoundPage />} />
                  <Route path="me/data" element={<DataBackupPage />} />
                  <Route path="me/version" element={<VersionPage />} />
                  <Route path="me/settings" element={<ProfileSettingsPage />} />
                  <Route path="help" element={<HelpCenterPage />} />
                  <Route path="help/docs" element={<HelpDocsPage />} />
                  <Route path="help/support" element={<HelpSupportPage />} />
                  <Route path="help/about" element={<HelpAboutPage />} />
                  <Route path="*" element={<Navigate to="/archive" replace />} />
                </Route>
              </Routes>
            </Suspense>
            {/* Global toast so /login & legal pages can feedback too */}
            <Toast />
          </BrowserRouter>
        </AuthProvider>
      </AppProvider>
    </ThemeProvider>
  )
}
