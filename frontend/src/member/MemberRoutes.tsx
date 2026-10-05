import { Route, Routes } from 'react-router-dom'
import { MemberShell } from './MemberShell'
import { HomePage } from './pages/HomePage'
import { SavingsPage } from './pages/SavingsPage'
import { ContributePage } from './pages/ContributePage'
import { VotePage } from './pages/VotePage'
import { ProfilePage } from './pages/ProfilePage'
import { PayCallbackPage } from './pages/PayCallbackPage'
import { MockCheckoutPage } from './pages/MockCheckoutPage'
import { LoansPage } from './pages/LoansPage'
import { LoanDetailPage } from './pages/LoanDetailPage'
import { SavingsGoalsPage } from './pages/SavingsGoalsPage'
import { DividendsPage } from './pages/DividendsPage'

export function MemberRoutes() {
  return (
    <MemberShell>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="savings" element={<SavingsPage />} />
        <Route path="contribute" element={<ContributePage />} />
        <Route path="pay/mock" element={<MockCheckoutPage />} />
        <Route path="pay/callback" element={<PayCallbackPage />} />
        <Route path="vote" element={<VotePage />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="loans/:id" element={<LoanDetailPage />} />
        <Route path="savings-goals" element={<SavingsGoalsPage />} />
        <Route path="dividends" element={<DividendsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Routes>
    </MemberShell>
  )
}
