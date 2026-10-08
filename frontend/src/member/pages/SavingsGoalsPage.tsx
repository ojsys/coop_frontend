import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMySavingsGoals, useMySavingsProducts } from '@/api/hooks'
import { useCreateMyGoal, useDeleteMyGoal } from '@/api/mutations'
import { MemberHeader } from '../MemberShell'
import { Icon } from '@/ui/Icon'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { Field, Select } from '@/ui/Field'
import { QueryState } from '@/ui/QueryState'
import { useToast } from '@/ui/toast'
import { useHasFeature } from '@/auth/planFeatures'
import { apiErrorMessage } from '@/lib/apiError'
import { naira } from '@/lib/format'
import { BackLink, Empty } from './LoansPage'

export function SavingsGoalsPage() {
  const navigate = useNavigate()
  const { data: goals = [], isLoading, isError } = useMySavingsGoals()
  const del = useDeleteMyGoal()
  const [open, setOpen] = useState(false)
  // Goals already set stay visible; starting or removing one needs savings
  // plans in the society's subscription.
  const canEdit = useHasFeature('savings_plans')

  return (
    <div>
      <MemberHeader title="Savings goals" back={<BackLink onClick={() => navigate('/app')} />} />

      <div className="px-5 md:px-0">
        {canEdit ? (
          <Button size="sm" icon="add" className="mb-4 w-full" onClick={() => setOpen(true)}>New goal</Button>
        ) : (
          <p className="mb-4 rounded-xl bg-sand-deep px-3 py-2.5 text-xs text-muted">
            Your society has not turned on new savings goals. Any goals you set
            earlier are shown below.
          </p>
        )}

        <QueryState isLoading={isLoading} isError={isError}>
          {goals.length === 0 ? (
            <Empty icon="flag" title="No savings goals yet" hint="Set a target to save towards." />
          ) : (
            <div className="space-y-3">
              {goals.map((g) => (
                <div key={g.id} className="rounded-2xl border border-line bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-display text-[15px] font-semibold text-ink">{g.name}</div>
                      <div className="text-xs text-muted-2">{g.product_name}</div>
                    </div>
                    {canEdit && (
                      <button onClick={() => del.mutate(g.id)} className="text-muted-2 transition hover:text-danger" title="Remove">
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand-deep">
                    <div className="h-full rounded-full bg-green-bright" style={{ width: `${g.progress_pct}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-muted-2">
                    <span>{naira(g.saved_amount)} of {naira(g.target_amount)}</span>
                    <span className="font-semibold text-ink">{g.progress_pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </QueryState>
      </div>

      {open && <AddGoalModal onClose={() => setOpen(false)} />}
    </div>
  )
}

function AddGoalModal({ onClose }: { onClose: () => void }) {
  const { data: products = [] } = useMySavingsProducts()
  const create = useCreateMyGoal()
  const toast = useToast()
  const [form, setForm] = useState({ product: '', name: '', target_amount: '', target_date: '' })
  function set(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.product) { toast('Select a product', 'error'); return }
    try {
      await create.mutateAsync({ product: Number(form.product), name: form.name, target_amount: form.target_amount, target_date: form.target_date || null })
      toast('Savings goal added')
      onClose()
    } catch (err) { toast(apiErrorMessage(err, 'Could not add goal'), 'error') }
  }

  return (
    <Modal open onClose={onClose} title="New savings goal">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Savings product">
          <Select required value={form.product} onChange={(e) => set('product', e.target.value)} options={[
            { value: '', label: products.length ? 'Select…' : 'No products available' },
            ...products.map((p) => ({ value: String(p.id), label: p.name })),
          ]} />
        </Field>
        <Field label="Goal name"><input required value={form.name} onChange={(e) => set('name', e.target.value)} className="input" placeholder="New shop" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target (₦)"><input required type="number" min="0" value={form.target_amount} onChange={(e) => set('target_amount', e.target.value)} className="input" /></Field>
          <Field label="Target date"><input type="date" value={form.target_date} onChange={(e) => set('target_date', e.target.value)} className="input" /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={create.isPending}>Add goal</Button>
        </div>
      </form>
    </Modal>
  )
}
