import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AdvancedErpGate } from '@/components/AdvancedErpGate'
import { AppShell } from '@/components/AppShell'
import { RequireAuth } from '@/components/RequireAuth'
import { queryClient } from '@/lib/queryClient'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { AttendancePage } from '@/pages/AttendancePage'
import { ComplaintsPage } from '@/pages/ComplaintsPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { HomePage } from '@/pages/HomePage'
import { RepairsPage } from '@/pages/RepairsPage'
import { InventoryPage } from '@/pages/InventoryPage'
import { LineBindCallbackPage } from '@/pages/LineBindCallbackPage'
import { LoginPage } from '@/pages/LoginPage'
import { MorePage } from '@/pages/MorePage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { PhotosPage } from '@/pages/PhotosPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { LocationCheckinPage } from '@/pages/LocationCheckinPage'
import { MySalaryPage } from '@/pages/MySalaryPage'
import { AccessPage } from '@/pages/AccessPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { SalaryAdminPage } from '@/pages/SalaryAdminPage'
import { PurchasesPage } from '@/pages/PurchasesPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { QuoteDetailPage } from '@/pages/QuoteDetailPage'
import { QuotesPage } from '@/pages/QuotesPage'
import { SiteDetailPage } from '@/pages/SiteDetailPage'
import { SitesPage } from '@/pages/SitesPage'
import { TeamPage } from '@/pages/TeamPage'
import { OfflineQueuePage } from '@/pages/OfflineQueuePage'
import { AuditPage } from '@/pages/AuditPage'
import { ExpensesPage } from '@/pages/ExpensesPage'
import { PettyCashPage } from '@/pages/PettyCashPage'
import { SuppliersPage } from '@/pages/SuppliersPage'
import { TodosPage } from '@/pages/TodosPage'

function Protected({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>
}

function Advanced({ children }: { children: ReactNode }) {
  return (
    <Protected>
      <AdvancedErpGate>{children}</AdvancedErpGate>
    </Protected>
  )
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
            <Route path="/expenses" element={<Protected><ExpensesPage /></Protected>} />
            <Route path="/more" element={<Protected><MorePage /></Protected>} />
            <Route path="/quotes" element={<Protected><QuotesPage /></Protected>} />
            <Route path="/quotes/:quoteId" element={<Protected><QuoteDetailPage /></Protected>} />
            <Route path="/notifications" element={<Protected><NotificationsPage /></Protected>} />
            <Route path="/todos" element={<Protected><TodosPage /></Protected>} />
            <Route path="/team" element={<Protected><TeamPage /></Protected>} />
            <Route path="/photos" element={<Protected><PhotosPage /></Protected>} />
            <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
            <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
            <Route path="/access" element={<Protected><AccessPage /></Protected>} />
            <Route path="/my-salary" element={<Protected><MySalaryPage /></Protected>} />
            <Route path="/salary" element={<Protected><SalaryAdminPage /></Protected>} />
            <Route path="/location-checkin" element={<Protected><LocationCheckinPage /></Protected>} />
            <Route path="/reports" element={<Protected><ReportsPage /></Protected>} />
            <Route path="/audit" element={<Protected><AuditPage /></Protected>} />
            {/* Advanced ERP: kept for code, hidden in V1.0 navigation */}
            <Route path="/customers" element={<Advanced><CustomersPage /></Advanced>} />
            <Route path="/repairs" element={<Advanced><RepairsPage /></Advanced>} />
            <Route path="/complaints" element={<Advanced><ComplaintsPage /></Advanced>} />
            <Route path="/analytics" element={<Advanced><AnalyticsPage /></Advanced>} />
            <Route path="/purchases" element={<Advanced><PurchasesPage /></Advanced>} />
            <Route path="/inventory" element={<Advanced><InventoryPage /></Advanced>} />
            <Route path="/petty-cash" element={<Advanced><PettyCashPage /></Advanced>} />
            <Route path="/suppliers" element={<Advanced><SuppliersPage /></Advanced>} />
            <Route path="/offline-queue" element={<Advanced><OfflineQueuePage /></Advanced>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
