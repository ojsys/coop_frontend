import { useEffect, useState } from 'react'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { StatTile } from '@/ui/StatTile'
import { StatusPill } from '@/ui/Badge'
import { Icon } from '@/ui/Icon'
import { Table, type Column } from '@/ui/Table'
import { QueryState } from '@/ui/QueryState'
import { Modal } from '@/ui/Modal'
import { Field, Select } from '@/ui/Field'
import { CooperativeSearchSelect } from '@/ui/CooperativeSearchSelect'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { useInvoices, useBillingSummary, useNextInvoiceNumber } from '@/api/hooks'
import { useInvoicesCrud } from '@/api/mutations'
import { naira, shortDate } from '@/lib/format'
import type { Invoice } from '@/api/types'

export function BillingPage() {
  const { data: invoices = [], isLoading, isError } = useInvoices()
  const { data: summary } = useBillingSummary()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)
  const { action } = useInvoicesCrud()
  const toast = useToast()

  async function markPaid(inv: Invoice) {
    try {
      await action.mutateAsync({ id: inv.id, action: 'mark-paid' })
      toast(`${inv.number} marked paid`)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not update invoice'), 'error')
    }
  }

  // Payments normally settle themselves (the webhook, the payer's return, the
  // daily cycle). This asks Paystack about one that did not; marking paid by
  // hand is for money that never went through Paystack at all.
  async function recheck(inv: Invoice) {
    try {
      const result = (await action.mutateAsync({ id: inv.id, action: 'recheck' })) as { paid?: boolean }
      toast(
        result?.paid
          ? `${inv.number} confirmed by Paystack and settled`
          : `Paystack has not confirmed a full payment for ${inv.number}`,
        result?.paid ? undefined : 'error',
      )
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not check with Paystack'), 'error')
    }
  }

  const columns: Column<Invoice>[] = [
    { key: 'coop', header: 'Cooperative', render: (i) => <span className="font-medium text-ink">{i.cooperative_name}</span> },
    { key: 'number', header: 'Invoice', render: (i) => <span className="font-mono text-xs text-muted">{i.number}</span> },
    { key: 'period', header: 'Period', render: (i) => i.period_label || '—' },
    { key: 'due', header: 'Due', render: (i) => <span className="text-muted">{shortDate(i.due_at)}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: (i) => <span className="font-mono tnum">{naira(i.amount)}</span> },
    { key: 'status', header: 'Status', align: 'right', render: (i) => <StatusPill status={i.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (i) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => setEditing(i)} className="rounded-md p-1.5 text-muted-2 transition hover:bg-sand hover:text-ink" title="Edit invoice">
            <Icon name="edit" size={17} />
          </button>
          {i.status !== 'paid' && i.status !== 'void' && i.psp_reference && (
            <Button size="sm" variant="secondary" icon="sync" onClick={() => recheck(i)}
              loading={action.isPending && action.variables?.id === i.id && action.variables?.action === 'recheck'}>
              Check Paystack
            </Button>
          )}
          {i.status !== 'paid' && i.status !== 'void' && (
            <Button size="sm" variant="secondary" onClick={() => markPaid(i)}
              loading={action.isPending && action.variables?.id === i.id && action.variables?.action === 'mark-paid'}>
              Mark paid
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Billing & Subscriptions"
        subtitle="Live invoices and MRR across every cooperative"
        actions={<Button size="sm" icon="add" onClick={() => setOpen(true)}>New invoice</Button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Monthly recurring rev." value={naira(summary?.mrr ?? 0, { compact: true })} icon="payments" iconTone="green" foot="active subscriptions" />
        <StatTile label="Outstanding" value={naira(summary?.outstanding ?? 0, { compact: true })} icon="account_balance_wallet" iconTone="gold" foot="sent + overdue" />
        <StatTile label="Overdue" value={naira(summary?.overdue_amount ?? 0, { compact: true })} icon="warning" iconTone="danger" foot={`${summary?.overdue_count ?? 0} invoice(s)`} />
        <StatTile label="Invoices" value={invoices.length} icon="receipt_long" iconTone="neutral" />
      </div>

      {/* MRR is ACTIVE-only, so this explains a low or zero figure rather than
          leaving it looking like a fault. A cooperative in its free month is
          not revenue, and one that owes is not revenue either — but both are
          worth seeing next to the number. */}
      {summary?.subscriptions && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <SubTile
            label="Billed"
            tone="green"
            count={summary.subscriptions.active.count}
            value={summary.subscriptions.active.value}
            foot="counted in MRR"
          />
          <SubTile
            label="In free month"
            tone="muted"
            count={summary.subscriptions.trial.count}
            value={summary.subscriptions.trial.value}
            foot="not yet invoiced"
          />
          <SubTile
            label="Owed"
            tone="gold"
            count={summary.subscriptions.past_due.count}
            value={summary.subscriptions.past_due.value}
            foot="invoiced, unpaid"
          />
        </div>
      )}

      {summary && summary.plan_tiers.length > 0 && (
        <div className="mb-4 grid gap-4 md:grid-cols-3">
          {summary.plan_tiers.map((p) => (
            <Card key={p.plan_id}>
              <div className="font-display text-[15px] font-semibold text-ink">{p.name}</div>
              <div className="text-[13px] text-muted">{naira(p.price_monthly)}/mo · {p.tier}</div>
              <div className="mt-3 flex items-end gap-1.5">
                <span className="font-display text-3xl font-semibold text-green tnum">{p.coops}</span>
                <span className="pb-1 text-sm text-muted">coops</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card padded={false}>
        <div className="flex items-center gap-2 px-5 py-4">
          <h3 className="font-display text-[15px] font-semibold text-ink">Invoices</h3>
        </div>
        <QueryState isLoading={isLoading} isError={isError}>
          <Table columns={columns} rows={invoices} rowKey={(i) => i.id} />
        </QueryState>
      </Card>

      <NewInvoiceModal open={open} onClose={() => setOpen(false)} />
      <EditInvoiceModal invoice={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function NewInvoiceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useInvoicesCrud()
  const { data: suggestedNumber } = useNextInvoiceNumber(open)
  const toast = useToast()
  const [coopId, setCoopId] = useState<number | null>(null)
  const [form, setForm] = useState({ number: '', period_label: '', amount: '', due_at: '' })

  // Prefill the invoice number from the server suggestion when it arrives.
  useEffect(() => {
    if (open && suggestedNumber && !form.number) {
      setForm((f) => ({ ...f, number: suggestedNumber }))
    }
  }, [open, suggestedNumber, form.number])

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function reset() {
    setCoopId(null)
    setForm({ number: '', period_label: '', amount: '', due_at: '' })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!coopId) {
      toast('Select a cooperative', 'error')
      return
    }
    try {
      await create.mutateAsync({
        cooperative: coopId,
        number: form.number,
        period_label: form.period_label,
        amount: form.amount,
        due_at: form.due_at || null,
        status: 'draft', // new invoices always start as a draft
      })
      toast('Draft invoice created')
      onClose()
      reset()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not create invoice'), 'error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New invoice" subtitle="Raised as a draft — send or mark paid later">
      <form onSubmit={submit} className="space-y-3.5">
        {/* interactive: the picker's result rows are buttons, and a <label>
            wrapper re-targets their taps to the search input on Safari. */}
        <Field label="Cooperative" interactive>
          <CooperativeSearchSelect value={coopId} onChange={setCoopId} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Invoice number" hint="Auto-generated — editable">
            <input required value={form.number} onChange={(e) => set('number', e.target.value)} className="input font-mono" placeholder="INV-2026-206" />
          </Field>
          <Field label="Amount (₦)">
            <input required type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="input" placeholder="35000" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Period">
            <input value={form.period_label} onChange={(e) => set('period_label', e.target.value)} className="input" placeholder="Jul 2026" />
          </Field>
          <Field label="Due date">
            <input type="date" value={form.due_at} onChange={(e) => set('due_at', e.target.value)} className="input" />
          </Field>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-2">
            <Icon name="draft" size={15} /> Saved as <span className="font-medium text-ink-soft">Draft</span>
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" loading={create.isPending}>Create draft</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

function EditInvoiceModal({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  if (!invoice) return null
  return <EditInvoiceForm key={invoice.id} invoice={invoice} onClose={onClose} />
}

function EditInvoiceForm({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { update } = useInvoicesCrud()
  const toast = useToast()
  const [form, setForm] = useState({
    number: invoice.number,
    period_label: invoice.period_label ?? '',
    amount: invoice.amount,
    due_at: invoice.due_at ?? '',
    status: invoice.status,
  })

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await update.mutateAsync({
        id: invoice.id,
        number: form.number,
        period_label: form.period_label,
        amount: form.amount,
        due_at: form.due_at || null,
        status: form.status,
      })
      toast('Invoice updated')
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not update invoice'), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${invoice.number}`} subtitle={invoice.cooperative_name}>
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Invoice number">
            <input required value={form.number} onChange={(e) => set('number', e.target.value)} className="input font-mono" />
          </Field>
          <Field label="Amount (₦)">
            <input required type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="input" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Period">
            <input value={form.period_label} onChange={(e) => set('period_label', e.target.value)} className="input" />
          </Field>
          <Field label="Due date">
            <input type="date" value={form.due_at} onChange={(e) => set('due_at', e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Status">
          <Select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'sent', label: 'Sent' },
              { value: 'paid', label: 'Paid' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'void', label: 'Void' },
            ]}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={update.isPending}>Save changes</Button>
        </div>
      </form>
    </Modal>
  )
}

/** One line of the subscription book: how many, and what they are worth. */
function SubTile({
  label,
  count,
  value,
  foot,
  tone,
}: {
  label: string
  count: number
  value: string | number
  foot: string
  tone: 'green' | 'gold' | 'muted'
}) {
  const accent =
    tone === 'green' ? 'text-green' : tone === 'gold' ? 'text-gold-deep' : 'text-muted'
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-ink-soft">{label}</span>
        <span className={`font-display text-2xl font-semibold tnum ${accent}`}>{count}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-xs text-muted-2">{foot}</span>
        <span className="font-mono text-[13px] text-muted tnum">{naira(value)}</span>
      </div>
    </Card>
  )
}
