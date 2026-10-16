import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { landingSurface } from './api/auth'
import { RequireAuth, RequireSurface } from './auth/guards'
import { LoginPage } from './auth/LoginPage'
import { ForgotPasswordPage } from './auth/ForgotPasswordPage'
import { LandingPage } from './marketing/LandingPage'
import { LegalPage } from './marketing/LegalPage'
import { SignupPage } from './marketing/SignupPage'
import { AccountDeletePage, AccountDeleteConfirmPage } from './marketing/AccountDeletePage'
import { ResetPasswordPage } from './auth/ResetPasswordPage'
import { InvoicePayPage } from './billing/InvoicePayPage'
import { FullscreenSpinner } from './ui/Spinner'
import { ConsoleRoutes } from './console/ConsoleRoutes'
import { MemberRoutes } from './member/MemberRoutes'
import { PlatformRoutes } from './platform/PlatformRoutes'
import { PlatformShell } from './platform/PlatformShell'
import { SiteActivityPage } from './platform/pages/SiteActivityPage'
import { ImpersonationBanner } from './ui/ImpersonationBanner'
import { useFavicon } from './lib/useFavicon'
import { useGoogleAnalytics } from './lib/useGoogleAnalytics'
import { usePublicBranding } from './api/public'

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <FullscreenSpinner />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={`/${landingSurface(user)}`} replace />
}

export function App() {
  // White-label the browser tab: the society's own mark where it has one,
  // otherwise the platform's. Platform admins have no membership at all, so
  // without the fallback that surface never left the bundled default.
  const { activeMembership } = useAuth()
  const { data: branding } = usePublicBranding()
  useFavicon(activeMembership?.cooperative_favicon || branding?.favicon)
  // Measurement ID is admin-editable and served by the API, so tracking can be
  // turned on, changed or switched off without a redeploy.
  useGoogleAnalytics(branding?.ga_measurement_id)

  return (
    <>
      <ImpersonationBanner />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Public: reached from an email link, so never behind RequireAuth. */}
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/join/:code" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      {/* Account deletion without the app — the URL given to Google Play. */}
      <Route path="/account/delete" element={<AccountDeletePage />} />
      <Route path="/account/delete/confirm" element={<AccountDeleteConfirmPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      {/* Reached from the subscription invoice email. Public by necessity: the
          officer who pays may have no account at all, and the pay token in the
          URL is the authorisation. */}
      <Route path="/billing/pay/:token" element={<InvoicePayPage />} />
      {/* Public, for everyone — signed in or not. This used to bounce an
          authenticated user straight to their surface, which meant there was
          no way back out to the public site once you had an account: the
          redirect fired before the page could render. The convenience it was
          providing now lives in the landing header as a link to your own
          dashboard, which is a shortcut rather than a trap. */}
      <Route path="/" element={<LandingPage />} />
      {/* Public and unauthenticated by requirement, not just convenience:
          Google Play needs a privacy policy URL it can open without an
          account, and the same page carries the account-deletion route Play
          requires for any app with sign-in. Keep it outside RequireAuth. */}
      <Route path="/privacy" element={<LegalPage slug="privacy" />} />
      <Route path="/terms" element={<LegalPage slug="terms" />} />
      {/* Any other policy page an admin creates is reachable here without a
          code change — that is the point of keeping the text in the admin. */}
      <Route path="/legal/:slug" element={<LegalPage />} />

      <Route
        path="/console/*"
        element={
          <RequireAuth>
            <RequireSurface surface="console">
              <ConsoleRoutes />
            </RequireSurface>
          </RequireAuth>
        }
      />
      <Route
        path="/app/*"
        element={
          <RequireAuth>
            <RequireSurface surface="app">
              <MemberRoutes />
            </RequireSurface>
          </RequireAuth>
        }
      />
      <Route
        path="/platform/*"
        element={
          <RequireAuth>
            <RequireSurface surface="platform">
              <PlatformRoutes />
            </RequireSurface>
          </RequireAuth>
        }
      />

      {/* Top-level /analytics, as asked for, rather than nested under
          /platform — so it wears the platform shell explicitly. Gated the same
          way: site-wide activity spans every tenant, so only platform admins
          may see it. */}
      <Route
        path="/analytics"
        element={
          <RequireAuth>
            <RequireSurface surface="platform">
              <PlatformShell>
                <SiteActivityPage />
              </PlatformShell>
            </RequireSurface>
          </RequireAuth>
        }
      />

      <Route path="*" element={<RootRedirect />} />
      </Routes>
    </>
  )
}
