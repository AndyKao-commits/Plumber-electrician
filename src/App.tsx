import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '@/components/AppShell'
import { RequireAuth } from '@/components/RequireAuth'
import { queryClient } from '@/lib/queryClient'
import { AttendancePage } from '@/pages/AttendancePage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { SiteDetailPage } from '@/pages/SiteDetailPage'
import { SitesPage } from '@/pages/SitesPage'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppShell />}>
            <Route
              path="/"
              element={
                <RequireAuth>
                  <HomePage />
                </RequireAuth>
              }
            />
            <Route
              path="/sites"
              element={
                <RequireAuth>
                  <SitesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/sites/:siteId"
              element={
                <RequireAuth>
                  <SiteDetailPage />
                </RequireAuth>
              }
            />
            <Route
              path="/attendance"
              element={
                <RequireAuth>
                  <AttendancePage />
                </RequireAuth>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
