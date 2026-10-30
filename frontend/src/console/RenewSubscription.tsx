import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useToast } from '@/ui/toast'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { apiErrorMessage } from '@/lib/apiError'
import { longDate, naira } from '@/lib/format'
import { useSubscriptionState } from './subscription'
import { useAuth } from '@/auth/AuthContext'

/**
 * Renewing the society's subscription from the console.
 *
 * The invoice email has always carried a pay link; this is the same link,
 * reached without the inbox. The server raises the invoice if the daily
 * billing cycle has not yet done so (platform_admin/renew_views.py).
 *
 * While the subscription has lapsed the console is locked down to this: the
 * dashboard shows nothing else, and every other page but Settings and the
 * Guide is replaced by it. The server refuses officer actions too, so this is
 * the honest picture rather than the only lock.
 */

function useRenew() {
  const navigate = useNavigate()
  const toast = useToast()
  const { refresh } = useAuth()
  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ pay_token: string; paid: boolean }>('/subscription/renew/')
      return data
    },
  })
  return {
    pending: mutation.isPending,
    renew: async () => {
      try {
        // Always asks the server: it checks with Paystack first, so a payment
        // whose confirmation went astray unlocks here instead of being paid twice.
        const { pay_token, paid } = await mutation.mutateAsync()
        if (paid) {
          await refresh()
          toast('Your payment is confirmed. Welcome back.')
          return
        }
        navigate(`/billing/pay/${pay_token}`)
      } catch (err) {
        toast(apiErrorMessage(err, 'Could not start the renewal.'), 'error')
      }
    },
  }
}

/**
 * The bold renewal card. Shown when the subscription has lapsed, or when an
 * invoice is waiting (a gentler version, since the console still works).
 * Renders nothing otherwise.
 */
export function RenewPanel({ className = 'mb-5' }: { className?: string }) {
  const { plan, lapsed, invoice, canPay } = useSubscriptionState()
  const { renew, pending } = useRenew()
  if (!plan?.name || (!lapsed && !invoice)) return null

  const amount = invoice?.amount ?? plan.cycle_amount
  const per = plan.billing_cycle === 'annual' ? 'year' : 'month'
  const trialEnded = plan.status === 'trial'

  const title = lapsed
    ? trialEnded
      ? 'Your free trial has ended'
      : plan.status === 'canceled'
        ? 'Your subscription was cancelled'
        : 'Your subscription has ended'
    : 'Your renewal is due'
  const body = lapsed
    ? 'Most of the console is locked until you renew. Your records are safe, and members can still sign in and see their balances.'
    : `Pay${invoice?.due_at ? ` by ${longDate(invoice.due_at)}` : ''} to keep every part of the console open.`

  return (
    <div
      className={`${className} rounded-2xl border-2 p-5 sm:p-6 ${
        lapsed ? 'border-danger bg-danger-50' : 'border-gold bg-gold-50'
      }`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <span
          className={`flex size-12 shrink-0 items-center justify-center rounded-full ${
            lapsed ? 'bg-danger text-paper' : 'bg-gold text-ink'
          }`}
        >
          <Icon name={lapsed ? 'lock' : 'schedule'} size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">{title}</h2>
          <p className="mt-1 text-[14px] text-ink-soft">{body}</p>
          <p className="mt-3 text-[14px] font-semibold text-ink">
            {plan.name} plan
            {amount && <> · {naira(amount)} per {per}</>}
            {invoice && (
              <span className="ml-2 font-mono text-[12px] font-normal text-muted">
                {invoice.number}
              </span>
            )}
          </p>
        </div>
        {canPay ? (
          <Button
            icon="autorenew"
            loading={pending}
            onClick={renew}
            className="w-full px-6 py-3 text-[15px] sm:w-auto"
          >
            {lapsed ? 'Renew subscription' : 'Pay now'}
          </Button>
        ) : (
          <p className="w-full text-[13px] font-medium text-ink-soft sm:w-56">
            Ask your Chairperson, Secretary or Treasurer to renew.
          </p>
        )}
      </div>
    </div>
  )
}

/** What a locked page shows instead of itself. */
export function LockedPage() {
  return (
    <div className="max-w-3xl pt-2">
      <RenewPanel />
    </div>
  )
}
