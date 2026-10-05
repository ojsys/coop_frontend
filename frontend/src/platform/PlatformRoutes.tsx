import { Route, Routes } from 'react-router-dom'
import { PlatformShell } from './PlatformShell'
import { CommandCenterPage } from './pages/CommandCenterPage'
import { CooperativesPage } from './pages/CooperativesPage'
import { CooperativeDetailPage } from './pages/CooperativeDetailPage'
import { ProvisionPage } from './pages/ProvisionPage'
import { BillingPage } from './pages/BillingPage'
import { WhiteLabelPage } from './pages/WhiteLabelPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { HealthPage } from './pages/HealthPage'
import { PlatformSettingsPage } from './pages/PlatformSettingsPage'
import { GuidePage } from './pages/GuidePage'

export function PlatformRoutes() {
  return (
    <PlatformShell>
      <Routes>
        <Route index element={<CommandCenterPage />} />
        <Route path="cooperatives" element={<CooperativesPage />} />
        <Route path="cooperatives/:id" element={<CooperativeDetailPage />} />
        <Route path="provision" element={<ProvisionPage />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="white-label" element={<WhiteLabelPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="settings" element={<PlatformSettingsPage />} />
        <Route path="guide" element={<GuidePage />} />
      </Routes>
    </PlatformShell>
  )
}
