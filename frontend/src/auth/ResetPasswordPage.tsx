import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { confirmPasswordReset } from '@/api/auth'
import { apiErrorMessage } from '@/lib/apiError'
import { PlatformMark } from '@/ui/PlatformMark'
import { usePublicBranding } from '@/api/public'
import { Icon } from '@/ui/Icon'
import { Spinner } from '@/ui/Spinner'

export function ResetPasswordPage() {
  const { data: branding } = usePublicBranding()
  const productName = branding?.name || 'CooperativeOS'
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const uid = params.get('uid') ?? ''
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const linkIsUsable = Boolean(uid && token)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Those passwords do not match.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await confirmPasswordReset({ uid, token, password })
      navigate('/login', {
        replace: true,
        state: { notice: 'Your password has been changed. Please sign in.' },
      })
    } catch (err) {
      // Surfaces the server's reason — an expired link, or Django's password
      // validators explaining why this one is too weak.
      setError(apiErrorMessage(err, 'Could not reset your password.'))
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

        {!linkIsUsable ? (
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">
              This link isn't complete
            </h1>
            <p className="mt-2 text-sm text-muted">
              It may have been cut short by your email client. Request a fresh
              one and open it directly.
            </p>
            <Link
              to="/forgot-password"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-green hover:underline"
            >
              <Icon name="arrow_back" size={16} /> Request a new link
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold text-ink">Choose a new password</h1>
            <p className="mt-1 text-sm text-muted">
              Pick something you don't use anywhere else.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink-soft">New password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  autoFocus
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-line bg-card px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-green focus:ring-2 focus:ring-green/15"
                  placeholder="••••••••"
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
                  className="w-full rounded-md border border-line bg-card px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-green focus:ring-2 focus:ring-green/15"
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
                Set new password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
