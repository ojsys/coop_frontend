import { useState } from 'react'
import { useDividends } from '@/api/hooks'
import { useDividendsCrud } from '@/api/mutations'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'
import { Icon } from '@/ui/Icon'
import { QueryState } from '@/ui/QueryState'
import { Modal } from '@/ui/Modal'
import { Field } from '@/ui/Field'
import { Table, type Column } from '@/ui/Table'
import { naira, longDate } from '@/lib/format'
import type { DividendAllocation, DividendDeclaration } from '@/api/types'

export function DividendsPage() {
  const { data: dividends = [], isLoading, isError } = useDividends()
  const { action, remove } = useDividendsCrud()
  const toast = useToast()
  const [declareOpen, setDeclareOpen] = useState(false)
  const [viewing, setViewing] = useState<DividendDeclaration | null>(null)

  async function post(d: DividendDeclaration) {
    if (!window.confirm(`Post ${naira(d.total_amount)} to the ledger? This credits each member's savings and cannot be undone except by reversal.`)) return
    try {
      await action.mutateAsync({ id: d.id, action: 'post_to_ledger' })
      toast('Dividend posted to the ledger')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not post'), 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Dividends & Surplus"
        subtitle="Distribute year-end surplus to members pro-rata to their share capital"
        actions={<Button size="sm" icon="add" onClick={() => setDeclareOpen(true)}>Declare distribution</Button>}
      />

      <QueryState isLoading={isLoading} isError={isError}>
        <div className="space-y-3">
          {dividends.length === 0 && <Card><p className="py-6 text-center text-sm text-muted">No distributions declared yet.</p></Card>}
          {dividends.map((d) => (
            <Card key={d.id}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-display text-[15px] font-semibold text-ink">{d.period_label}</h4>
                    <Badge tone={d.status === 'posted' ? 'green' : 'gold'} dot>{d.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">{naira(d.total_amount)} across {d.member_count} members · declared {longDate(d.created_at)}</p>
                  {d.note && <p className="text-xs text-muted-2">{d.note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setViewing(d)}>Allocations</Button>
                  {d.status === 'draft' && <Button size="sm" icon="post_add" onClick={() => post(d)} loading={action.isPending && action.variables?.id === d.id}>Post</Button>}
                  {d.status === 'draft' && <button onClick={() => remove.mutate(d.id)} className="text-muted-2 hover:text-danger" title="Delete"><Icon name="delete" size={18} /></button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </QueryState>

      <DeclareModal open={declareOpen} onClose={() => setDeclareOpen(false)} />
      {viewing && <AllocationsModal declaration={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function DeclareModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useDividendsCrud()
  const toast = useToast()
  const [form, setForm] = useState({ period_label: '', total_amount: '', note: '' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await create.mutateAsync({ period_label: form.period_label, total_amount: form.total_amount, note: form.note })
      toast('Distribution declared (draft) — review allocations then post')
      onClose()
      setForm({ period_label: '', total_amount: '', note: '' })
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not declare'), 'error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Declare distribution" subtitle="Allocated pro-rata to each member's share capital">
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Period"><input required value={form.period_label} onChange={(e) => setForm((f) => ({ ...f, period_label: e.target.value }))} className="input" placeholder="FY2025" /></Field>
          <Field label="Total surplus (₦)"><input required type="number" min="0" value={form.total_amount} onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))} className="input" /></Field>
        </div>
        <Field label="Note"><input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className="input" placeholder="Approved at AGM 2026" /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={create.isPending}>Declare (draft)</Button>
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
  return (
    <Modal open onClose={onClose} width={620} title={`Allocations · ${declaration.period_label}`} subtitle={`${naira(declaration.total_amount)} across ${declaration.member_count} members`}>
      <div className="max-h-96 overflow-auto">
        <Table columns={columns} rows={declaration.allocations} rowKey={(a) => a.id} empty={<span className="text-sm text-muted">No allocations.</span>} />
      </div>
    </Modal>
  )
}
