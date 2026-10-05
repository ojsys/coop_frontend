import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useContributionTypes } from '@/api/hooks'
import { useInitiateContribution } from '@/api/mutations'
import { outbox } from '@/api/outbox'
import { useToast } from '@/ui/toast'
import { MemberHeader } from '../MemberShell'
import { Icon } from '@/ui/Icon'
import { EmptyState, ErrorState } from '@/ui/EmptyState'
import { naira } from '@/lib/format'
import { openPaystackCheckout } from '@/lib/paystack'

// Payment gateways. Members pick the provider; the actual method (card, bank
// transfer, USSD…) is chosen inside the gateway's own checkout. Add another
// gateway (e.g. Flutterwave) here when it's wired.
const GATEWAYS = [
  {
    id: 'paystack',
    label: 'Paystack',
    icon: 'credit_card',
    desc: 'Card, bank transfer, USSD & more',
  },
]

export function ContributePage() {
  const navigate = useNavigate()
  const { activeMembership } = useAuth()
  const { data: types = [], isError: typesFailed } = useContributionTypes()
  const initiate = useInitiateContribution()
  const toast = useToast()

  const [typeId, setTypeId] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [gateway, setGateway] = useState('paystack')

  const selectedType = types.find((t) => t.id === typeId)

  function pick(id: number, expected: string | null) {
    setTypeId(id)
    if (expected) setAmount(String(Number(expected)))
  }

  async function pay() {
    if (!typeId || !amount || !activeMembership) return
    // A stable client-side reference doubles as the idempotency key, so an
    // offline-queued payment replayed on reconnect can't create a duplicate.
    const reference = `WEB-${crypto.randomUUID()}`
    const body = {
      membership: activeMembership.id,
      contribution_type: typeId,
      amount,
      channel: 'psp' as const,
      psp_reference: reference,
      // Paystack returns the payer here after checkout; our page then verifies.
      callback_url: `${window.location.origin}/app/pay/callback`,
    }
    const queue = () => {
      outbox.enqueue({
        kind: 'contribute',
        label: `${naira(amount)} · ${selectedType?.name ?? 'contribution'}`,
        url: '/contributions/initiate/',
        body,
        cooperativeId: activeMembership.cooperative_id,
      })
      toast("Payment queued — will sync when you're back online")
      navigate('/app')
    }

    if (!navigator.onLine) {
      queue()
      return
    }
    try {
      const res = (await initiate.mutateAsync(body)) as {
        authorization_url?: string
        payment_error?: string
        payment_simulated?: boolean
        paystack_public_key?: string
        payer_email?: string
        amount_kobo?: number
      }
      if (res?.payment_error) {
        toast(`Couldn't start payment: ${res.payment_error}`, 'error')
        return
      }
      // Real Paystack checkout — the on-page inline modal.
      if (res?.paystack_public_key && res.payer_email && res.amount_kobo) {
        await openPaystackCheckout({
          publicKey: res.paystack_public_key,
          email: res.payer_email,
          amountKobo: res.amount_kobo,
          reference,
          onSuccess: () =>
            navigate(`/app/pay/callback?reference=${encodeURIComponent(reference)}`),
          onClose: () => {},
        })
        return
      }
      // Fallback: Paystack hosted checkout via redirect (secret key, no public key).
      if (res?.authorization_url) {
        window.location.href = res.authorization_url
        return
      }
      // No keys configured (local dev): a clearly-labelled test stand-in.
      if (res?.payment_simulated) {
        navigate(
          `/app/pay/mock?reference=${encodeURIComponent(reference)}&amount=${encodeURIComponent(amount)}`,
        )
        return
      }
      toast('Payment could not be started. Please try again.', 'error')
    } catch (e) {
      if (!(e as { response?: unknown }).response) queue()
      else toast('Could not start payment', 'error')
    }
  }

  // A failed request also leaves `types` empty, so these two cases are kept
  // apart: telling a member their cooperative has nothing to pay into, when in
  // truth the request failed, is a confident wrong answer. Either way the Pay
  // button below can never enable, so the reason has to be on screen.
  if (typesFailed || types.length === 0) {
    return (
      <div>
        <MemberHeader title="Make a contribution" />
        {typesFailed ? (
          <ErrorState message="Could not load what your cooperative accepts payments for." />
        ) : (
          <EmptyState
            icon="savings"
            title="Nothing to pay into yet"
            hint={
              activeMembership?.is_privileged
                ? 'Set up a contribution type — monthly dues, a building fund — and members can start paying into it.'
                : 'An officer of your cooperative needs to set up a contribution type, such as monthly dues, before payments can be made.'
            }
            action={
              activeMembership?.is_privileged ? (
                <a
                  href="/console/contribution-types"
                  className="font-medium text-green hover:underline"
                >
                  Set one up in the console
                </a>
              ) : undefined
            }
          />
        )}
      </div>
    )
  }

  return (
    <div>
      <MemberHeader title="Make a contribution" />

      <div className="space-y-5 px-5">
        <div>
          <div className="mb-2 text-[13px] font-medium text-ink-soft">What are you paying for?</div>
          <div className="space-y-2">
            {types.map((t) => {
              const on = t.id === typeId
              return (
                <button
                  key={t.id}
                  onClick={() => pick(t.id, t.expected_amount)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                    on ? 'border-green bg-green-50' : 'border-line bg-card'
                  }`}
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-green-50 text-green">
                    <Icon name="savings" size={20} />
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-ink">{t.name}</div>
                    <div className="text-xs text-muted">
                      {t.expected_amount ? naira(t.expected_amount) : 'Any amount'} · {t.frequency}
                    </div>
                  </div>
                  <Icon
                    name={on ? 'radio_button_checked' : 'radio_button_unchecked'}
                    size={22}
                    className={on ? 'text-green' : 'text-faint'}
                  />
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[13px] font-medium text-ink-soft">Amount</div>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-3">
            <span className="font-display text-2xl font-semibold text-muted-2">₦</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              placeholder="0"
              className="w-full bg-transparent font-display text-2xl font-semibold text-ink outline-none tnum"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 text-[13px] font-medium text-ink-soft">Pay with</div>
          <div className="space-y-2">
            {GATEWAYS.map((g) => {
              const on = g.id === gateway
              return (
                <button
                  key={g.id}
                  onClick={() => setGateway(g.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                    on ? 'border-green bg-green-50' : 'border-line bg-card'
                  }`}
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-green-50 text-green">
                    <Icon name={g.icon} size={20} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-ink">{g.label}</span>
                    <span className="block text-xs text-muted">{g.desc}</span>
                  </span>
                  <Icon
                    name={on ? 'radio_button_checked' : 'radio_button_unchecked'}
                    size={20}
                    className={on ? 'text-green' : 'text-faint'}
                  />
                </button>
              )
            })}
          </div>
        </div>

        <button
          onClick={pay}
          disabled={!typeId || !amount || initiate.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green py-3.5 font-semibold text-paper transition hover:bg-green-hover disabled:opacity-50"
        >
          <Icon name="lock" size={18} />
          Pay {amount ? naira(amount) : ''} securely
        </button>
        <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-xs text-muted-2">
          <Icon name="verified_user" size={14} />
          Settles to {selectedType ? "your society's own account" : 'your society'} via Paystack
        </p>
      </div>
    </div>
  )
}
