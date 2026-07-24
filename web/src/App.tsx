import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AppLayout } from './layout/AppLayout'
import { ComposePage } from './pages/ComposePage'
import { ConversationPage } from './pages/ConversationPage'
import { EntryDetailPage } from './pages/EntryDetailPage'
import { GrowthPage } from './pages/GrowthPage'
import { GrowthStatsPage } from './pages/GrowthStatsPage'
import { GrowthTimelinePage } from './pages/GrowthTimelinePage'
import { MePage } from './pages/MePage'
import { MemoryHallPage } from './pages/MemoryHallPage'
import { NewToyPage } from './pages/NewToyPage'
import { SettingsPage } from './pages/SettingsPage'
import { TimelinePage } from './pages/TimelinePage'
import { ToyArchiveDetailPage } from './pages/ToyArchiveDetailPage'
import { ToysPage } from './pages/ToysPage'
import { TravelMapPage } from './pages/TravelMapPage'
import { ThemeProvider } from './theme/ThemeProvider'

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/archive" replace />} />
              <Route path="archive" element={<TimelinePage />} />
              <Route path="archive/toys/:id" element={<ToyArchiveDetailPage />} />
              <Route path="memories/:id" element={<MemoryHallPage />} />
              <Route path="timeline" element={<Navigate to="/archive" replace />} />
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
        </BrowserRouter>
      </AppProvider>
    </ThemeProvider>
  )
}
