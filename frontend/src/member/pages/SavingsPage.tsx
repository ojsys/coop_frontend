import { useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { useMemberStatement, useMyWithdrawals } from '@/api/hooks'
import { useRequestMyWithdrawal } from '@/api/mutations'
import { session } from '@/api/session'
import { MemberHeader } from '../MemberShell'
import { Icon } from '@/ui/Icon'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { Field, Select } from '@/ui/Field'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { naira, longDate, lineAmount, signedNaira, shortDate } from '@/lib/format'

export function SavingsPage() {
  const { activeMembership } = useAuth()
  const mid = activeMembership?.id
  const { data: statement } = useMemberStatement(mid)
  const { data: withdrawals = [] } = useMyWithdrawals()
  const [requestOpen, setRequestOpen] = useState(false)

  const pending = withdrawals.filter((w) => !w.is_paid)

  function downloadPdf() {
    fetch(`/api/v1/reports/statement-pdf/?membership=${mid}`, {
      headers: {
        Authorization: `Token ${session.getToken()}`,
        'X-Cooperative-Id': String(session.getCooperativeId() ?? ''),
      },
    })
      .then((r) => r.blob())
      .then((b) => {
        const url = URL.createObjectURL(b)
        const a = document.createElement('a')
        a.href = url
        a.download = `statement-${activeMembership?.member_no}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  return (
    <div>
      <MemberHeader title="My savings" />

      <div className="px-5">
        <div className="rounded-2xl p-5 text-paper" style={{ background: 'linear-gradient(160deg,#0b4f3a,#0e6048)' }}>
          <div className="text-[13px] text-green-200">Total balance</div>
          <div className="mt-1 font-display text-4xl font-semibold tracking-tight tnum">
            {naira(statement?.savings_balance ?? 0)}
          </div>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#093f2f] px-2.5 py-1 text-xs">
            <Icon name="check_circle" size={15} fill className="text-green-200" />
            Up to date
          </div>
        </div>

        <Button
          icon="arrow_outward"
          className="mt-3 w-full"
          onClick={() => setRequestOpen(true)}
        >
          Request a withdrawal
        </Button>

        <Button variant="secondary" icon="download" className="mt-2 w-full" onClick={downloadPdf}>
          Download PDF statement
        </Button>
      </div>

      {pending.length > 0 && (
        <div className="px-5 pt-6">
          <h2 className="mb-2 font-display text-[15px] font-semibold text-ink">
            Awaiting approval
          </h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-card">
            {pending.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between border-b border-line/60 px-4 py-3 last:border-0"
              >
                <div>
                  <div className="text-sm font-medium text-ink">
                    {naira(w.amount)} · {w.channel_display}
                  </div>
                  <div className="text-xs text-muted-2">
                    Requested {shortDate(w.created_at)} — not paid yet
                  </div>
                </div>
                <Icon name="hourglass_top" size={18} className="text-muted-2" />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-2">
            An officer of your cooperative has to approve this before the money
            is paid out.
          </p>
        </div>
      )}

      <div className="px-5 pt-6">
        <h2 className="mb-2 font-display text-[15px] font-semibold text-ink">Statement</h2>
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          {(statement?.lines ?? []).map((l, i) => (
            <div key={i} className="flex items-center justify-between border-b border-line/60 px-4 py-3 last:border-0">
              <div>
                <div className="text-sm font-medium text-ink">{l.description}</div>
                <div className="text-xs text-muted-2">{longDate(l.date)}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-semibold text-green-bright tnum">{signedNaira(lineAmount(l))}</div>
                <div className="font-mono text-xs text-muted-2 tnum">{naira(l.balance)}</div>
              </div>
            </div>
          ))}
          {(statement?.lines ?? []).length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted">No transactions yet.</p>
          )}
        </div>
      </div>

      {requestOpen && (
        <RequestWithdrawalModal
          available={statement?.savings_balance ?? 0}
          onClose={() => setRequestOpen(false)}
        />
      )}
    </div>
  )
}

/**
 * A member asking for some of their own savings back.
 *
 * Nothing is paid when this is submitted — it goes to the cooperative's officers
 * for approval. The copy says so plainly, because a member who believes the
 * money is already on its way will chase the wrong thing.
 */
function RequestWithdrawalModal({
  available,
  onClose,
}: {
  available: string | number
  onClose: () => void
}) {
  const request = useRequestMyWithdrawal()
  const toast = useToast()
  const [form, setForm] = useState<{ amount: string; channel: 'cash' | 'transfer'; reason: string }>({
    amount: '',
    channel: 'transfer',
    reason: '',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await request.mutateAsync({
        amount: form.amount,
        channel: form.channel,
        reason: form.reason || undefined,
      })
      toast(res.detail ?? 'Request sent to your officers')
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not send your request'), 'error')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Request a withdrawal"
      subtitle="Goes to your cooperative's officers for approval"
    >
      <form onSubmit={submit} className="space-y-3.5">
        <div className="rounded-lg bg-sand-deep px-3 py-2.5 text-xs text-muted">
          You have <span className="font-semibold text-ink">{naira(available)}</span> in
          savings. Nothing is paid out until an officer approves your request.
        </div>
        <Field label="Amount (₦)">
          <input
            required
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="input"
            placeholder="5000"
          />
        </Field>
        <Field label="How you want it paid">
          <Select
            value={form.channel}
            onChange={(e) =>
              setForm((f) => ({ ...f, channel: e.target.value as 'cash' | 'transfer' }))
            }
            options={[
              { value: 'transfer', label: 'Bank transfer — to the account on my record' },
              { value: 'cash', label: 'Cash — collect from an officer' },
            ]}
          />
        </Field>
        <Field label="Reason">
          <input
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            className="input"
            placeholder="School fees"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={request.isPending}>
            Send request
          </Button>
        </div>
      </form>
    </Modal>
  )
}
