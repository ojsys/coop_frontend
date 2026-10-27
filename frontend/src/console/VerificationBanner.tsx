import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useResendEmailVerification } from '@/api/verification'
import { useToast } from '@/ui/toast'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { apiErrorMessage } from '@/lib/apiError'

/**
 * The standing prompt on the dashboard while a society is not yet verified.
 *
 * A society is live from signup and can keep its books at once; verification
 * (its exco's IDs and its registration certificate) is what opens online
 * payments. So this never blocks anything — it says what waits, how long the
 * trial has left, and links to the checklist.
 */
export function VerificationBanner() {
  const { user, activeMembership } = useAuth()
  const resend = useResendEmailVerification()
  const toast = useToast()
  if (!activeMembership?.is_officer) return null

  const status = activeMembership.cooperative_verification
  const plan = activeMembership.plan
  const trialDaysLeft =
    plan?.status === 'trial' && plan.renews_on
      ? Math.max(0, Math.ceil((new Date(plan.renews_on).getTime() - Date.now()) / 86_400_000))
      : null
  const emailUnconfirmed = user?.email_verified === false

  // Older servers send no status; say nothing rather than guess.
  if (!status || status === 'verified') {
    if (trialDaysLeft == null || trialDaysLeft > 7) return null
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-card px-4 py-3">
        <Icon name="schedule" size={20} className="shrink-0 text-muted" />
        <div className="min-w-0 flex-1 text-[13px] text-ink-soft">
          <span className="font-semibold text-ink">{trialLabel(trialDaysLeft)}.</span>{' '}
          We'll email an invoice for the {plan?.name ?? 'your'} plan when it ends.
        </div>
      </div>
    )
  }

  const copy = {
    not_started: {
      title: 'Verify your cooperative to start taking payments online.',
      body: 'Your exco uploads their IDs and you add the certificate of registration. Until then, members can’t pay online and loans can’t be paid out electronically — everything else works.',
      cta: 'Start verification',
    },
    submitted: {
      title: 'Verification is with us.',
      body: 'We’ll email your officers once we’ve checked it — usually within two working days.',
      cta: 'View submission',
    },
    changes_requested: {
      title: 'We need a change before we can verify you.',
      body: 'See the note from our reviewer, fix it and send it again.',
      cta: 'See what to change',
    },
  }[status]

  const tone =
    status === 'changes_requested'
      ? 'border-danger/30 bg-danger-50'
      : status === 'submitted'
        ? 'border-line bg-card'
        : 'border-gold/30 bg-gold-50'

  return (
    <div className={`mb-4 rounded-lg border px-4 py-3 ${tone}`}>
      <div className="flex flex-wrap items-center gap-3">
        <Icon
          name={status === 'submitted' ? 'hourglass_top' : 'verified_user'}
          size={20}
          className={`shrink-0 ${status === 'changes_requested' ? 'text-danger' : 'text-gold-deep'}`}
        />
        <div className="min-w-0 flex-1 text-[13px] text-ink-soft">
          <span className="font-semibold text-ink">{copy.title}</span> {copy.body}
          {trialDaysLeft != null && (
            <span className="ml-1 whitespace-nowrap text-muted">· {trialLabel(trialDaysLeft)}</span>
          )}
        </div>
        <Link to="/console/verification">
          <Button size="sm" variant={status === 'submitted' ? 'secondary' : 'primary'}>
            {copy.cta}
          </Button>
        </Link>
      </div>
      {emailUnconfirmed && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-black/5 pt-2.5 text-[13px] text-ink-soft">
          <Icon name="mail" size={17} className="shrink-0 text-muted" />
          <span className="min-w-0 flex-1">
            Confirm your email address — we sent a link to <strong>{user?.email}</strong>.
          </span>
          <button
            type="button"
            className="font-semibold text-green hover:underline disabled:opacity-60"
            disabled={resend.isPending}
            onClick={async () => {
              try {
                toast((await resend.mutateAsync()).detail)
              } catch (err) {
                toast(apiErrorMessage(err, 'Could not send the link.'), 'error')
              }
            }}
          >
            Send it again
          </button>
        </div>
      )}
    </div>
  )
}

function trialLabel(days: number) {
  if (days === 0) return 'Free trial ends today'
  return `Free trial: ${days} day${days === 1 ? '' : 's'} left`
}
