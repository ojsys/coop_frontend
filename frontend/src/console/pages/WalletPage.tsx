import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useWallet } from '@/api/hooks'
import { useFundWallet, useVerifyWalletTopUp, useWithdrawWallet } from '@/api/mutations'
import { useAuth } from '@/auth/AuthContext'
import { useHasFeature } from '@/auth/planFeatures'
import { PlanFeatureNote } from '@/auth/PlanFeatureNote'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { PageHeader } from '@/ui/PageHeader'
import { Card, CardHeader } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'
import { Field } from '@/ui/Field'
import { Modal } from '@/ui/Modal'
import { naira, shortDate } from '@/lib/format'
import type { WalletTopUp } from '@/api/types'

/**
 * The society's disbursement wallet, on its own page.
 *
 * It used to live as one card near the bottom of Settings, which is nobody's
 * first guess for "how much can we lend?" — officers could not find it, so they
 * could not tell whether an approved loan would go through until the payment
 * itself refused. Lending is an everyday operation and the float it draws on
 * deserves a place of its own in the sidebar.
 *
 * The balance is also shown on Loans, where the decision is actually made.
 */
export function WalletPage() {
  const { activeMembership } = useAuth()
  const canManage = activeMembership?.is_privileged ?? false

  return (
    <div>
      <PageHeader
        title="Disbursement wallet"
        subtitle="The float this society lends from. Collections are unaffected — those settle to the society's own bank."
      />

      {!canManage && (
        <Card className="mb-4">
          <p className="text-[13px] text-muted">
            You can see the balance and its history here. Funding the wallet and
            withdrawing from it need a Treasurer or Secretary.
          </p>
        </Card>
      )}

      <WalletCard canManage={canManage} />
    </div>
  )
}

/**
 * The disbursement wallet.
 *
 * This is the only money the platform holds, and it is the society's own:
 * collections settle to the society's bank through its subaccount, and an
 * officer funds this separately, when they intend to lend. A loan can only be
 * disbursed electronically from money actually sitting at the payment provider,
 * which is what this balance represents.
 *
 * Self-contained on purpose — it owns its own query, mutation and form state
 * rather than threading them through SettingsPage's shared declarations.
 */
function WalletCard({ canManage }: { canManage: boolean }) {
  const wallet = useWallet()
  const fund = useFundWallet()
  const verify = useVerifyWalletTopUp()
  const withdraw = useWithdrawWallet()
  const toast = useToast()
  const canFund = useHasFeature('electronic_payouts')
  const [tab, setTab] = useState<'funded' | 'attempts'>('funded')
  const [open, setOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [outAmount, setOutAmount] = useState('')

  // Paystack sends the officer back here with ?reference=. Confirming it now
  // credits the wallet straight away; before, nothing asked, and a paid
  // top-up sat pending until the webhook or an operator's recheck.
  const [params, setParams] = useSearchParams()
  const returned = params.get('reference') || params.get('trxref')
  const handled = useRef<string | null>(null)
  useEffect(() => {
    if (!returned || handled.current === returned) return
    handled.current = returned
    setParams({}, { replace: true })
    void check(returned)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returned])

  // "Fund the wallet" on Loans arrives with ?fund=<amount>: open the top-up
  // with what the waiting loans need, rather than leave the officer to work
  // the shortfall out again.
  const suggested = params.get('fund')
  useEffect(() => {
    if (!suggested) return
    if (canManage && canFund) {
      setAmount(suggested)
      setOpen(true)
    }
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested])

  async function check(reference: string) {
    try {
      const { topup } = await verify.mutateAsync(reference)
      if (topup.status === 'confirmed') {
        toast(`Wallet funded — ${naira(topup.net_amount)} credited`)
        setTab('funded')
      } else if (topup.status === 'failed') {
        toast('Paystack reports this payment failed. Nothing was credited.', 'error')
      } else {
        toast('Paystack has not received this payment yet. Nothing was credited.', 'error')
      }
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not check this payment with Paystack'), 'error')
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const result = await fund.mutateAsync({
        amount,
        callback_url: `${window.location.origin}/console/wallet`,
      })
      // A live key returns a checkout URL; send the officer to pay. Without
      // one the top-up stays pending and is confirmed separately.
      if (result.authorization_url) {
        window.location.href = result.authorization_url
        return
      }
      toast(result.detail)
      setOpen(false)
      setAmount('')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not start the top-up'), 'error')
    }
  }

  async function submitWithdrawal(e: React.FormEvent) {
    e.preventDefault()
    try {
      const result = await withdraw.mutateAsync({ amount: outAmount })
      toast(result.detail)
      setWithdrawOpen(false)
      setOutAmount('')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not send the withdrawal'), 'error')
    }
  }

  const topups = wallet.data?.topups ?? []
  const attempts = wallet.data?.attempts ?? []
  const counts = wallet.data?.attempt_counts
  const unpaid = (counts?.pending ?? 0) + (counts?.failed ?? 0)

  return (
    <Card>
      <CardHeader
        title="Disbursement wallet"
        subtitle="Funded by the society, to lend from. Collections are unaffected — they settle to the society's own bank."
        action={
          canManage ? (
            <div className="flex gap-2">
              {canFund && (
                <Button size="sm" icon="add" onClick={() => setOpen(true)}>
                  Fund wallet
                </Button>
              )}
              {/* The float is the society's own money; it must be able to take
                  it back. Only ever pays the society's own vetted account. */}
              <Button
                size="sm"
                variant="secondary"
                icon="arrow_outward"
                disabled={Number(wallet.data?.balance ?? 0) <= 0}
                onClick={() => setWithdrawOpen(true)}
              >
                Withdraw
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-3 rounded-lg border border-line bg-paper px-4 py-3">
        <div className="text-[13px] text-muted">Available to disburse</div>
        <div className="font-display text-2xl font-semibold tracking-tight text-ink tnum">
          {naira(wallet.data?.balance ?? 0)}
        </div>
      </div>

      {/* Funding follows the plan; withdrawing never does — it is the
          society's own money, so the button above stays either way. */}
      {!canFund && <PlanFeatureNote feature="electronic_payouts" className="mb-3" />}

      {/* Clicking "Fund wallet" records an attempt before any money moves,
          so the history leads with funding that actually arrived. The rest
          stay one tab away for whoever is reconciling. */}
      <div className="mb-3 flex items-center gap-1 border-b border-line pb-2">
        <TabButton active={tab === 'funded'} onClick={() => setTab('funded')} label="Successful funding" />
        <TabButton
          active={tab === 'attempts'}
          onClick={() => setTab('attempts')}
          label={`Other attempts${unpaid ? ` (${unpaid})` : ''}`}
        />
      </div>

      {tab === 'funded' ? (
        <div className="space-y-2">
          {topups.map((t) => <TopUpRow key={t.id} topup={t} />)}
          {topups.length === 0 && (
            <p className="py-2 text-sm text-muted">
              Nothing funded yet. A loan cannot be disbursed electronically until
              this wallet holds money.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-2">
            Checkouts that were started but not paid. Nothing here was credited.
            If one was paid, check it with Paystack to credit it.
          </p>
          {attempts.map((t) => (
            <TopUpRow
              key={t.id}
              topup={t}
              action={canManage && t.status === 'pending' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  icon="sync"
                  loading={verify.isPending && verify.variables === t.psp_reference}
                  onClick={() => check(t.psp_reference)}
                >
                  Check with Paystack
                </Button>
              ) : undefined}
            />
          ))}
          {attempts.length === 0 && (
            <p className="py-2 text-sm text-muted">No unpaid attempts.</p>
          )}
        </div>
      )}

      {withdrawOpen && (
        <Modal
          open
          onClose={() => setWithdrawOpen(false)}
          title="Withdraw from the wallet"
          subtitle="Paid to the society's own collection account"
        >
          <form onSubmit={submitWithdrawal} className="space-y-3.5">
            <div className="rounded-lg bg-sand-deep px-3 py-2.5 text-xs text-muted">
              This can only ever pay the society's own collection account —
              the one two officers approved. {naira(wallet.data?.balance ?? 0)}{' '}
              available.
            </div>
            <Field label="Amount (₦)">
              <input
                required
                inputMode="decimal"
                value={outAmount}
                onChange={(e) => setOutAmount(e.target.value)}
                className="input"
                placeholder="50000"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setWithdrawOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={withdraw.isPending}>
                Send to our account
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Fund the disbursement wallet"
          subtitle="Paid from the society's own account; credited net of the provider's fee"
        >
          <form onSubmit={submit} className="space-y-3.5">
            {/* The point-of-decision disclosure. An officer is about to move
                the society's money to us, so this is where it has to be plain
                — not in marketing copy, and not only in the policies. */}
            <div className="space-y-2 rounded-lg bg-sand-deep px-3 py-2.5 text-xs text-muted">
              <p>
                <span className="font-semibold text-ink">
                  This money is held by CooperativeOS, not by your bank.
                </span>{' '}
                It stays your society's: you can see the balance here, add to
                it, and withdraw it back to your own account at any time. We
                hold it only so that approving a loan can pay the member
                electronically.
              </p>
              <p>
                The payment provider deducts its fee before the money arrives,
                so the wallet is credited the net amount. Fund a little more
                than you intend to lend.
              </p>
            </div>
            <Field label="Amount (₦)">
              <input
                required
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input"
                placeholder="500000"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={fund.isPending}>
                Continue to payment
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  )
}

function TopUpRow({ topup: t, action }: { topup: WalletTopUp; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paper px-3.5 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">
          {naira(t.amount)}
          {t.is_confirmed && Number(t.fee) > 0 && (
            <span className="text-xs font-normal text-muted">
              {' '}· {naira(t.fee)} fee · {naira(t.net_amount)} credited
            </span>
          )}
        </div>
        <div className="text-xs text-muted-2">
          <span className="font-mono">{t.psp_reference}</span>
          {' · '}{shortDate(t.confirmed_at ?? t.created_at)}
          {t.initiated_by_name && ` · ${t.initiated_by_name}`}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        <Badge tone={t.is_confirmed ? 'green' : t.status === 'failed' ? 'danger' : 'gold'} dot>
          {t.status_display}
        </Badge>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
        active ? 'bg-green-50 text-green' : 'text-muted hover:bg-sand-deep'
      }`}
    >
      {label}
    </button>
  )
}
