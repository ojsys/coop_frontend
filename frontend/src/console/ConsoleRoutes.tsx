import { Route, Routes } from 'react-router-dom'
import { ConsoleShell } from './ConsoleShell'
import { DashboardPage } from './pages/DashboardPage'
import { MembersPage } from './pages/MembersPage'
import { MemberDetailPage } from './pages/MemberDetailPage'
import { JoinRequestsPage } from './pages/JoinRequestsPage'
import { LedgerPage } from './pages/LedgerPage'
import { ContributionTypesPage } from './pages/ContributionTypesPage'
import { ReconciliationPage } from './pages/ReconciliationPage'
import { GovernancePage } from './pages/GovernancePage'
import { ReportsPage } from './pages/ReportsPage'
import { ActivityPage } from './pages/ActivityPage'
import { DividendsPage } from './pages/DividendsPage'
import { LoansPage } from './pages/LoansPage'
import { WithdrawalsPage } from './pages/WithdrawalsPage'
import { PayoutsPage } from './pages/PayoutsPage'
import { WalletPage } from './pages/WalletPage'
import { ApprovalsPage } from './pages/ApprovalsPage'
import { AnnouncementsPage } from './pages/AnnouncementsPage'
import { SettingsPage } from './pages/SettingsPage'
import { GuidePage } from './pages/GuidePage'

export function ConsoleRoutes() {
  return (
    <ConsoleShell>
      <Routes>
        <Route index element={<DashboardPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="members/:id" element={<MemberDetailPage />} />
        <Route path="join-requests" element={<JoinRequestsPage />} />
        <Route path="ledger" element={<LedgerPage />} />
        <Route path="contribution-types" element={<ContributionTypesPage />} />
        <Route path="reconciliation" element={<ReconciliationPage />} />
        <Route path="governance" element={<GovernancePage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="withdrawals" element={<WithdrawalsPage />} />
        <Route path="payouts" element={<PayoutsPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="dividends" element={<DividendsPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="guide" element={<GuidePage />} />
      </Routes>
    </ConsoleShell>
  )
}
