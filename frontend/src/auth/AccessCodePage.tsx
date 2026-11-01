import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { redeemAccessCode, requestPasswordReset } from '@/api/auth'
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
 * For members with no email, who cannot be sent a reset link. The
 * eight-digit code comes by text from "Forgot password" (it works for 30
 * minutes), or from an officer of their society (72 hours). Either works once.
 */
export function AccessCodePage() {
  const { data: branding } = usePublicBranding()
  const productName = branding?.name || 'CooperativeOS'
  const navigate = useNavigate()
  // Arriving from "Forgot password", which has just texted a code.
  const arrived = (useLocation().state ?? {}) as { username?: string; texted?: boolean }

  const [username, setUsername] = useState(arrived.username ?? '')
  const [notice, setNotice] = useState<string | null>(
    arrived.texted
      ? 'If that number has an account, we\'ve texted it a code. It works for 30 minutes.'
      : null,
  )
  const [texting, setTexting] = useState(false)
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

  async function textMeACode() {
    if (!username.trim()) {
      setError('Enter your phone number first.')
      return
    }
    setError(null)
    setTexting(true)
    try {
      const reply = await requestPasswordReset(username.trim())
      setNotice(reply.detail)
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not send a code.'))
    } finally {
      setTexting(false)
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
          Enter the 8-digit code we texted you, or the one your society's
          secretary gave you, with your phone number to choose your password.
        </p>

        {notice && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-green-100 bg-green-50 px-3.5 py-3 text-sm text-ink-soft">
            <Icon name="sms" size={18} className="mt-0.5 shrink-0 text-green" />
            <span>{notice}</span>
          </div>
        )}

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
              autoFocus={!arrived.username}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={INPUT}
              placeholder="0803 000 0000"
            />
          </label>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-ink-soft">
              <label htmlFor="access-code">Access code</label>
              <button
                type="button"
                onClick={textMeACode}
                disabled={texting}
                className="text-[13px] font-medium text-green hover:underline disabled:opacity-60"
              >
                {texting ? 'Sending…' : notice ? 'Text me a new code' : 'Text me a code'}
              </button>
            </div>
            <input
              id="access-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus={!!arrived.username}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${INPUT} font-mono tracking-[0.2em]`}
              placeholder="1234 5678"
            />
          </div>
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
