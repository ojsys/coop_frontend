import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useConfirmEmail } from '@/api/verification'
import { useAuth } from '@/auth/AuthContext'
import { apiErrorMessage } from '@/lib/apiError'
import { usePublicBranding } from '@/api/public'
import { PlatformMark } from '@/ui/PlatformMark'
import { Icon } from '@/ui/Icon'
import { Spinner } from '@/ui/Spinner'

/**
 * Where the "confirm your email" link lands. Public: it is often opened on a
 * phone where the person is not signed in, and the signed token is the whole
 * authorisation. Confirms on arrival — there is nothing to fill in.
 */
export function VerifyEmailPage() {
  const { data: branding } = usePublicBranding()
  const productName = branding?.name || 'CooperativeOS'
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { user, refresh } = useAuth()
  const confirm = useConfirmEmail()
  const [error, setError] = useState<string | null>(null)
  // Held in component state, not read off the mutation: under StrictMode the
  // first mount's mutation observer is discarded, so its result never shows.
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null)
  const sent = useRef(false)

  useEffect(() => {
    // Once only: React's development double-invoke would otherwise post twice.
    if (!token || sent.current) return
    sent.current = true
    confirm
      .mutateAsync(token)
      .then((data) => {
        setConfirmedEmail(data.email)
        if (user) void refresh()
      })
      .catch((err) => setError(apiErrorMessage(err, 'Could not confirm your email.')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const next = user ? '/console' : '/login'

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <PlatformMark size={40} />
          <span className="font-display text-lg font-semibold text-ink">{productName}</span>
        </div>

        {!token || error ? (
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">
              We couldn't confirm that link
            </h1>
            <p className="mt-2 text-sm text-muted">
              {error ?? 'This link is incomplete.'} You can ask for a new one from your
              console dashboard.
            </p>
          </div>
        ) : confirmedEmail ? (
          <div>
            <span className="flex size-12 items-center justify-center rounded-full bg-green-50 text-green">
              <Icon name="mark_email_read" size={26} />
            </span>
            <h1 className="mt-5 font-display text-2xl font-semibold text-ink">Email confirmed</h1>
            <p className="mt-2 text-sm text-muted">
              Thank you — {confirmedEmail} is confirmed.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-muted">
            <Spinner className="size-5" /> Confirming your email…
          </div>
        )}

        {(confirmedEmail || error || !token) && (
          <Link
            to={next}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-green hover:underline"
          >
            {user ? 'Go to your console' : 'Sign in'} <Icon name="arrow_forward" size={16} />
          </Link>
        )}
      </div>
    </div>
  )
}
