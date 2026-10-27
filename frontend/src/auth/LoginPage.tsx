import { useState } from 'react'
import type { AxiosError } from 'axios'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { landingSurface } from '@/api/auth'
import { PlatformMark } from '@/ui/PlatformMark'
import { usePublicBranding, usePublicSiteContent } from '@/api/public'
import { Spinner } from '@/ui/Spinner'
import { Icon } from '@/ui/Icon'

/**
 * Why this is not `apiErrorMessage`: on a rejected sign-in the server's own
 * wording would reveal whether the address is registered, so the credential
 * case stays deliberately vague. Everything else is not a secret — and saying
 * "Invalid email or password" when the server is unreachable sends someone off
 * to reset a password that was never wrong.
 */
function loginErrorMessage(error: unknown): string {
  const response = (error as AxiosError)?.response
  // No response at all: DNS, offline, CORS, or the server is down.
  if (!response) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  // DRF's obtain_auth_token answers 400 (not 401) for bad credentials.
  if (response.status === 400 || response.status === 401) {
    return 'Invalid email or password.'
  }
  if (response.status === 429) {
    const retry = Number(
      (response.headers as Record<string, string> | undefined)?.['retry-after'],
    )
    if (Number.isFinite(retry) && retry > 0) {
      const mins = Math.ceil(retry / 60)
      return `Too many sign-in attempts. Try again in about ${mins} minute${mins === 1 ? '' : 's'}.`
    }
    return 'Too many sign-in attempts. Please wait a while and try again.'
  }
  if (response.status >= 500) {
    return 'Something went wrong on our end. Please try again in a moment.'
  }
  return 'Could not sign in. Please try again.'
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  // Set by ResetPasswordPage after a successful reset, so the redirect lands
  // with an explanation rather than silently.
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const { data: branding } = usePublicBranding()
  // The brand panel repeats the landing page's pitch, so it reads from the
  // same CMS row. Hardcoding it here is how this page was still advertising
  // "African cooperatives" long after the landing page had stopped.
  const { data: cms } = usePublicSiteContent()
  const productName = branding?.name || 'CooperativeOS'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const user = await login(email, password)
      navigate(`/${landingSurface(user)}`, { replace: true })
    } catch (err) {
      setError(loginErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-green p-12 text-paper lg:flex">
        <div className="flex items-center gap-3">
          <PlatformMark size={44} />
          <div>
            <div className="font-display text-lg font-semibold">{productName}</div>
            <div className="text-xs text-green-200">
              {cms?.footer.tagline || 'by Startup Ripple'}
            </div>
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight">
            {cms?.hero.title ||
              'A digital operating layer for cooperatives everywhere.'}
          </h1>
          <p className="mt-4 text-green-100">
            {cms?.hero.subtitle ||
              'Membership, contributions, governance and audit-ready reporting — on an append-only ledger. Contributions settle straight into your cooperative’s own bank account.'}
          </p>
          <div className="mt-8 flex flex-wrap gap-2 font-mono text-[11px] text-green-100">
            <span className="rounded-full border border-white/15 px-3 py-1">Ledger first</span>
            <span className="rounded-full border border-white/15 px-3 py-1">Tenant-isolated</span>
            <span className="rounded-full border border-white/15 px-3 py-1">Reconciled</span>
          </div>
        </div>
        {/* Kept static rather than built from the CMS trust badges: those are
            full sentences and would overflow this strip. It names no single
            country's regulator — this page is served worldwide. */}
        <div className="text-xs text-green-200">
          Data-protection compliant · signed PSP webhooks · 2FA for finance roles
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(217,158,43,.25), transparent 70%)' }}
        />
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-paper p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <PlatformMark size={40} />
            <span className="font-display text-lg font-semibold text-ink">{productName}</span>
          </div>

          <h2 className="font-display text-2xl font-semibold text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-muted">Welcome back. Access your cooperative.</p>

          {notice && (
            <div className="mt-4 flex items-start gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green">
              <Icon name="check_circle" size={18} />
              <span>{notice}</span>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">Email</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-line bg-card px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-green focus:ring-2 focus:ring-green/15"
                placeholder="you@yourcoop.coop"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-line bg-card px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-green focus:ring-2 focus:ring-green/15"
                placeholder="••••••••"
              />
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-danger-50 px-3 py-2 text-sm text-danger">
                <Icon name="error" size={18} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-green px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-green-hover disabled:opacity-60"
            >
              {busy ? <Spinner className="size-4 border-paper/40 border-t-paper" /> : null}
              Sign in
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="font-medium text-green hover:underline">
              Forgot your password?
            </Link>
            <Link to="/" className="text-muted transition hover:text-ink">
              Back to site
            </Link>
          </div>

          <p className="mt-6 border-t border-line pt-5 text-sm text-muted">
            New here?{' '}
            <Link to="/signup" className="font-medium text-green hover:underline">
              Get started free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
