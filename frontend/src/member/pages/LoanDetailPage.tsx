import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMyLoan, useRepayQuote } from '@/api/hooks'
import { useInitiateLoanRepayment, useVerifyLoanRepayment, useReportTransfer } from '@/api/mutations'
import { MemberHeader } from '../MemberShell'
import { BackLink } from './LoansPage'
import { Icon } from '@/ui/Icon'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'
import { Modal } from '@/ui/Modal'
import { Field } from '@/ui/Field'
import { QueryState } from '@/ui/QueryState'
import { useToast } from '@/ui/toast'
import { naira, nairaKobo, shortDate } from '@/lib/format'
import { openPaystackCheckout } from '@/lib/paystack'
import { apiErrorMessage } from '@/lib/apiError'
import type { Loan } from '@/api/types'

const tone = (s: string) =>
  s === 'repaid' || s === 'approved' ? 'green' : s === 'rejected' ? 'danger' : s === 'disbursed' ? 'gold' : 'neutral'

export function LoanDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: loan, isLoading, isError } = useMyLoan(id ? Number(id) : undefined)
  const [payOpen, setPayOpen] = useState(false)

  return (
    <div>
      <MemberHeader title="Loan details" back={<BackLink onClick={() => navigate('/app/loans')} />} />
      <div className="px-5 md:px-0">
        <QueryState isLoading={isLoading} isError={isError}>
          {loan && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-display text-[17px] font-semibold text-ink">{loan.product_name}</div>
                  <Badge tone={tone(loan.status)} dot>{loan.status_display}</Badge>
                </div>
                <p className="mt-0.5 text-[13px] text-muted">
                  {naira(loan.principal)} @ {Number(loan.interest_rate)}% flat · {loan.term_months} mo
                  {loan.purpose ? ` · ${loan.purpose}` : ''}
                </p>
                {Number(loan.application_fee ?? 0) > 0 && (
                  <p className="mt-0.5 text-xs text-muted-2">
                    {naira(loan.application_fee)} application fee · you receive {naira(loan.amount_to_disburse)}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Repayable" value={naira(loan.total_repayable)} />
                  <Stat label="Repaid" value={naira(loan.repaid_amount ?? 0)} />
                  <Stat label="Outstanding" value={naira(loan.outstanding)} tone="gold" />
                </div>
                {loan.status === 'disbursed' && (
                  <Button className="mt-4 w-full" icon="payments" onClick={() => setPayOpen(true)}>
                    Make a repayment
                  </Button>
                )}
                {loan.status === 'disbursed' && (
                  <p className="mt-2 text-center text-xs text-muted-2">
                    Pay any amount, any time. Paying early finishes your loan sooner at no extra interest.
                  </p>
                )}
                {loan.status === 'pending' && (
                  <p className="mt-3 rounded-lg bg-sand px-3 py-2 text-center text-[13px] text-muted">Awaiting officer approval.</p>
                )}
                {loan.status === 'approved' && (
                  <p className="mt-3 rounded-lg bg-sand px-3 py-2 text-center text-[13px] text-muted">Approved — awaiting disbursement.</p>
                )}
              </div>

              {loan.status === 'disbursed' && <PendingClaims loan={loan} />}

              {(loan.instalments?.length ?? 0) > 0 ? (
                <Schedule loan={loan} />
              ) : (
                (loan.status === 'pending' || loan.status === 'approved') && <SchedulePreview loan={loan} />
              )}

              {loan.status === 'disbursed' && loan.coop_bank && <BankPanel loan={loan} />}
            </div>
          )}
        </QueryState>
      </div>

      {payOpen && loan && <RepayModal loan={loan} onClose={() => setPayOpen(false)} />}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'gold' }) {
  return (
    <div className="rounded-xl bg-sand py-2">
      <div className="text-[11px] text-muted-2">{label}</div>
      <div className={`font-mono text-[13px] font-semibold ${tone === 'gold' ? 'text-gold-deep' : 'text-ink'}`}>{value}</div>
    </div>
  )
}

function Schedule({ loan }: { loan: Loan }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink">
        <Icon name="calendar_month" size={18} className="text-muted-2" /> Repayment schedule
      </div>
      <div className="divide-y divide-line">
        {(loan.instalments ?? []).map((i) => (
          <div key={i.id} className="flex items-center gap-3 py-2.5">
            <span className={`flex size-7 items-center justify-center rounded-full text-[11px] font-semibold ${
              i.status === 'paid' ? 'bg-green-50 text-green' : i.is_overdue ? 'bg-danger-50 text-danger' : 'bg-sand text-muted-2'
            }`}>
              {i.status === 'paid' ? <Icon name="check" size={15} /> : i.sequence}
            </span>
            <div className="flex-1">
              <div className="text-[13px] font-medium text-ink">{naira(i.amount_due)}</div>
              <div className="text-xs text-muted-2">
                Due {shortDate(i.due_date)} · {naira(i.principal_component)} principal + {naira(i.interest_component)} interest
              </div>
              {i.status !== 'paid' && Number(i.amount_paid) > 0 && (
                <div className="mt-1.5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-sand">
                    <div className="h-full rounded-full bg-green"
                      style={{ width: `${Math.min(100, (Number(i.amount_paid) / Number(i.amount_due)) * 100)}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {naira(i.amount_paid)} paid · {naira(i.outstanding)} to go
                  </div>
                </div>
              )}
            </div>
            <Badge tone={i.status === 'paid' ? 'green' : i.is_overdue ? 'danger' : Number(i.amount_paid) > 0 ? 'gold' : 'neutral'} dot>
              {i.status === 'paid' ? 'Paid' : i.is_overdue ? 'Overdue' : Number(i.amount_paid) > 0 ? 'Part paid' : 'Pending'}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}

// Before disbursement there are no dated instalments yet, so show the planned
// fixed repayments (equal each month) so the member knows what to expect.
function SchedulePreview({ loan }: { loan: Loan }) {
  const n = loan.term_months || 1
  const total = Number(loan.total_repayable)
  const monthly = Number(loan.monthly_instalment)
  const last = Math.round((total - monthly * (n - 1)) * 100) / 100
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink">
        <Icon name="calendar_month" size={18} className="text-muted-2" /> Planned repayments
      </div>
      <p className="mb-3 text-xs text-muted">
        {n} fixed monthly payments of <span className="font-mono text-ink-soft">{naira(monthly)}</span>. Dates are set once the loan is disbursed.
      </p>
      <div className="divide-y divide-line">
        {Array.from({ length: n }, (_, k) => (
          <div key={k} className="flex items-center justify-between py-2 text-[13px]">
            <span className="text-muted-2">Month {k + 1}</span>
            <span className="font-mono text-ink">{naira(k < n - 1 ? monthly : last)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PendingClaims({ loan }: { loan: Loan }) {
  const claims = (loan.repayments ?? []).filter((r) => r.status === 'pending' && r.channel === 'transfer')
  if (claims.length === 0) return null
  return (
    <div className="rounded-2xl border border-gold-50 bg-gold-50 p-4">
      <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-gold-deep">
        <Icon name="hourglass_top" size={18} /> Awaiting confirmation
      </div>
      {claims.map((c) => (
        <p key={c.id} className="text-[13px] text-ink-soft">
          You reported a transfer of <span className="font-mono">{naira(c.amount)}</span>. Your society will confirm it once the money is received.
        </p>
      ))}
    </div>
  )
}

function BankPanel({ loan }: { loan: Loan }) {
  const b = loan.coop_bank!
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink">
        <Icon name="account_balance" size={18} className="text-muted-2" /> Pay by direct transfer
      </div>
      <p className="mb-3 text-xs text-muted">Prefer your bank app? Transfer to your society's account, then tap “I've made the transfer” so an officer can confirm it.</p>
      <dl className="space-y-1.5 text-sm">
        <Row label="Bank" value={b.bank_name} />
        <Row label="Account name" value={b.account_name} />
        <Row label="Account number" value={b.account_no} mono />
      </dl>
      <Button variant="secondary" className="mt-3 w-full" icon="check_circle" onClick={() => setOpen(true)}>
        I've made the transfer
      </Button>
      {open && <ReportTransferModal loan={loan} onClose={() => setOpen(false)} />}
    </div>
  )
}

function ReportTransferModal({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const report = useReportTransfer()
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) { toast('Enter the amount you transferred', 'error'); return }
    try {
      await report.mutateAsync({ loanId: loan.id, amount, note })
      toast('Reported — your society will confirm it shortly')
      onClose()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast(detail ?? 'Could not submit', 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title="I've made the transfer" subtitle="Tell your society about the bank transfer you made">
      <form onSubmit={submit} className="space-y-3.5">
        <RepayAmount loan={loan} label="Amount transferred (₦)" value={amount} onChange={setAmount} />
        <Field label="Reference / note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="e.g. GTBank transfer, 29 Jul" />
        </Field>
        <p className="text-xs text-muted-2">An officer verifies the transfer against the society's account and confirms it — it then shows on your schedule.</p>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={report.isPending}>Notify society</Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * How much to repay. Any amount up to the balance is fine, any day — members
 * pay in small amounts as money comes in. The shortcuts are the two amounts
 * people most often want: this month's instalment, or everything left.
 */
function RepayAmount({ loan, label, value, onChange }: {
  loan: Loan; label: string; value: string; onChange: (v: string) => void
}) {
  const next = (loan.instalments ?? []).find((i) => i.status !== 'paid')
  const chips: { label: string; amount: string }[] = []
  if (next && Number(next.outstanding) < Number(loan.outstanding)) {
    chips.push({ label: `${Number(next.amount_paid) > 0 ? 'Rest of' : 'Next'} instalment · ${naira(next.outstanding)}`, amount: next.outstanding })
  }
  chips.push({ label: `Pay it all off · ${naira(loan.outstanding)}`, amount: loan.outstanding })
  return (
    <div className="space-y-2">
      <Field label={label}>
        <input required type="number" min="1" step="0.01" max={loan.outstanding} value={value}
          onChange={(e) => onChange(e.target.value)} className="input" placeholder="Any amount" />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button key={c.label} type="button" onClick={() => onChange(c.amount)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              Number(value) === Number(c.amount) ? 'border-green bg-green-50 text-green' : 'border-line text-ink-soft hover:border-green'
            }`}>
            {c.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-2">
        Pay any amount, whenever you have it. It goes to your earliest unpaid instalment first,
        and your interest is fixed, so paying early never adds to it. You just finish sooner.
        {next && <> Next due {shortDate(next.due_date)}.</>}
      </p>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-2">{label}</dt>
      <dd className={`font-medium text-ink ${mono ? 'font-mono tracking-wide' : ''}`}>{value}</dd>
    </div>
  )
}

function RepayModal({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const initiate = useInitiateLoanRepayment()
  const verify = useVerifyLoanRepayment()
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const busy = initiate.isPending || verify.isPending
  const quote = useRepayQuote(loan.id, String(amount))

  // The server says "received" only once Paystack confirms the full amount
  // arrived; anything else comes back as an error with the reason.
  async function settle(reference: string) {
    try {
      await verify.mutateAsync({ loanId: loan.id, reference })
      toast('Repayment received — thank you!')
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'We could not confirm this payment. If you were charged, it will reconcile shortly.'), 'error')
    }
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) { toast('Enter an amount', 'error'); return }
    const reference = `LRPY-${crypto.randomUUID()}`
    try {
      const res = await initiate.mutateAsync({
        loanId: loan.id, amount, psp_reference: reference,
        callback_url: `${window.location.origin}/app/pay/callback?kind=loan&loan=${loan.id}`,
      })
      if (res.payment_error) { toast(`Couldn't start payment: ${res.payment_error}`, 'error'); return }
      if (res.paystack_public_key && res.payer_email && res.amount_kobo) {
        await openPaystackCheckout({
          publicKey: res.paystack_public_key,
          email: res.payer_email,
          amountKobo: res.amount_kobo,
          reference,
          onSuccess: () => settle(reference),
          onClose: () => {},
        })
        return
      }
      if (res.payment_simulated) { await settle(reference); return }
      if (res.authorization_url) { window.location.href = res.authorization_url; return }
      toast('Payment could not be started. Please try again.', 'error')
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast(detail ?? 'Could not start payment', 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title="Make a repayment" subtitle={`Outstanding ${naira(loan.outstanding)}`}>
      <form onSubmit={pay} className="space-y-3.5">
        <RepayAmount loan={loan} label="Amount (₦)" value={amount} onChange={setAmount} />
        {/* Paystack's fee is the member's to pay, on top of the repayment, so
            the society receives all of it. Shown before they pay. */}
        {quote.data && Number(quote.data.fee) > 0 && (
          <div className="rounded-xl bg-sand-deep px-3 py-2.5 text-xs text-muted">
            <div className="flex justify-between"><span>Repayment</span><span className="font-mono">{nairaKobo(quote.data.amount)}</span></div>
            <div className="flex justify-between"><span>Paystack fee</span><span className="font-mono">{nairaKobo(quote.data.fee)}</span></div>
            <div className="mt-1 flex justify-between border-t border-line pt-1 font-semibold text-ink"><span>You pay</span><span className="font-mono">{nairaKobo(quote.data.total)}</span></div>
          </div>
        )}
        <button type="submit" disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green py-3.5 font-semibold text-paper transition hover:bg-green-hover disabled:opacity-50">
          <Icon name="lock" size={18} /> Pay {quote.data ? nairaKobo(quote.data.total) : amount ? naira(amount) : ''} with Paystack
        </button>
        <p className="text-center text-xs text-muted-2">Card, bank transfer & USSD · settles to your society</p>
      </form>
    </Modal>
  )
}
