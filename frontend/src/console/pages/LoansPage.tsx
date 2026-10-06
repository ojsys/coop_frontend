import { useState } from 'react'
import { useLoans, useDisbursementEvidence, useLoanHealth, useLoanProducts, useMembers, usePendingRepayments } from '@/api/hooks'
import { useLoansCrud, useLoanProductsCrud, useConfirmRepayment, useRejectRepayment, useRecheckDisbursement } from '@/api/mutations'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { PageHeader } from '@/ui/PageHeader'
import { Card, CardHeader } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'
import { Icon } from '@/ui/Icon'
import { StatTile } from '@/ui/StatTile'
import { QueryState } from '@/ui/QueryState'
import { Modal } from '@/ui/Modal'
import { Field, Select } from '@/ui/Field'
import { naira, shortDate } from '@/lib/format'
import type { DisbursementVerdict, Loan, LoanFinding } from '@/api/types'

const statusTone = (s: string) =>
  s === 'repaid' || s === 'approved' ? 'green' : s === 'rejected' ? 'danger' : s === 'disbursed' ? 'gold' : 'neutral'

export function LoansPage() {
  const { data: loans = [], isLoading, isError } = useLoans()
  const { action } = useLoansCrud()
  // A Chairperson reads the loan book and the queue — they sit on the console to
  // approve things — but holds no privileged permission, so every write here
  // would 403. Per the rule stated in SettingsPage, don't render the control.
  const { activeMembership } = useAuth()
  const canManage = activeMembership?.is_privileged ?? false
  const toast = useToast()
  const [tab, setTab] = useState<'loans' | 'awaiting' | 'products'>('loans')
  const [applyOpen, setApplyOpen] = useState(false)
  const [repayFor, setRepayFor] = useState<Loan | null>(null)
  const [disburseFor, setDisburseFor] = useState<Loan | null>(null)
  const [scheduleFor, setScheduleFor] = useState<Loan | null>(null)
  const [verifyFor, setVerifyFor] = useState<Loan | null>(null)

  const outstanding = loans.filter((l) => l.status === 'disbursed').reduce((s, l) => s + Number(l.outstanding), 0)
  const pending = loans.filter((l) => l.status === 'pending').length

  // Approved-but-unpaid loans and genuine inconsistencies arrive together but
  // are kept apart: the first is a queue of work, the second is damage.
  const health = useLoanHealth()
  const awaiting = (health.data?.findings ?? []).filter(
    (f) => f.code === 'awaiting_payment',
  )
  const defects = (health.data?.findings ?? []).filter(
    (f) => f.code !== 'awaiting_payment',
  )
  const loanById = new Map(loans.map((l) => [l.id, l]))

  async function act(loan: Loan, a: string, label: string) {
    try {
      await action.mutateAsync({ id: loan.id, action: a })
      toast(label)
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast(detail ?? 'Action failed', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Loans & Credit"
        subtitle="Loan products, applications, approvals, disbursement & repayment"
        actions={<Button size="sm" icon="add" onClick={() => setApplyOpen(true)}>New loan</Button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile label="Outstanding" value={naira(outstanding, { compact: true })} icon="account_balance_wallet" iconTone="gold" />
        <StatTile label="Pending approval" value={pending} icon="pending_actions" iconTone="neutral" />
        <StatTile label="Active loans" value={loans.filter((l) => l.status === 'disbursed').length} icon="request_quote" iconTone="green" />
      </div>

      <div className="mb-4 flex gap-1 rounded-lg border border-line bg-card p-1">
        {(['loans', 'awaiting', 'products'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === t ? 'bg-green-50 text-green' : 'text-muted hover:bg-sand-deep'}`}>
            {t === 'awaiting'
              ? `Awaiting payment${awaiting.length ? ` (${awaiting.length})` : ''}`
              : t === 'loans' ? 'Loans' : 'Products'}
          </button>
        ))}
      </div>

      {defects.length > 0 && (
        <Card className="mb-4">
          <div className="flex items-start gap-3">
            <Icon name="warning" size={18} className="mt-0.5 text-danger" />
            <div className="text-[13px] text-ink-soft">
              <span className="font-semibold text-ink">
                {defects.length} loan{defects.length === 1 ? '' : 's'} in a state
                that should not be possible
                {health.data?.critical
                  ? ` (${health.data.critical} critical)`
                  : ''}.
              </span>
              <ul className="mt-1.5 space-y-1">
                {defects.slice(0, 4).map((f) => (
                  <li key={`${f.code}-${f.loan_id}`}>
                    Loan {f.loan_id} · {f.member} — {f.title}.{' '}
                    <span className="text-muted">{f.fix}</span>
                  </li>
                ))}
              </ul>
              {defects.length > 4 && (
                <p className="mt-1 text-muted">
                  …and {defects.length - 4} more.
                </p>
              )}
              <p className="mt-1.5 text-muted">
                Run <code>manage.py check_loans</code> to see them all, or
                <code> --fix-safe</code> to apply the corrections that do not
                touch the ledger.
              </p>
            </div>
          </div>
        </Card>
      )}

      {tab === 'awaiting' && (
        <QueryState isLoading={health.isLoading} isError={health.isError}>
          <AwaitingPanel
            findings={awaiting}
            loanById={loanById}
            canManage={canManage}
            onPay={(loan) => setDisburseFor(loan)}
          />
        </QueryState>
      )}

      {tab === 'loans' && (
        <QueryState isLoading={isLoading} isError={isError}>
          <ClaimsPanel />
          <div className="space-y-3">
            {loans.length === 0 && <Card><p className="py-6 text-center text-sm text-muted">No loans yet.</p></Card>}
            {loans.map((l) => (
              <Card key={l.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-[15px] font-semibold text-ink">{l.member_name}</span>
                      <span className="font-mono text-xs text-muted-2">{l.member_no}</span>
                      <Badge tone={statusTone(l.status)} dot>{l.status_display}</Badge>
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted">
                      {l.product_name} · {naira(l.principal)} @ {l.interest_rate}% flat · {l.term_months} mo
                      {l.purpose && ` · ${l.purpose}`}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-4 text-xs text-muted-2">
                      <span>Repayable: <span className="font-mono text-ink-soft">{naira(l.total_repayable)}</span></span>
                      {l.status === 'disbursed' && <span>Outstanding: <span className="font-mono text-gold-deep">{naira(l.outstanding)}</span></span>}
                      {l.disbursed_at && <span>Disbursed {shortDate(l.disbursed_at)}</span>}
                      {l.status === 'disbursed' && <NextDue loan={l} />}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {canManage && l.status === 'pending' && (
                      <div className="flex gap-1.5">
                        <Button size="sm" icon="check" onClick={() => act(l, 'approve', 'Loan approved')}>Approve</Button>
                        <Button size="sm" variant="secondary" onClick={() => act(l, 'reject', 'Loan rejected')}>Reject</Button>
                      </div>
                    )}
                    {canManage && l.status === 'approved' && <Button size="sm" icon="payments" onClick={() => setDisburseFor(l)}>Review & disburse</Button>}
                    {(l.status === 'disbursed' || l.status === 'repaid') && (
                      <Button size="sm" variant="secondary" icon="fact_check" onClick={() => setVerifyFor(l)}>
                        Verify payment
                      </Button>
                    )}
                    {(l.status === 'disbursed' || l.status === 'repaid') && (
                      <button onClick={() => setScheduleFor(l)} className="text-xs font-medium text-green hover:underline">View schedule</button>
                    )}
                    {canManage && l.status === 'disbursed' && <Button size="sm" variant="secondary" icon="savings" onClick={() => setRepayFor(l)}>Record repayment</Button>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </QueryState>
      )}

      {tab === 'products' && <ProductsTab />}

      <ApplyModal open={applyOpen} onClose={() => setApplyOpen(false)} />
      {repayFor && <RepayModal loan={repayFor} onClose={() => setRepayFor(null)} />}
      {disburseFor && (
        <DisburseModal
          loan={disburseFor}
          onClose={() => setDisburseFor(null)}
          refreshing={action.isPending}
          onRefreshDestination={async () => {
            await act(disburseFor, 'refresh-destination',
                      "Destination updated to the member's current bank")
            // Re-read so the modal shows the new destination rather than
            // closing and leaving the officer to find the loan again.
            setDisburseFor((current) =>
              current
                ? loans.find((l) => l.id === current.id) ?? current
                : current)
          }}
          onPayToBank={async () => {
            await act(disburseFor, 'pay-electronically',
                      'Payment sent — the member will be notified')
            setDisburseFor(null)
          }}
          onRecordCash={async () => {
            await act(disburseFor, 'disburse',
                      'Recorded as paid in cash — member notified')
            setDisburseFor(null)
          }}
          busy={action.isPending}
        />
      )}
      {scheduleFor && <ScheduleModal loan={scheduleFor} onClose={() => setScheduleFor(null)} />}
      {verifyFor && (
        <VerifyDisbursementModal
          loan={verifyFor}
          canManage={canManage}
          onClose={() => setVerifyFor(null)}
        />
      )}
    </div>
  )
}

// Member-reported bank transfers awaiting an officer's verification.
/**
 * Approved loans that have not been paid.
 *
 * Not an error list. Before approval began disbursing, approving a loan and
 * paying it were separate steps — so these are simply the work that was never
 * finished. Each row says why it cannot be paid automatically, because that
 * decides what the officer does next: fund the wallet, fix a bank code, or just
 * release it.
 */
function AwaitingPanel({
  findings,
  loanById,
  canManage,
  onPay,
}: {
  findings: LoanFinding[]
  loanById: Map<number, Loan>
  canManage: boolean
  onPay: (loan: Loan) => void
}) {
  if (findings.length === 0) {
    return (
      <Card>
        <p className="py-6 text-center text-sm text-muted">
          Nothing waiting — every approved loan has been paid.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <Card>
        <p className="text-[13px] text-ink-soft">
          These were approved but never paid out. Approving a loan now pays it
          immediately, so this is the backlog from before that — plus any the
          wallet or a missing bank code blocked since.
        </p>
        {canManage ? (
          <p className="mt-1.5 text-[13px] text-muted">
            <strong className="text-ink">Check before paying.</strong> If an
            officer already handed over cash for one of these, record it as a
            cash disbursement rather than paying it again — the review screen
            offers both.
          </p>
        ) : (
          <p className="mt-1.5 text-[13px] text-muted">
            Releasing a payment needs a Treasurer or Secretary — you can review
            the queue here but not pay from it.
          </p>
        )}
      </Card>

      {findings.map((f) => {
        const loan = loanById.get(f.loan_id)
        const ready = f.detail.startsWith('Ready to pay')
        return (
          <Card key={f.loan_id}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[15px] font-semibold text-ink">
                    {f.member}
                  </span>
                  <span className="font-mono text-xs text-muted-2">
                    loan {f.loan_id}
                  </span>
                  <Badge tone={ready ? 'green' : 'gold'} dot>
                    {ready ? 'Ready to pay' : 'Blocked'}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[13px] text-muted">
                  {naira(f.amount)}
                  {loan ? ` · ${loan.product_name} · ${loan.term_months} mo` : ''}
                </p>
                <p className="mt-1 text-xs text-muted-2">{f.detail}</p>
                {!ready && (
                  <p className="mt-0.5 text-xs text-gold-deep">{f.fix}</p>
                )}
              </div>
              {canManage && loan && (
                <Button size="sm" icon="payments" onClick={() => onPay(loan)}>
                  Review & pay
                </Button>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

/** Tone per verdict. Confirmed is green; "nobody has said yet" is not a fault. */
const VERDICT_TONE: Record<DisbursementVerdict, 'green' | 'gold' | 'danger' | 'neutral'> = {
  confirmed_cash: 'green',
  confirmed_transfer: 'green',
  in_flight: 'gold',
  failed: 'danger',
  reversed: 'danger',
  no_journal: 'danger',
  not_disbursed: 'neutral',
}

/**
 * Was this loan actually disbursed?
 *
 * Shows the evidence rather than restating the status: the journal that moved the
 * money (with the amount read from the ledger, not from the loan), and the
 * provider's own answer when there was a transfer.
 *
 * A cash disbursement has no payout at all, which is why the Payouts page cannot
 * answer this — an officer who looked there and found nothing would wrongly
 * conclude the loan was never paid. Here the ledger entry is presented as the
 * evidence it is, with an explanation instead of a dead Recheck button.
 */
function VerifyDisbursementModal({
  loan,
  canManage,
  onClose,
}: {
  loan: Loan
  canManage: boolean
  onClose: () => void
}) {
  const { data, isLoading, isError } = useDisbursementEvidence(loan.id)
  const recheck = useRecheckDisbursement()
  const toast = useToast()

  async function askTheBank() {
    try {
      const fresh = await recheck.mutateAsync(loan.id)
      toast(fresh.headline)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not reach the provider'), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title="Verify payment"
           subtitle="What the ledger and the bank can actually show">
      <QueryState isLoading={isLoading} isError={isError}>
        {data && (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-sand p-3">
              <div className="flex items-center gap-2">
                <Badge tone={VERDICT_TONE[data.verdict]} dot>
                  {data.status_display}
                </Badge>
                <span className="font-display text-[15px] font-semibold text-ink">
                  {data.headline}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] text-muted">{data.detail}</p>
            </div>

            <div className="space-y-1">
              <DRow label="Member" value={data.member} />
              <DRow label="Principal" value={naira(data.principal)} mono />
              <DRow label="Method" value={
                data.method === 'cash' ? 'Cash'
                  : data.method === 'transfer' ? 'Bank transfer'
                  : 'Not recorded'} />
              {data.disbursed_at && (
                <DRow label="Marked disbursed" value={shortDate(data.disbursed_at)} />
              )}
            </div>

            {data.journal ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-2">
                  Ledger entry
                </p>
                <div className="space-y-1">
                  <DRow label="Reference" value={data.journal.reference} mono />
                  <DRow label="Amount moved" value={naira(data.journal.amount)} mono />
                  <DRow label="Dated" value={shortDate(data.journal.occurred_at)} />
                  {data.journal.is_reversed && (
                    <DRow label="Reversed" value="Yes — the money came back" />
                  )}
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-danger-50 px-3 py-2 text-[13px] text-danger">
                No ledger entry records this payment.
              </p>
            )}

            {data.payout && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-2">
                  Bank transfer
                </p>
                <div className="space-y-1">
                  <DRow label="Reference" value={data.payout.reference} mono />
                  <DRow label="Provider says" value={data.payout.status_display} />
                  <DRow label="To" value={data.payout.destination} mono />
                  {data.payout.failure_reason && (
                    <DRow label="Reason" value={data.payout.failure_reason} />
                  )}
                </div>
              </div>
            )}

            {!data.can_recheck && data.recheck_unavailable_because && (
              <p className="rounded-lg bg-sand-deep px-3 py-2 text-xs text-muted">
                {data.recheck_unavailable_because}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
              {data.can_recheck && canManage && (
                <Button size="sm" icon="sync" loading={recheck.isPending}
                        onClick={askTheBank}>
                  Ask the bank now
                </Button>
              )}
            </div>
          </div>
        )}
      </QueryState>
    </Modal>
  )
}

function ClaimsPanel() {
  const { data: claims = [] } = usePendingRepayments()
  const confirm = useConfirmRepayment()
  const reject = useRejectRepayment()
  // Confirming posts a repayment to the ledger, so it is privileged. A
  // Chairperson sees what is waiting without the buttons that would 403.
  const { activeMembership } = useAuth()
  const canManage = activeMembership?.is_privileged ?? false
  const toast = useToast()
  if (claims.length === 0) return null

  async function act(id: number, fn: typeof confirm, label: string) {
    try { await fn.mutateAsync(id); toast(label) }
    catch (err) { toast(apiErrorMessage(err, 'Action failed'), 'error') }
  }

  return (
    <Card padded={false} className="mb-4 border-gold-100">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <Icon name="hourglass_top" size={18} className="text-gold-deep" />
        <span className="text-sm font-semibold text-ink">Reported transfers to verify</span>
        <Badge tone="gold">{claims.length}</Badge>
        {!canManage && (
          <span className="text-xs text-muted-2">· a Treasurer or Secretary verifies these</span>
        )}
      </div>
      <div className="divide-y divide-line">
        {claims.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink">{c.member_name}</span>
                <span className="font-mono text-xs text-muted-2">{c.member_no}</span>
              </div>
              <div className="text-xs text-muted-2">
                {c.product_name} · reported <span className="font-mono text-ink-soft">{naira(c.amount)}</span> · outstanding {naira(c.outstanding)}
                {c.note && ` · “${c.note}”`}
              </div>
              {c.member_bank_account_no && (
                <div className="text-xs text-muted-2">From: {c.member_bank_name} {c.member_bank_account_no}</div>
              )}
            </div>
            {canManage && (
              <div className="flex gap-1.5">
                <Button size="sm" icon="check" loading={confirm.isPending} onClick={() => act(c.id, confirm, 'Repayment confirmed & posted')}>Confirm</Button>
                <Button size="sm" variant="secondary" loading={reject.isPending} onClick={() => act(c.id, reject, 'Claim dismissed')}>Dismiss</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

function NextDue({ loan }: { loan: Loan }) {
  const next = (loan.instalments ?? []).find((i) => i.status !== 'paid')
  if (!next) return null
  return (
    <span className={next.is_overdue ? 'text-danger' : ''}>
      Next due {shortDate(next.due_date)}: <span className="font-mono">{naira(next.amount_due)}</span>
      {next.is_overdue && ' · overdue'}
    </span>
  )
}

// The fixed-repayment schedule, computed for the disburse preview. Every
// instalment is the same fixed amount (the last absorbs rounding); due dates
// fall one month apart from today (the real dates are set at disbursement).
function schedulePreview(loan: Loan) {
  const n = loan.term_months || 1
  const total = Number(loan.total_repayable)
  const monthly = Number(loan.monthly_instalment)
  const last = Math.round((total - monthly * (n - 1)) * 100) / 100
  const today = new Date()
  return Array.from({ length: n }, (_, k) => {
    const seq = k + 1
    const due = new Date(today.getFullYear(), today.getMonth() + seq, Math.min(today.getDate(), 28))
    return { seq, amount: seq < n ? monthly : last, due: due.toISOString() }
  })
}

// A row of member + loan facts an officer confirms before money leaves the till.
/**
 * Two actions, deliberately not one.
 *
 * "Pay to bank" sends money; "Record cash disbursement" records money that has
 * already changed hands. For a backlog of loans approved long ago, some may have
 * been settled in cash outside the system — and a single ambiguous Disburse
 * button is how one of those gets paid a second time. The officer has to say
 * which happened.
 */
function DisburseModal({ loan, onClose, onPayToBank, onRecordCash, onRefreshDestination, refreshing, busy }: { loan: Loan; onClose: () => void; onPayToBank: () => void; onRecordCash: () => void; onRefreshDestination: () => void; refreshing: boolean; busy: boolean }) {
  // Refreshing only helps when the member's own record carries a code the
  // snapshot does not. Offering it otherwise would promise a fix that changes
  // nothing.
  const canRefresh = Boolean(
    loan.member_bank_code &&
      loan.member_bank_account_no &&
      loan.member_bank_code !== loan.destination_bank_code,
  )
  const monthly = loan.monthly_instalment ?? String(Number(loan.total_repayable) / (loan.term_months || 1))
  return (
    <Modal open onClose={onClose} title="Review & disburse" subtitle="Confirm the recipient and account before releasing funds">
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-sand p-3">
          {loan.member_photo ? (
            <img src={loan.member_photo} alt="" className="size-12 rounded-full object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full bg-green-50 text-green"><Icon name="person" size={24} /></span>
          )}
          <div className="min-w-0">
            <div className="truncate font-semibold text-ink">{loan.member_name}</div>
            <div className="font-mono text-xs text-muted-2">{loan.member_no}</div>
          </div>
          <div className="ml-auto text-right text-xs text-muted-2">
            <div>Share capital</div>
            <div className="font-mono text-ink-soft">{naira(loan.member_share_capital ?? 0)}</div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <DRow label="Phone" value={loan.member_phone || '—'} />
          <DRow label="Email" value={loan.member_email || '—'} />
          {/* The snapshot, not the member's current details: the payout
              follows the account recorded when they applied. */}
          <DRow label="Disburse to bank" value={loan.destination_bank_name || '— not on file —'} />
          <DRow label="Account number" value={loan.destination_account_no || '—'} mono />
        </dl>

        {!loan.destination_account_no && (
          <p className="flex items-start gap-2 rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-deep">
            <Icon name="warning" size={16} /> No bank account was on file when this loan was applied for — it can only be collected in cash.
          </p>
        )}

        {/* The destination froze at approval, which is what stops a vetted
            payout being redirected. When the member has since supplied details
            the snapshot lacks, refreshing it is the only way to make the loan
            payable — so offer that here rather than leaving a dead end. */}
        {!loan.destination_is_payable && canRefresh && (
          <div className="rounded-lg bg-gold-50 px-3 py-2.5 text-xs text-gold-deep">
            <p className="flex items-start gap-2">
              <Icon name="warning" size={16} />
              <span>
                This loan was approved before the member's bank details were
                usable, so it still carries the blank destination it was approved
                with. Their record now reads{' '}
                <strong>
                  {loan.member_bank_name} {loan.member_bank_account_no}
                </strong>
                .
              </span>
            </p>
            <Button
              size="sm"
              variant="secondary"
              icon="sync"
              className="mt-2"
              loading={refreshing}
              onClick={onRefreshDestination}
            >
              Use the member's current bank details
            </Button>
          </div>
        )}

        {!loan.destination_is_payable && !canRefresh && loan.destination_account_no && (
          <p className="flex items-start gap-2 rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-deep">
            <Icon name="warning" size={16} /> No bank code recorded for this account, so it cannot be paid electronically. Record the member's bank from the list on their profile first, then refresh this destination.
          </p>
        )}

        {/* A mismatch means the member edited their details after applying.
            The officer should see that before releasing funds. */}
        {loan.destination_account_no &&
          loan.member_bank_account_no &&
          loan.destination_account_no !== loan.member_bank_account_no && (
          <p className="flex items-start gap-2 rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-deep">
            <Icon name="warning" size={16} /> This member's bank details changed
            after they applied (now {loan.member_bank_account_no}). The payout
            follows the account recorded at application.
          </p>
        )}

        <div className="rounded-xl border border-line p-3">
          <div className="mb-2 text-[13px] font-semibold text-ink">{loan.product_name}</div>
          <dl className="grid grid-cols-3 gap-2 text-center text-sm">
            <MStat label="Principal" value={naira(loan.principal)} />
            <MStat label={`Interest @ ${loan.interest_rate}% flat`} value={naira(loan.interest)} />
            <MStat label="Repayable" value={naira(loan.total_repayable)} />
          </dl>
          <p className="mt-2 text-center text-xs text-muted">
            {loan.term_months} fixed monthly instalments of <span className="font-mono text-ink-soft">{naira(monthly)}</span>
          </p>
        </div>

        <details className="rounded-xl border border-line">
          <summary className="cursor-pointer px-3 py-2 text-[13px] font-semibold text-ink">Repayment schedule ({loan.term_months} months)</summary>
          <div className="max-h-44 overflow-y-auto border-t border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-sand text-left text-xs text-muted-2">
                <tr><th className="px-3 py-1.5">#</th><th className="px-3 py-1.5">Due</th><th className="px-3 py-1.5 text-right">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {schedulePreview(loan).map((r) => (
                  <tr key={r.seq}>
                    <td className="px-3 py-1.5 text-muted-2">{r.seq}</td>
                    <td className="px-3 py-1.5">{shortDate(r.due)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{naira(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <p className="text-xs text-muted-2">Either action posts a balanced journal to the ledger, builds the repayment schedule, and notifies the member by app + email.</p>

        <div className="rounded-lg bg-sand-deep px-3 py-2.5 text-xs text-muted">
          <strong className="text-ink">Has this already been paid in cash?</strong>{' '}
          If an officer handed the money over outside the system, record it as a
          cash disbursement — paying to the bank as well would send it twice.
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" size="sm" icon="payments" loading={busy} onClick={onRecordCash}>
            Record cash disbursement
          </Button>
          <Button
            size="sm"
            icon="account_balance"
            loading={busy}
            disabled={!loan.destination_is_payable}
            title={loan.destination_is_payable ? undefined : 'No bank code recorded for this member'}
            onClick={onPayToBank}
          >
            Pay {naira(loan.principal)} to bank
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function DRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-2">{label}</dt>
      <dd className={`text-ink-soft ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}

function MStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-sand py-1.5">
      <div className="text-[11px] text-muted-2">{label}</div>
      <div className="font-mono text-[13px] font-semibold text-ink">{value}</div>
    </div>
  )
}

function ScheduleModal({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const rows = loan.instalments ?? []
  return (
    <Modal open onClose={onClose} title="Repayment schedule" subtitle={`${loan.member_name} · ${loan.product_name}`}>
      <div className="overflow-hidden rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-sand text-left text-xs text-muted-2">
            <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Due</th><th className="px-3 py-2 text-right">Principal</th><th className="px-3 py-2 text-right">Interest</th><th className="px-3 py-2 text-right">Payment</th><th className="px-3 py-2 text-right">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-2 text-muted-2">{i.sequence}</td>
                <td className="px-3 py-2">{shortDate(i.due_date)}</td>
                <td className="px-3 py-2 text-right font-mono text-muted">{naira(i.principal_component)}</td>
                <td className="px-3 py-2 text-right font-mono text-muted">{naira(i.interest_component)}</td>
                <td className="px-3 py-2 text-right font-mono">{naira(i.amount_due)}</td>
                <td className="px-3 py-2 text-right">
                  <Badge tone={i.status === 'paid' ? 'green' : i.is_overdue ? 'danger' : 'neutral'} dot>
                    {i.status === 'paid' ? 'Paid' : i.is_overdue ? 'Overdue' : 'Pending'}
                  </Badge>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted">No schedule.</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

function ApplyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useLoansCrud()
  const { data: products = [] } = useLoanProducts()
  const { data: members = [] } = useMembers()
  const toast = useToast()
  const [form, setForm] = useState({ membership: '', product: '', principal: '', term_months: '6', purpose: '' })
  function set(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await create.mutateAsync({ membership: Number(form.membership), product: Number(form.product), principal: form.principal, term_months: Number(form.term_months), purpose: form.purpose })
      toast('Loan application created'); onClose(); setForm({ membership: '', product: '', principal: '', term_months: '6', purpose: '' })
    } catch (err) { toast(apiErrorMessage(err, 'Could not create loan'), 'error') }
  }

  return (
    <Modal open={open} onClose={onClose} title="New loan" subtitle="Create a loan application for a member">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Member">
          <Select required value={form.membership} onChange={(e) => set('membership', e.target.value)} options={[{ value: '', label: 'Select…' }, ...members.map((m) => ({ value: String(m.id), label: `${m.full_name} · ${m.member_no}` }))]} />
        </Field>
        <Field label="Loan product">
          <Select required value={form.product} onChange={(e) => set('product', e.target.value)} options={[{ value: '', label: products.length ? 'Select…' : 'Create a product first' }, ...products.map((p) => ({ value: String(p.id), label: `${p.name} · ${p.interest_rate}%` }))]} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Principal (₦)"><input required type="number" min="0" value={form.principal} onChange={(e) => set('principal', e.target.value)} className="input" /></Field>
          <Field label="Term (months)"><input type="number" min="1" value={form.term_months} onChange={(e) => set('term_months', e.target.value)} className="input" /></Field>
        </div>
        <Field label="Purpose"><input value={form.purpose} onChange={(e) => set('purpose', e.target.value)} className="input" placeholder="Shop restock" /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={create.isPending}>Create</Button>
        </div>
      </form>
    </Modal>
  )
}

function RepayModal({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const { action } = useLoansCrud()
  const toast = useToast()
  const next = (loan.instalments ?? []).find((i) => i.status !== 'paid')
  // Prefill with this month's instalment so the officer can just confirm.
  const [amount, setAmount] = useState(next ? next.outstanding : '')
  const [channel, setChannel] = useState('cash')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await action.mutateAsync({ id: loan.id, action: 'repay', body: { amount, channel } })
      toast('Repayment recorded — member notified'); onClose()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast(detail ?? 'Could not record repayment', 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title="Record repayment" subtitle={`${loan.member_name} · outstanding ${naira(loan.outstanding)}`}>
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₦)"><input required type="number" min="0" max={loan.outstanding} value={amount} onChange={(e) => setAmount(e.target.value)} className="input" /></Field>
          <Field label="Channel">
            <Select value={channel} onChange={(e) => setChannel(e.target.value)} options={[
              { value: 'cash', label: 'Cash' }, { value: 'transfer', label: 'Bank transfer' },
            ]} />
          </Field>
        </div>
        {next && (
          <button type="button" onClick={() => setAmount(next.outstanding)} className="text-xs text-green hover:underline">
            Use next instalment: {naira(next.outstanding)} (due {shortDate(next.due_date)})
          </button>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={action.isPending}>Record</Button>
        </div>
      </form>
    </Modal>
  )
}

function ProductsTab() {
  const { data: products = [] } = useLoanProducts()
  const { create, remove } = useLoanProductsCrud()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', interest_rate: '10', max_amount: '', max_term_months: '12' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await create.mutateAsync({ name: form.name, interest_rate: form.interest_rate, max_amount: form.max_amount || 0, max_term_months: Number(form.max_term_months), active: true })
      toast('Loan product added'); setOpen(false); setForm({ name: '', interest_rate: '10', max_amount: '', max_term_months: '12' })
    } catch (err) { toast(apiErrorMessage(err, 'Could not add product'), 'error') }
  }

  return (
    <Card padded={false}>
      <div className="flex items-center justify-between px-5 py-4">
        <CardHeader title="Loan products" subtitle="Terms members can borrow on" />
        <Button size="sm" icon="add" onClick={() => setOpen(true)}>New product</Button>
      </div>
      <div className="divide-y divide-line">
        {products.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">No loan products yet.</p>}
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-5 py-3">
            <Icon name="request_quote" size={20} className="text-muted-2" />
            <div className="flex-1">
              <div className="text-sm font-medium text-ink">{p.name}</div>
              <div className="text-xs text-muted-2">{p.interest_rate}% flat · up to {naira(p.max_amount)} · {p.max_term_months} mo</div>
            </div>
            <button onClick={() => remove.mutate(p.id)} className="text-muted-2 hover:text-danger"><Icon name="delete" size={18} /></button>
          </div>
        ))}
      </div>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="New loan product">
          <form onSubmit={submit} className="space-y-3.5">
            <Field label="Name"><input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" placeholder="Emergency Loan" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Interest % flat"><input type="number" min="0" step="0.1" value={form.interest_rate} onChange={(e) => setForm((f) => ({ ...f, interest_rate: e.target.value }))} className="input" /></Field>
              <Field label="Max (₦)"><input type="number" min="0" value={form.max_amount} onChange={(e) => setForm((f) => ({ ...f, max_amount: e.target.value }))} className="input" /></Field>
              <Field label="Max term"><input type="number" min="1" value={form.max_term_months} onChange={(e) => setForm((f) => ({ ...f, max_term_months: e.target.value }))} className="input" /></Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" loading={create.isPending}>Add product</Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  )
}
