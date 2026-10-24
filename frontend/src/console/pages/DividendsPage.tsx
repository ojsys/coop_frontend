import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDividends, useDividendSurplus } from '@/api/hooks'
import { useDividendsCrud } from '@/api/mutations'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/ui/toast'
import { useHasFeature } from '@/auth/planFeatures'
import { PlanFeatureNote } from '@/auth/PlanFeatureNote'
import { apiErrorMessage } from '@/lib/apiError'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge, type Tone } from '@/ui/Badge'
import { Icon } from '@/ui/Icon'
import { QueryState } from '@/ui/QueryState'
import { Modal } from '@/ui/Modal'
import { Field } from '@/ui/Field'
import { Table, type Column } from '@/ui/Table'
import { naira, longDate } from '@/lib/format'
import type { DividendAllocation, DividendDeclaration, DividendSurplus } from '@/api/types'

/**
 * Dividends: declared from surplus, approved by a second officer, posted to
 * members' savings, corrected by reversal.
 *
 *   draft ──(send for approval → another officer approves)──▶ posted ──▶ reversed
 *
 * There is deliberately no "Post" button. Posting credits every member's
 * withdrawable savings, so it runs only when a different officer approves it
 * on the Approvals page — the server enforces this; the page just says so.
 */
export function DividendsPage() {
  const { data: dividends = [], isLoading, isError } = useDividends()
  const { data: surplus } = useDividendSurplus()
  const { action, remove } = useDividendsCrud()
  const { activeMembership } = useAuth()
  const toast = useToast()
  // Office-holders (an Auditor, say) read; privileged officers act.
  const canManage = activeMembership?.is_privileged ?? false
  // Past distributions stay visible on every plan; declaring new ones follows it.
  const canDeclare = useHasFeature('dividends')
  const [declareOpen, setDeclareOpen] = useState(false)
  const [viewing, setViewing] = useState<DividendDeclaration | null>(null)
  const [reversing, setReversing] = useState<DividendDeclaration | null>(null)

  async function sendForApproval(d: DividendDeclaration) {
    try {
      await action.mutateAsync({ id: d.id, action: 'request-posting' })
      toast('Sent for approval — another officer approves it on the Approvals page')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not send for approval'), 'error')
    }
  }

  async function discard(d: DividendDeclaration) {
    try {
      await remove.mutateAsync(d.id)
      toast('Draft deleted')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not delete'), 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Dividends & Surplus"
        subtitle="Distribute the society's surplus to members, pro-rata to share capital"
        actions={canManage && canDeclare ? <Button size="sm" icon="add" onClick={() => setDeclareOpen(true)}>Declare dividend</Button> : undefined}
      />
      {!canDeclare && <PlanFeatureNote feature="dividends" className="mb-4" />}

      {surplus && <SurplusCard surplus={surplus} />}

      <QueryState isLoading={isLoading} isError={isError}>
        <div className="space-y-3">
          {dividends.length === 0 && (
            <Card><p className="py-6 text-center text-sm text-muted">No dividends declared yet.</p></Card>
          )}
          {dividends.map((d) => (
            <Card key={d.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-display text-[15px] font-semibold text-ink">{d.period_label}</h4>
                    <StatusBadge d={d} />
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {naira(d.total_amount)} across {d.member_count} member{d.member_count === 1 ? '' : 's'}
                    {d.method === 'rate' && d.rate ? ` · ${Number(d.rate)}% on share capital` : ' · shared pro-rata'}
                  </p>
                  <p className="text-xs text-muted-2">
                    Declared {longDate(d.created_at)}{d.created_by_name ? ` by ${d.created_by_name}` : ''}
                    {d.posted_at && ` · posted ${longDate(d.posted_at)}`}
                    {d.reversed_at && ` · reversed ${longDate(d.reversed_at)}`}
                  </p>
                  {d.note && <p className="text-xs text-muted-2">{d.note}</p>}
                  {d.status === 'reversed' && d.reversal_reason && (
                    <p className="mt-1 text-xs text-danger">Reversed: {d.reversal_reason}</p>
                  )}
                  {d.awaiting_approval && (
                    <p className="mt-1 text-xs text-gold-deep">
                      Waiting for a second officer on the{' '}
                      <Link to="/console/approvals" className="font-semibold underline">Approvals</Link> page.
                      It is posted to members' savings when approved.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setViewing(d)}>Allocations</Button>
                  {canManage && d.status === 'draft' && !d.awaiting_approval && canDeclare && (
                    <Button size="sm" icon="send" loading={action.isPending && action.variables?.id === d.id} onClick={() => sendForApproval(d)}>
                      Send for approval
                    </Button>
                  )}
                  {canManage && d.status === 'posted' && (
                    <Button size="sm" variant="secondary" icon="undo" onClick={() => setReversing(d)}>Reverse</Button>
                  )}
                  {canManage && d.status === 'draft' && !d.awaiting_approval && (
                    <button onClick={() => discard(d)} className="text-muted-2 hover:text-danger" title="Delete draft">
                      <Icon name="delete" size={18} />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </QueryState>

      {declareOpen && <DeclareModal surplus={surplus} onClose={() => setDeclareOpen(false)} />}
      {viewing && <AllocationsModal declaration={viewing} onClose={() => setViewing(null)} />}
      {reversing && <ReverseModal declaration={reversing} onClose={() => setReversing(null)} />}
    </div>
  )
}

const STATUS: Record<DividendDeclaration['status'], { tone: Tone; label: string }> = {
  draft: { tone: 'neutral', label: 'Draft' },
  posted: { tone: 'green', label: 'Posted to savings' },
  reversed: { tone: 'danger', label: 'Reversed' },
}

function StatusBadge({ d }: { d: DividendDeclaration }) {
  if (d.awaiting_approval) return <Badge tone="gold" dot>Awaiting approval</Badge>
  const s = STATUS[d.status]
  return <Badge tone={s.tone} dot>{s.label}</Badge>
}

/**
 * What may be distributed, shown before anyone declares anything. The server
 * refuses more than this; showing it here is the difference between an officer
 * declaring a sensible figure and an officer being told no.
 */
function SurplusCard({ surplus }: { surplus: DividendSurplus }) {
  const paidOut = -Number(surplus.retained_surplus)
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] text-muted">Available to distribute</div>
          <div className="font-display text-3xl font-semibold tracking-tight text-green tnum">{naira(surplus.available)}</div>
          <p className="mt-1 max-w-xl text-xs text-muted-2">
            Income {naira(surplus.income_total)} less expenses {naira(surplus.expense_total)}
            {paidOut > 0 && <>, less {naira(paidOut)} already paid as dividends</>}.
            Dividends come from surplus only — never from members' savings or share capital.
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-xs text-muted-2">Share capital</div>
            <div className="font-mono text-sm text-ink tnum">{naira(surplus.share_capital_base)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-2">Eligible members</div>
            <div className="font-mono text-sm text-ink tnum">{surplus.eligible_members}</div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function DeclareModal({ surplus, onClose }: { surplus?: DividendSurplus; onClose: () => void }) {
  const { create } = useDividendsCrud()
  const toast = useToast()
  const [method, setMethod] = useState<'rate' | 'pool'>('rate')
  const [form, setForm] = useState({ period_label: '', total_amount: '', rate: '', note: '' })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const base = Number(surplus?.share_capital_base ?? 0)
  const available = Number(surplus?.available ?? 0)
  const total = method === 'rate'
    ? Math.round(base * Number(form.rate || 0)) / 100
    : Number(form.total_amount || 0)
  const tooMuch = surplus != null && total > available
  // The equivalent rate of a pool, or the pool a rate costs — whichever the
  // officer did not type — so they can check the figure means what they think.
  const impliedRate = base > 0 ? (total / base) * 100 : 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await create.mutateAsync({
        period_label: form.period_label,
        note: form.note,
        ...(method === 'rate' ? { rate: form.rate } : { total_amount: form.total_amount }),
      })
      toast('Dividend declared as a draft — check the allocations, then send it for approval')
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not declare'), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title="Declare dividend" subtitle="Saved as a draft. Posting needs a second officer's approval.">
      <form onSubmit={submit} className="space-y-3.5">
        <div role="tablist" className="inline-flex rounded-full border border-line bg-paper p-1">
          {([['rate', 'Rate on shares'], ['pool', 'Fixed total']] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={method === m}
              onClick={() => setMethod(m)}
              className={`rounded-full px-3.5 py-1 text-sm font-semibold transition ${method === m ? 'bg-green text-paper' : 'text-muted hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Period">
            <input required value={form.period_label} onChange={(e) => set('period_label', e.target.value)} className="input" placeholder="FY2025" />
          </Field>
          {method === 'rate' ? (
            <Field label="Rate (% of share capital)">
              <input required type="number" min="0" max="100" step="0.01" value={form.rate} onChange={(e) => set('rate', e.target.value)} className="input" placeholder="10" />
            </Field>
          ) : (
            <Field label="Total to distribute (₦)">
              <input required type="number" min="0" step="0.01" value={form.total_amount} onChange={(e) => set('total_amount', e.target.value)} className="input" />
            </Field>
          )}
        </div>
        <Field label="Note">
          <input value={form.note} onChange={(e) => set('note', e.target.value)} className="input" placeholder="Approved at the 2026 AGM" />
        </Field>

        {surplus && total > 0 && (
          <div className={`rounded-lg px-3 py-2.5 text-xs ${tooMuch ? 'bg-danger-50 text-danger' : 'bg-sand-deep text-muted'}`}>
            {method === 'rate'
              ? <>Costs <span className="font-semibold">{naira(total)}</span> across {surplus.eligible_members} members.</>
              : <>Works out to <span className="font-semibold">{impliedRate.toFixed(2)}%</span> on share capital.</>}{' '}
            {tooMuch
              ? <>That is more than the {naira(available)} available to distribute.</>
              : <>{naira(available - total)} of surplus would remain.</>}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={tooMuch} loading={create.isPending}>Declare draft</Button>
        </div>
      </form>
    </Modal>
  )
}

function ReverseModal({ declaration: d, onClose }: { declaration: DividendDeclaration; onClose: () => void }) {
  const { action } = useDividendsCrud()
  const toast = useToast()
  const [reason, setReason] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await action.mutateAsync({ id: d.id, action: 'reverse', body: { reason } })
      toast(`${d.period_label} dividend reversed; members have been told`)
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not reverse'), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title={`Reverse ${d.period_label} dividend`} subtitle={`${naira(d.total_amount)} across ${d.member_count} members`}>
      <form onSubmit={submit} className="space-y-3.5">
        <div className="rounded-lg bg-sand-deep px-3 py-2.5 text-xs text-muted">
          Takes the dividend back out of each member's savings by posting a
          mirror journal — the original stays in the ledger beside it — and
          tells every member. Refused if any member has already withdrawn it.
        </div>
        <Field label="Reason (members see this)">
          <input required value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="Declared on the wrong figures" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" variant="danger" loading={action.isPending}>Reverse dividend</Button>
        </div>
      </form>
    </Modal>
  )
}

function AllocationsModal({ declaration, onClose }: { declaration: DividendDeclaration; onClose: () => void }) {
  const columns: Column<DividendAllocation>[] = [
    { key: 'member', header: 'Member', render: (a) => <span><span className="font-medium text-ink">{a.member_name}</span> <span className="font-mono text-xs text-muted-2">{a.member_no}</span></span> },
    { key: 'share', header: 'Share capital', align: 'right', render: (a) => <span className="font-mono tnum text-muted">{naira(a.share_capital)}</span> },
    { key: 'amount', header: 'Dividend', align: 'right', render: (a) => <span className="font-mono tnum">{naira(a.amount)}</span> },
  ]

  // For the AGM pack and the auditor: the same rows as a spreadsheet.
  function download() {
    const rows = [
      ['Member no', 'Member', 'Share capital', 'Dividend'],
      ...declaration.allocations.map((a) => [a.member_no, a.member_name, a.share_capital, a.amount]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `dividend-${declaration.period_label}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal open onClose={onClose} width={620} title={`Allocations · ${declaration.period_label}`} subtitle={`${naira(declaration.total_amount)} across ${declaration.member_count} members`}>
      <div className="max-h-96 overflow-auto">
        <Table columns={columns} rows={declaration.allocations} rowKey={(a) => a.id} empty={<span className="text-sm text-muted">No allocations.</span>} />
      </div>
      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="secondary" icon="download" onClick={download}>Download CSV</Button>
      </div>
    </Modal>
  )
}
