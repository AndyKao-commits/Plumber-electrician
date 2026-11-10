import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '@/components/AppShell'
import { RequireAuth } from '@/components/RequireAuth'
import { queryClient } from '@/lib/queryClient'
import { AttendancePage } from '@/pages/AttendancePage'
import { HomePage } from '@/pages/HomePage'
import { InventoryPage } from '@/pages/InventoryPage'
import { LineBindCallbackPage } from '@/pages/LineBindCallbackPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { PhotosPage } from '@/pages/PhotosPage'
import { PurchasesPage } from '@/pages/PurchasesPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { QuoteDetailPage } from '@/pages/QuoteDetailPage'
import { QuotesPage } from '@/pages/QuotesPage'
import { SiteDetailPage } from '@/pages/SiteDetailPage'
import { SitesPage } from '@/pages/SitesPage'
import { TeamPage } from '@/pages/TeamPage'
import { OfflineQueuePage } from '@/pages/OfflineQueuePage'
import { TodosPage } from '@/pages/TodosPage'

function Protected({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/line-bind-callback" element={<LineBindCallbackPage />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<Protected><HomePage /></Protected>} />
            <Route path="/sites" element={<Protected><SitesPage /></Protected>} />
            <Route path="/sites/:siteId" element={<Protected><SiteDetailPage /></Protected>} />
            <Route path="/attendance" element={<Protected><AttendancePage /></Protected>} />
            <Route path="/purchases" element={<Protected><PurchasesPage /></Protected>} />
            <Route path="/quotes" element={<Protected><QuotesPage /></Protected>} />
            <Route path="/quotes/:quoteId" element={<Protected><QuoteDetailPage /></Protected>} />
            <Route path="/inventory" element={<Protected><InventoryPage /></Protected>} />
            <Route path="/notifications" element={<Protected><NotificationsPage /></Protected>} />
            <Route path="/todos" element={<Protected><TodosPage /></Protected>} />
            <Route path="/team" element={<Protected><TeamPage /></Protected>} />
            <Route path="/photos" element={<Protected><PhotosPage /></Protected>} />
            <Route path="/reports" element={<Protected><ReportsPage /></Protected>} />
            <Route path="/offline-queue" element={<Protected><OfflineQueuePage /></Protected>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
