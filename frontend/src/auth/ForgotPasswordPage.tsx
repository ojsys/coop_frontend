import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestPasswordReset } from '@/api/auth'
import { apiErrorMessage } from '@/lib/apiError'
import { PlatformMark } from '@/ui/PlatformMark'
import { usePublicBranding } from '@/api/public'
import { Icon } from '@/ui/Icon'
import { Spinner } from '@/ui/Spinner'

export function ForgotPasswordPage() {
  const { data: branding } = usePublicBranding()
  const productName = branding?.name || 'CooperativeOS'
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await requestPasswordReset(email)
      // The API answers identically for unknown addresses, so this confirms
      // the request was accepted — never that an account exists.
      setSent(true)
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not send the reset link.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <PlatformMark size={40} />
          <span className="font-display text-lg font-semibold text-ink">{productName}</span>
        </div>

        {sent ? (
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Check your email</h1>
            <p className="mt-2 text-sm text-muted">
              If <span className="text-ink-soft">{email}</span> has an account, a
              reset link is on its way. It expires in a few hours and can only be
              used once.
            </p>
            <p className="mt-4 text-sm text-muted">
              Nothing arrived? Check your spam folder, or{' '}
              <button
                onClick={() => setSent(false)}
                className="font-medium text-green hover:underline"
              >
                try another address
              </button>
              .
            </p>
            <Link
              to="/login"
              className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-green hover:underline"
            >
              <Icon name="arrow_back" size={16} /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold text-ink">Reset your password</h1>
            <p className="mt-1 text-sm text-muted">
              Enter the email address on your account and we'll send you a link
              to choose a new password.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink-soft">Email</span>
                <input
                  type="email"
                  autoComplete="username"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-line bg-card px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-green focus:ring-2 focus:ring-green/15"
                  placeholder="you@yourcoop.coop"
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
                Send reset link
              </button>
            </form>

            <Link
              to="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-green hover:underline"
            >
              <Icon name="arrow_back" size={16} /> Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
