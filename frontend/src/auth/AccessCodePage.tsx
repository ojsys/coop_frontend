import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { redeemAccessCode } from '@/api/auth'
import { apiErrorMessage } from '@/lib/apiError'
import { PlatformMark } from '@/ui/PlatformMark'
import { usePublicBranding } from '@/api/public'
import { Icon } from '@/ui/Icon'
import { Spinner } from '@/ui/Spinner'

const INPUT =
  'w-full rounded-md border border-line bg-card px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-green focus:ring-2 focus:ring-green/15'

/**
 * Choosing a password with an access code.
 *
 * For members with no email, who cannot be sent a reset link: an officer of
 * their society issues an eight-digit code from their member record and hands
 * it over. The code works once, for 72 hours.
 */
export function AccessCodePage() {
  const { data: branding } = usePublicBranding()
  const productName = branding?.name || 'CooperativeOS'
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Those passwords do not match.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await redeemAccessCode({ username, code, password })
      navigate('/login', {
        replace: true,
        state: { notice: 'Your password is set. Sign in with your phone number and new password.' },
      })
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not set your password.'))
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

        <h1 className="font-display text-2xl font-semibold text-ink">Use an access code</h1>
        <p className="mt-1 text-sm text-muted">
          Your society's secretary gives you an 8-digit code. Enter it with your
          phone number to choose your password.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">
              Phone number or email
            </span>
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={INPUT}
              placeholder="0803 000 0000"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">Access code</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${INPUT} font-mono tracking-[0.2em]`}
              placeholder="1234 5678"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT}
              placeholder="At least 8 characters"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={INPUT}
              placeholder="••••••••"
            />
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-sm text-danger">
              <Icon name="error" size={18} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-green px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-green-hover disabled:opacity-60"
          >
            {busy ? <Spinner className="size-4 border-paper/40 border-t-paper" /> : null}
            Set my password
          </button>
        </form>

        <Link
          to="/login"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-green hover:underline"
        >
          <Icon name="arrow_back" size={16} /> Back to sign in
        </Link>
      </div>
    </div>
  )
}
