import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  usePublicBranding,
  usePublicInvoice,
  startInvoicePayment,
  verifyInvoicePayment,
} from '@/api/public'
import { openPaystackCheckout } from '@/lib/paystack'
import { PlatformMark } from '@/ui/PlatformMark'
import { Spinner } from '@/ui/Spinner'
import { Icon } from '@/ui/Icon'
import { apiErrorMessage } from '@/lib/apiError'
import { naira, shortDate } from '@/lib/format'

/**
 * The page an officer lands on from the invoice email.
 *
 * Deliberately public and deliberately plain: the reader has no session, may
 * not be a platform user at all, and arrived from their inbox. The pay token in
 * the URL is the whole authorisation, so nothing here lists other invoices or
 * reveals anything the email did not already contain.
 */
export function InvoicePayPage() {
  const { token } = useParams<{ token: string }>()
  const { data: branding } = usePublicBranding()
  const { data: invoice, isLoading, isError, error, refetch } =
    usePublicInvoice(token)

  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)

  async function pay() {
    if (!token) return
    setBusy(true)
    setMessage(null)
    try {
      const started = await startInvoicePayment(token)

      if (started.payment_error) {
        setMessage(started.payment_error)
        return
      }
      // Redirect checkout when the server gave us one; it survives a page
      // reload better than the modal for someone coming from email.
      if (started.authorization_url) {
        window.location.assign(started.authorization_url)
        return
      }
      // Otherwise the on-page modal, which needs the key and the reference.
      if (started.paystack_public_key && started.reference && started.payer_email) {
        await openPaystackCheckout({
          publicKey: started.paystack_public_key,
          email: started.payer_email,
          amountKobo: Math.round(Number(started.amount) * 100),
          reference: started.reference,
          // No subaccount: this is the platform billing the cooperative, so
          // settlement belongs to the platform, not to their own account.
          onSuccess: async (reference) => {
            try {
              const result = await verifyInvoicePayment(reference)
              setPaid(result.paid)
              setMessage(
                result.paid
                  ? 'Payment received — thank you.'
                  : 'Payment is still being confirmed. Refresh in a moment.',
              )
              refetch()
            } catch (err) {
              setMessage(apiErrorMessage(err, 'Could not confirm the payment.'))
            }
          },
          onClose: () => setMessage('Payment was cancelled.'),
        })
        return
      }

      setMessage(
        'Online payment is not available yet. Reply to the invoice email and ' +
          'we will send bank transfer details.',
      )
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Could not start the payment.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-5">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <PlatformMark size={34} />
          <span className="font-display text-lg font-semibold text-ink">
            {branding?.name || 'CooperativeOS'}
          </span>
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Spinner className="size-6" />
          </div>
        )}

        {isError && (
          <Panel
            icon="link_off"
            title="This payment link is not valid"
            body={apiErrorMessage(
              error,
              'It may have expired, or the invoice may already be settled. Reply to the invoice email and we will send a new one.',
            )}
          />
        )}

        {invoice && (
          <div className="rounded-2xl border border-line bg-card p-6 shadow-soft">
            <div className="text-[13px] text-muted">{invoice.cooperative}</div>
            <div className="font-display text-xl font-semibold text-ink">
              Subscription · {invoice.period_label}
            </div>

            <div className="my-5 rounded-xl bg-sand px-4 py-4 text-center">
              <div className="text-[13px] text-muted">Amount due</div>
              <div className="font-display text-3xl font-semibold text-green tnum">
                {naira(invoice.amount)}
              </div>
            </div>

            <dl className="space-y-2 text-sm">
              <Row label="Invoice" value={invoice.number} mono />
              {invoice.plan && <Row label="Plan" value={invoice.plan} />}
              <Row label="Due" value={shortDate(invoice.due_at) || 'On receipt'} />
              <Row label="Status" value={invoice.status} />
            </dl>

            {paid || !invoice.payable ? (
              <div className="mt-5 flex items-start gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green">
                <Icon name="check_circle" size={18} fill />
                <span>
                  This invoice is settled. Nothing further is needed — a receipt
                  has gone to your cooperative's contact address.{' '}
                  {/* A full load, so the console re-reads the subscription and
                      unlocks. */}
                  <a href="/console" className="font-semibold underline">
                    Back to the console
                  </a>
                </span>
              </div>
            ) : (
              <button
                onClick={pay}
                disabled={busy}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-green py-3.5 font-semibold text-paper transition hover:bg-green-hover disabled:opacity-60"
              >
                {busy ? <Spinner className="size-4 border-paper/40 border-t-paper" /> : <Icon name="lock" size={18} />}
                Pay {naira(invoice.amount)} securely
              </button>
            )}

            {message && (
              <p className="mt-3 rounded-lg bg-sand px-3.5 py-2.5 text-[13px] text-ink-soft">
                {message}
              </p>
            )}

            <p className="mt-4 text-center text-xs text-muted-2">
              Paying renews your subscription straight away. If anything looks
              wrong, reply to the invoice email.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-ink ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}

function Panel({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-6 text-center shadow-soft">
      <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-sand-deep text-muted-2">
        <Icon name={icon} size={22} />
      </span>
      <div className="font-display text-[15px] font-semibold text-ink">{title}</div>
      <p className="mt-1.5 text-[13px] text-muted">{body}</p>
    </div>
  )
}
