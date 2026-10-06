import { useState } from 'react'
import { useWallet } from '@/api/hooks'
import { useFundWallet, useWithdrawWallet } from '@/api/mutations'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { PageHeader } from '@/ui/PageHeader'
import { Card, CardHeader } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'
import { Field } from '@/ui/Field'
import { Modal } from '@/ui/Modal'
import { naira } from '@/lib/format'

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
  const withdraw = useWithdrawWallet()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [outAmount, setOutAmount] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const result = await fund.mutateAsync({ amount })
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

  return (
    <Card>
      <CardHeader
        title="Disbursement wallet"
        subtitle="Funded by the society, to lend from. Collections are unaffected — they settle to the society's own bank."
        action={
          canManage ? (
            <div className="flex gap-2">
              <Button size="sm" icon="add" onClick={() => setOpen(true)}>
                Fund wallet
              </Button>
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

      <div className="space-y-2">
        {topups.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-lg border border-line bg-paper px-3.5 py-2.5"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink">
                {naira(t.amount)}
                {Number(t.fee) > 0 && (
                  <span className="text-xs font-normal text-muted">
                    {' '}· {naira(t.fee)} fee · {naira(t.net_amount)} credited
                  </span>
                )}
              </div>
              <div className="font-mono text-xs text-muted-2">
                {t.psp_reference}
              </div>
            </div>
            <Badge tone={t.is_confirmed ? 'green' : 'gold'} dot>
              {t.status_display}
            </Badge>
          </div>
        ))}
        {topups.length === 0 && (
          <p className="py-2 text-sm text-muted">
            Nothing funded yet. A loan cannot be disbursed electronically until
            this wallet holds money.
          </p>
        )}
      </div>

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
