import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMyLoan, useRepayQuote } from '@/api/hooks'
import { useInitiateLoanRepayment, useVerifyLoanRepayment, useReportTransfer, useStartTransfer, useCancelTransfer, type StartedTransfer } from '@/api/mutations'
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
import type { Loan, LoanRepayment } from '@/api/types'

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

              {loan.status === 'disbursed' && <UnsentTransfer loan={loan} onContinue={() => setPayOpen(true)} />}
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
  const claims = (loan.repayments ?? []).filter((r) => r.status === 'pending' && r.channel === 'transfer' && !r.expires_at)
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

/** A bank transfer started here but not yet reported as sent. */
function unsentTransfer(loan: Loan): LoanRepayment | undefined {
  return (loan.repayments ?? []).find((r) => r.status === 'pending' && r.channel === 'transfer' && !!r.expires_at)
}

/** Seconds left until ``expiresAt``, ticking once a second. */
function useSecondsLeft(expiresAt?: string | null) {
  const left = () => (expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0)
  const [secs, setSecs] = useState(left)
  useEffect(() => {
    setSecs(left())
    if (!expiresAt) return
    const t = window.setInterval(() => setSecs(left()), 1000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt])
  return secs
}

const mmss = (secs: number) => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`

function UnsentTransfer({ loan, onContinue }: { loan: Loan; onContinue: () => void }) {
  const t = unsentTransfer(loan)
  const secs = useSecondsLeft(t?.expires_at)
  if (!t) return null
  return (
    <button onClick={onContinue}
      className="flex w-full items-center gap-3 rounded-2xl border border-gold/30 bg-gold-50 p-4 text-left">
      <Icon name="timer" size={22} className="shrink-0 text-gold-deep" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-ink">Bank transfer of {naira(t.amount)} started</div>
        <div className="text-xs text-muted">
          {secs > 0 ? <>{mmss(secs)} left to send it. Tap to see the account details.</> : <>Time's up. Tap if you already sent it.</>}
        </div>
      </div>
      <Icon name="chevron_right" size={20} className="shrink-0 text-muted-2" />
    </button>
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
      <p className="mb-3 text-xs text-muted">Sent money to your society's account without starting it under “Make a repayment”? Tell your society here so an officer can confirm it.</p>
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
  const startTransfer = useStartTransfer()
  const toast = useToast()
  const canTransfer = !!loan.coop_bank
  // A transfer already under way picks up where it was left.
  const unsent = unsentTransfer(loan)
  const [transfer, setTransfer] = useState<StartedTransfer | null>(
    unsent && loan.coop_bank
      ? { ...unsent, psp_reference: unsent.psp_reference ?? '', expires_at: unsent.expires_at!, bank: loan.coop_bank }
      : null,
  )
  const [method, setMethod] = useState<'transfer' | 'paystack'>(canTransfer ? 'transfer' : 'paystack')
  const [amount, setAmount] = useState('')
  const busy = initiate.isPending || verify.isPending || startTransfer.isPending
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

  async function payWithPaystack() {
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
      toast(apiErrorMessage(err, 'Could not start payment'), 'error')
    }
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) { toast('Enter an amount', 'error'); return }
    if (method === 'paystack') { await payWithPaystack(); return }
    try {
      setTransfer(await startTransfer.mutateAsync({ loanId: loan.id, amount }))
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not get the account details'), 'error')
    }
  }

  if (transfer) {
    return (
      <Modal open onClose={onClose} title="Pay by bank transfer" subtitle="No Paystack fee — straight to your society's account">
        <TransferDetails loan={loan} transfer={transfer} onDone={onClose}
          onRestart={() => { setAmount(transfer.amount); setTransfer(null) }} />
      </Modal>
    )
  }

  const fee = quote.data ? Number(quote.data.fee) : 0
  return (
    <Modal open onClose={onClose} title="Make a repayment" subtitle={`Outstanding ${naira(loan.outstanding)}`}>
      <form onSubmit={pay} className="space-y-3.5">
        <RepayAmount loan={loan} label="Amount (₦)" value={amount} onChange={setAmount} />

        {canTransfer && (
          <div className="space-y-2">
            <div className="text-[13px] font-medium text-ink">How do you want to pay?</div>
            <MethodOption selected={method === 'transfer'} onSelect={() => setMethod('transfer')}
              icon="account_balance" title="Bank transfer" badge="No fee"
              detail="Send it from your bank app to your society's account within 30 minutes. An officer confirms it once it arrives." />
            <MethodOption selected={method === 'paystack'} onSelect={() => setMethod('paystack')}
              icon="credit_card" title="Card or USSD with Paystack"
              badge={fee > 0 ? `+ ${nairaKobo(fee)} fee` : undefined}
              detail="Confirmed straight away. Paystack's fee is added on top." />
          </div>
        )}

        {/* Paystack's fee is the member's to pay, on top of the repayment, so
            the society receives all of it. Shown before they pay. */}
        {method === 'paystack' && quote.data && fee > 0 && (
          <div className="rounded-xl bg-sand-deep px-3 py-2.5 text-xs text-muted">
            <div className="flex justify-between"><span>Repayment</span><span className="font-mono">{nairaKobo(quote.data.amount)}</span></div>
            <div className="flex justify-between"><span>Paystack fee</span><span className="font-mono">{nairaKobo(quote.data.fee)}</span></div>
            <div className="mt-1 flex justify-between border-t border-line pt-1 font-semibold text-ink"><span>You pay</span><span className="font-mono">{nairaKobo(quote.data.total)}</span></div>
          </div>
        )}

        <button type="submit" disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green py-3.5 font-semibold text-paper transition hover:bg-green-hover disabled:opacity-50">
          {method === 'transfer' ? (
            <><Icon name="account_balance" size={18} /> Show account details</>
          ) : (
            <><Icon name="lock" size={18} /> Pay {quote.data ? nairaKobo(quote.data.total) : amount ? naira(amount) : ''} with Paystack</>
          )}
        </button>
        {method === 'paystack' && (
          <p className="text-center text-xs text-muted-2">Card, bank transfer & USSD · settles to your society</p>
        )}
      </form>
    </Modal>
  )
}

function MethodOption({ selected, onSelect, icon, title, badge, detail }: {
  selected: boolean; onSelect: () => void; icon: string; title: string; badge?: string; detail: string
}) {
  return (
    <button type="button" onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        selected ? 'border-green bg-green-50' : 'border-line hover:border-green'
      }`}>
      <Icon name={selected ? 'radio_button_checked' : 'radio_button_unchecked'} size={20}
        className={`mt-0.5 shrink-0 ${selected ? 'text-green' : 'text-muted-2'}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Icon name={icon} size={16} className="text-muted-2" />
          <span className="text-sm font-semibold text-ink">{title}</span>
          {badge && <Badge tone={badge === 'No fee' ? 'green' : 'neutral'}>{badge}</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-muted">{detail}</p>
      </div>
    </button>
  )
}

/**
 * The society's account, the exact amount and a narration reference, with 30
 * minutes on the clock. "I've sent it" is what tells an officer to look for it.
 * After the time is up the member can still say they sent it — money that
 * arrived late is still theirs — or start again.
 */
function TransferDetails({ loan, transfer, onDone, onRestart }: {
  loan: Loan; transfer: StartedTransfer; onDone: () => void; onRestart: () => void
}) {
  const report = useReportTransfer()
  const cancel = useCancelTransfer()
  const toast = useToast()
  const secs = useSecondsLeft(transfer.expires_at)
  const expired = secs <= 0
  const urgent = !expired && secs < 5 * 60

  async function sent() {
    try {
      await report.mutateAsync({ loanId: loan.id, transfer: transfer.id })
      toast('Thanks — your society will confirm it once the money arrives')
      onDone()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not tell your society'), 'error')
    }
  }

  async function drop() {
    try {
      await cancel.mutateAsync({ loanId: loan.id, transfer: transfer.id })
      onDone()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not cancel it'), 'error')
    }
  }

  return (
    <div className="space-y-3.5">
      <div className={`rounded-xl px-4 py-3 text-center ${expired ? 'bg-danger-50' : urgent ? 'bg-gold-50' : 'bg-green-50'}`}>
        {expired ? (
          <>
            <div className="font-display text-lg font-semibold text-danger">Time's up</div>
            <p className="mt-0.5 text-xs text-ink-soft">
              The 30 minutes have passed. If you already sent the money, tap “I've sent it”.
              Otherwise start again.
            </p>
          </>
        ) : (
          <>
            <div className={`font-mono text-3xl font-semibold tracking-wider tnum ${urgent ? 'text-gold-deep' : 'text-green'}`}>
              {mmss(secs)}
            </div>
            <p className="mt-0.5 text-xs text-ink-soft">left to send the transfer</p>
          </>
        )}
      </div>

      <dl className="divide-y divide-line rounded-xl border border-line">
        <CopyRow label="Amount to send" value={naira(transfer.amount)} copy={Number(transfer.amount).toFixed(2)} strong />
        <CopyRow label="Bank" value={transfer.bank.bank_name} />
        <CopyRow label="Account number" value={transfer.bank.account_no} copy={transfer.bank.account_no} mono />
        <CopyRow label="Account name" value={transfer.bank.account_name} />
        <CopyRow label="Narration / remark" value={transfer.psp_reference} copy={transfer.psp_reference} mono />
      </dl>
      <p className="text-xs text-muted-2">
        Send exactly {naira(transfer.amount)} and put <span className="font-mono text-ink-soft">{transfer.psp_reference}</span> in
        the narration, so your society can match it to your loan. Your bank may charge its usual transfer fee; there is no
        Paystack fee.
      </p>

      <div className="flex flex-col gap-2 pt-1">
        <Button icon="check_circle" loading={report.isPending} onClick={sent}>I've sent it</Button>
        {expired ? (
          <Button variant="secondary" icon="refresh" onClick={onRestart}>Start again</Button>
        ) : (
          <Button variant="ghost" loading={cancel.isPending} onClick={drop}>Cancel this transfer</Button>
        )}
      </div>
    </div>
  )
}

function CopyRow({ label, value, copy, mono, strong }: {
  label: string; value: string; copy?: string; mono?: boolean; strong?: boolean
}) {
  const toast = useToast()
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <div className="min-w-0">
        <dt className="text-xs text-muted-2">{label}</dt>
        <dd className={`truncate text-ink ${mono ? 'font-mono tracking-wide' : ''} ${strong ? 'text-base font-semibold' : 'text-sm font-medium'}`}>{value}</dd>
      </div>
      {copy && (
        <button type="button" aria-label={`Copy ${label.toLowerCase()}`}
          onClick={() => { navigator.clipboard?.writeText(copy).then(() => toast(`${label} copied`), () => {}) }}
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-green hover:bg-green-50">
          <Icon name="content_copy" size={15} /> Copy
        </button>
      )}
    </div>
  )
}
