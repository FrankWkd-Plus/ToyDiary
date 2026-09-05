import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { Toast } from './components/Toast'
import { AppProvider } from './context/AppContext'
import { AppLayout } from './layout/AppLayout'
import { ComposePage } from './pages/ComposePage'
import { ConversationPage } from './pages/ConversationPage'
import { EntryDetailPage } from './pages/EntryDetailPage'
import { GrowthPage } from './pages/GrowthPage'
import { MePage } from './pages/MePage'
import { MePhotosPage } from './pages/MePhotosPage'
import { DayCountStudioPage } from './pages/DayCountStudioPage'
import {
  DataBackupPage,
  LegalPage,
  NotifySoundPage,
  PreferencesPage,
  SupportPage,
  ThemePickerPage,
} from './pages/MeSubpages'
import { NewToyPage } from './pages/NewToyPage'
import { TimelinePage } from './pages/TimelinePage'
import { ToyArchiveDetailPage } from './pages/ToyArchiveDetailPage'
import { ToysPage } from './pages/ToysPage'
import { LocaleProvider, useLocale } from './i18n'
import { ThemeProvider } from './theme/ThemeProvider'

const GrowthStatsPage = lazy(() =>
  import('./pages/GrowthStatsPage').then((m) => ({ default: m.GrowthStatsPage })),
)
const MemoryHallPage = lazy(() =>
  import('./pages/MemoryHallPage').then((m) => ({ default: m.MemoryHallPage })),
)

function RouteFallback() {
  const { t } = useLocale()
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-ink-muted">
      {t('app.loading')}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <AppProvider>
          <AuthProvider>
            <BrowserRouter>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                {/* Toy Diary is local-only; account routes intentionally do not exist. */}
                <Route
                  path="login"
                  element={<Navigate to="/archive" replace />}
                />
                <Route path="legal/terms" element={<LegalPage kind="terms" />} />
                <Route
                  path="legal/privacy"
                  element={<LegalPage kind="privacy" />}
                />
                <Route path="support" element={<SupportPage />} />

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
                  {/* Deep links → growth hub tabs (default: timeline) */}
                  <Route
                    path="growth/timeline"
                    element={<Navigate to="/growth" replace />}
                  />
                  <Route
                    path="growth/travel-map"
                    element={<Navigate to="/growth?tab=map" replace />}
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
                  <Route path="toys/new" element={<NewToyPage />} />
                  <Route path="toys/:id/edit" element={<NewToyPage />} />
                  <Route path="entries/:id" element={<EntryDetailPage />} />
                  <Route path="me" element={<MePage />} />
                  <Route path="me/photos" element={<MePhotosPage />} />
                  <Route path="days" element={<DayCountStudioPage />} />
                  <Route path="me/theme" element={<ThemePickerPage />} />
                  <Route path="me/preferences" element={<PreferencesPage />} />
                  <Route path="me/notify" element={<NotifySoundPage />} />
                  <Route path="me/data" element={<DataBackupPage />} />
                  <Route path="*" element={<Navigate to="/archive" replace />} />
                </Route>
              </Routes>
            </Suspense>
              <Toast />
            </BrowserRouter>
          </AuthProvider>
        </AppProvider>
      </LocaleProvider>
    </ThemeProvider>
  )
}
