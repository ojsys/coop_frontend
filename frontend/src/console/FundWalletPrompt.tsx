import { Link, useNavigate } from 'react-router-dom'
import { Modal } from '@/ui/Modal'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { naira } from '@/lib/format'
import type { Loan } from '@/api/types'

/**
 * Telling an officer to fund the disbursement wallet.
 *
 * A loan is never paid from a wallet that cannot cover it — the server refuses
 * before anything reaches Paystack — and the loan waits as approved. These are
 * the two places that refusal is turned into something to do: a dialog at the
 * moment of approving, and a standing banner while approved loans wait on it.
 */

/** What the server reports when the wallet was the reason nothing was paid. */
export type WalletShortfall = {
  available: string
  needed: string
  shortfall: string
  /** The shortfall plus Paystack's fee — top-ups are credited net of it. */
  fund_at_least: string
}

/** Roughly what to top up so ``net`` is credited after Paystack's fee
 *  (1.5% + ₦100, capped at ₦2,000). The server's own figure is preferred
 *  where there is one; this is for the banner, which sums several loans. */
export function withTopUpFee(net: number) {
  return Math.ceil(Math.min(net + 2000, (net + 100) / 0.985))
}

/** The wallet page, with the top-up already open for this amount. */
export function fundWalletLink(amount?: string | number) {
  return amount ? `/console/wallet?fund=${Math.ceil(Number(amount))}` : '/console/wallet'
}

export function FundWalletDialog({
  shortfall,
  title = 'Loan approved — not paid yet',
  onClose,
}: {
  shortfall: WalletShortfall | null
  title?: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  if (!shortfall) return null
  return (
    <Modal open onClose={onClose} title={title}
      subtitle="Nothing was sent. The loan is waiting as approved.">
      <div className="space-y-3.5">
        <div className="flex gap-3 rounded-lg border border-gold/30 bg-gold-50 px-3.5 py-3">
          <Icon name="account_balance_wallet" size={20} className="mt-0.5 shrink-0 text-gold-deep" />
          <div className="text-[13px] text-ink-soft">
            <p className="font-semibold text-ink">Fund the disbursement wallet</p>
            <p className="mt-0.5">
              The wallet holds <strong>{naira(shortfall.available)}</strong> but this loan
              pays out <strong>{naira(shortfall.needed)}</strong> — it is{' '}
              <strong className="text-danger">{naira(shortfall.shortfall)} short</strong>.
            </p>
          </div>
        </div>
        <p className="text-[13px] text-muted">
          Add at least <strong className="text-ink">{naira(shortfall.fund_at_least)}</strong>{' '}
          — that covers the shortfall and Paystack's fee on the top-up. Then pay the loan
          from <em>Loans → Awaiting payment</em>.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onClose}>Later</Button>
          <Button size="sm" icon="add" onClick={() => { onClose(); navigate(fundWalletLink(shortfall.fund_at_least)) }}>
            Fund the wallet
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Shown while approved loans that could be paid electronically are waiting on
 * a wallet that cannot cover them all. Loans with no bank code are left out:
 * funding the wallet would not get those paid.
 */
export function WalletShortBanner({
  loans,
  walletBalance,
  canManage,
}: {
  loans: Loan[]
  walletBalance: number
  canManage: boolean
}) {
  const waiting = loans.filter((l) => l.status === 'approved' && l.destination_is_payable !== false)
  const needed = waiting.reduce((s, l) => s + Number(l.amount_to_disburse), 0)
  const short = needed - walletBalance
  if (waiting.length === 0 || short <= 0) return null
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-gold/30 bg-gold-50 px-4 py-3">
      <Icon name="account_balance_wallet" size={20} className="shrink-0 text-gold-deep" />
      <div className="min-w-0 flex-1 text-[13px] text-ink-soft">
        <span className="font-semibold text-ink">Fund the disbursement wallet.</span>{' '}
        {waiting.length === 1 ? '1 approved loan needs' : `${waiting.length} approved loans need`}{' '}
        {naira(needed)} and the wallet holds {naira(walletBalance)} — {naira(short)} short.
        No loan is paid until the wallet can cover it.
      </div>
      {canManage && (
        <Link to={fundWalletLink(withTopUpFee(short))}>
          <Button size="sm" icon="add">Fund the wallet</Button>
        </Link>
      )}
    </div>
  )
}
