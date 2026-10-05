import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMyLoans, useMyLoanProducts } from '@/api/hooks'
import { useApplyLoan } from '@/api/mutations'
import { MemberHeader } from '../MemberShell'
import { Icon } from '@/ui/Icon'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'
import { Modal } from '@/ui/Modal'
import { Field, Select } from '@/ui/Field'
import { QueryState } from '@/ui/QueryState'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { naira } from '@/lib/format'

const tone = (s: string) =>
  s === 'repaid' || s === 'approved' ? 'green' : s === 'rejected' ? 'danger' : s === 'disbursed' ? 'gold' : 'neutral'

export function LoansPage() {
  const navigate = useNavigate()
  const { data: loans = [], isLoading, isError } = useMyLoans()
  const [open, setOpen] = useState(false)

  return (
    <div>
      <MemberHeader
        title="Loans & Credit"
        back={<BackLink onClick={() => navigate('/app')} />}
      />

      <div className="px-5 md:px-0">
        <Button size="sm" icon="add" className="mb-4 w-full" onClick={() => setOpen(true)}>
          Apply for a loan
        </Button>

        <QueryState isLoading={isLoading} isError={isError}>
          {loans.length === 0 ? (
            <Empty icon="request_quote" title="No loans yet" hint="Apply above to request one." />
          ) : (
            <div className="space-y-3">
              {loans.map((l) => (
                <button key={l.id} onClick={() => navigate(`/app/loans/${l.id}`)} className="w-full rounded-2xl border border-line bg-card p-4 text-left transition active:scale-[0.99]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-display text-[15px] font-semibold text-ink">{l.product_name}</div>
                    <Badge tone={tone(l.status)} dot>{l.status_display}</Badge>
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {naira(l.principal)} @ {Number(l.interest_rate)}% flat · {l.term_months} mo
                    {l.purpose ? ` · ${l.purpose}` : ''}
                  </p>
                  <div className="mt-2 flex items-center gap-5 text-[13px]">
                    <span className="text-muted-2">Repayable <span className="font-mono text-ink-soft">{naira(l.total_repayable)}</span></span>
                    {l.status === 'disbursed' && (
                      <span className="text-muted-2">Outstanding <span className="font-mono text-gold-deep">{naira(l.outstanding)}</span></span>
                    )}
                    {l.status === 'pending' && <span className="text-muted-2">Awaiting officer approval</span>}
                    <Icon name="chevron_right" size={18} className="ml-auto text-muted-2" />
                  </div>
                  {l.status === 'disbursed' && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-green">
                      <Icon name="payments" size={14} /> Tap to view schedule & repay
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </QueryState>
      </div>

      {open && <ApplyModal onClose={() => setOpen(false)} />}
    </div>
  )
}

function ApplyModal({ onClose }: { onClose: () => void }) {
  const { data: products = [] } = useMyLoanProducts()
  const apply = useApplyLoan()
  const toast = useToast()
  const [form, setForm] = useState({ product: '', principal: '', term_months: '6', purpose: '' })
  function set(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.product) { toast('Select a product', 'error'); return }
    try {
      await apply.mutateAsync({ product: Number(form.product), principal: form.principal, term_months: Number(form.term_months), purpose: form.purpose })
      toast('Loan application submitted')
      onClose()
    } catch (err) { toast(apiErrorMessage(err, 'Could not submit application'), 'error') }
  }

  return (
    <Modal open onClose={onClose} title="Apply for a loan" subtitle="An officer reviews and approves your request">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Loan product">
          <Select required value={form.product} onChange={(e) => set('product', e.target.value)} options={[
            { value: '', label: products.length ? 'Select…' : 'No products available' },
            ...products.map((p) => ({ value: String(p.id), label: `${p.name} · ${Number(p.interest_rate)}% flat` })),
          ]} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₦)"><input required type="number" min="0" value={form.principal} onChange={(e) => set('principal', e.target.value)} className="input" /></Field>
          <Field label="Term (months)"><input type="number" min="1" value={form.term_months} onChange={(e) => set('term_months', e.target.value)} className="input" /></Field>
        </div>
        <Field label="Purpose"><input value={form.purpose} onChange={(e) => set('purpose', e.target.value)} className="input" placeholder="Shop restock" /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={apply.isPending}>Submit</Button>
        </div>
      </form>
    </Modal>
  )
}

export function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mb-2 flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
      <Icon name="arrow_back" size={18} /> Back
    </button>
  )
}

export function Empty({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-card px-4 py-10 text-center">
      <Icon name={icon} size={40} className="text-muted-2" />
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="text-[13px] text-muted">{hint}</p>
    </div>
  )
}
