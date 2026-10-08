import { useMemo, useState } from 'react'
import { useApprovals, useLoans, useDividends } from '@/api/hooks'
import { useApprovalsCrud } from '@/api/mutations'
import { useToast } from '@/ui/toast'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'
import { Icon } from '@/ui/Icon'
import { QueryState } from '@/ui/QueryState'
import { Modal } from '@/ui/Modal'
import { Field, Select } from '@/ui/Field'
import { naira, dateTime } from '@/lib/format'
import type { ApprovalRequest } from '@/api/types'

const tone = (s: string) => (s === 'approved' ? 'green' : s === 'rejected' ? 'danger' : 'gold')

export function ApprovalsPage() {
  const { data: approvals = [], isLoading, isError } = useApprovals()
  const { action } = useApprovalsCrud()
  const toast = useToast()
  const [open, setOpen] = useState(false)

  const pending = approvals.filter((a) => a.status === 'pending')

  async function decide(a: ApprovalRequest, act: 'approve' | 'reject') {
    try {
      await action.mutateAsync({ id: a.id, action: act })
      toast(act === 'approve' ? 'Approved & executed' : 'Request rejected')
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast(detail ?? 'Action failed', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle="Maker-checker: a second officer approves sensitive financial actions before they run"
        actions={<Button size="sm" icon="add" onClick={() => setOpen(true)}>Send for approval</Button>}
      />

      <div className="mb-4 rounded-lg border border-green-100 bg-green-50 p-3.5 text-[13px] text-ink-soft">
        <Icon name="info" size={16} className="mr-1 inline text-green" />
        Dual control: whoever <strong>submits</strong> a request cannot approve it — a different officer must. On approval, the action (loan disbursement, dividend posting…) executes automatically.
      </div>

      <QueryState isLoading={isLoading} isError={isError}>
        <div className="space-y-3">
          {approvals.length === 0 && <Card><p className="py-6 text-center text-sm text-muted">No approval requests.</p></Card>}
          {approvals.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-[15px] font-semibold text-ink">{a.action_display}</span>
                    <Badge tone={tone(a.status)} dot>{a.status_display}</Badge>
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">{a.summary}</p>
                  <div className="mt-1 text-xs text-muted-2">
                    Requested by {a.requested_by_name ?? '—'} · {dateTime(a.created_at)}
                    {a.decided_by_name && ` · decided by ${a.decided_by_name}`}
                  </div>
                </div>
                {a.status === 'pending' && (
                  <div className="flex gap-1.5">
                    <Button size="sm" icon="check" onClick={() => decide(a, 'approve')}>Approve</Button>
                    <Button size="sm" variant="secondary" onClick={() => decide(a, 'reject')}>Reject</Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </QueryState>

      <SubmitModal open={open} onClose={() => setOpen(false)} pendingCount={pending.length} />
    </div>
  )
}

function SubmitModal({ open, onClose }: { open: boolean; onClose: () => void; pendingCount: number }) {
  const { create } = useApprovalsCrud()
  const { data: loans = [] } = useLoans()
  const { data: dividends = [] } = useDividends()
  const toast = useToast()
  const [actionType, setActionType] = useState('loan.disburse')
  const [objectId, setObjectId] = useState('')

  // Eligible targets depend on the action.
  const targets = useMemo(() => {
    if (actionType === 'loan.approve') return loans.filter((l) => l.status === 'pending').map((l) => ({ value: String(l.id), label: `${l.member_name} · ${naira(l.principal)}` }))
    if (actionType === 'loan.disburse') return loans.filter((l) => l.status === 'approved').map((l) => ({ value: String(l.id), label: `${l.member_name} · ${naira(l.principal)}` }))
    return dividends.filter((d) => d.status === 'draft' && !d.awaiting_approval).map((d) => ({ value: String(d.id), label: `${d.period_label} · ${naira(d.total_amount)}` }))
  }, [actionType, loans, dividends])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!objectId) { toast('Select a target', 'error'); return }
    try {
      await create.mutateAsync({ action: actionType, object_id: Number(objectId) })
      toast('Sent for approval'); onClose(); setObjectId('')
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast(detail ?? 'Could not submit', 'error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Send for approval" subtitle="A different officer will review it">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Action">
          <Select value={actionType} onChange={(e) => { setActionType(e.target.value); setObjectId('') }} options={[
            { value: 'loan.approve', label: 'Approve a pending loan' },
            { value: 'loan.disburse', label: 'Disburse an approved loan' },
            { value: 'dividend.post', label: 'Post a draft dividend' },
          ]} />
        </Field>
        <Field label="Target">
          <Select required value={objectId} onChange={(e) => setObjectId(e.target.value)} options={[{ value: '', label: targets.length ? 'Select…' : 'Nothing eligible' }, ...targets]} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={create.isPending}>Submit</Button>
        </div>
      </form>
    </Modal>
  )
}
