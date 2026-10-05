import { useState } from 'react'
import { useAccounts, useContributionTypes } from '@/api/hooks'
import { useCreateContributionType, useUpdateContributionType } from '@/api/mutations'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Badge } from '@/ui/Badge'
import { QueryState } from '@/ui/QueryState'
import { Modal } from '@/ui/Modal'
import { Field, Select } from '@/ui/Field'
import { naira } from '@/lib/format'
import type { ContributionType } from '@/api/types'

const TYPE_ICON: Record<string, string> = {
  monthly: 'event_repeat',
  weekly: 'date_range',
  // The model's choice is "one_off"; the hyphenated spelling matched nothing.
  one_off: 'savings',
  flexible: 'savings',
}

export function ContributionTypesPage() {
  const { data = [], isLoading, isError } = useContributionTypes()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ContributionType | null>(null)
  const toggle = useUpdateContributionType()
  const toast = useToast()

  async function toggleActive(t: ContributionType) {
    try {
      await toggle.mutateAsync({ id: t.id, active: !t.active })
      toast(t.active ? 'Type deactivated' : 'Type activated')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not update type'), 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Contribution types"
        subtitle={`${data.length} types · each posts to a GL account and can be mandatory or voluntary`}
        actions={
          <Button size="sm" icon="add" onClick={() => setOpen(true)}>
            New type
          </Button>
        }
      />

      <QueryState isLoading={isLoading} isError={isError}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((t) => (
            <Card key={t.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-green-50 text-green">
                    <Icon name={TYPE_ICON[t.frequency] ?? 'savings'} size={22} />
                  </span>
                  <div>
                    <div className="font-display text-[15px] font-semibold text-ink">{t.name}</div>
                    <div className="text-[13px] capitalize text-muted">
                      {t.frequency} · {t.kind}
                    </div>
                  </div>
                </div>
                <Badge tone={t.active ? 'green' : 'neutral'} dot>
                  {t.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
                <div>
                  <div className="text-xs text-muted-2">Expected amount</div>
                  <div className="mt-0.5 font-mono font-medium text-ink tnum">
                    {t.expected_amount ? naira(t.expected_amount) : 'Variable'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-2">Posts to</div>
                  <div className="mt-0.5 text-ink-soft">{t.gl_account_name ?? '—'}</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2 border-t border-line pt-3">
                <Button variant="secondary" size="sm" icon="edit" className="flex-1" onClick={() => setEditing(t)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={t.active ? 'toggle_off' : 'toggle_on'}
                  onClick={() => toggleActive(t)}
                  loading={toggle.isPending && toggle.variables?.id === t.id}
                >
                  {t.active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </QueryState>

      <NewTypeModal open={open} onClose={() => setOpen(false)} />
      <EditTypeModal type={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function EditTypeModal({ type, onClose }: { type: ContributionType | null; onClose: () => void }) {
  if (!type) return null
  return <EditTypeForm key={type.id} type={type} onClose={onClose} />
}

function EditTypeForm({ type, onClose }: { type: ContributionType; onClose: () => void }) {
  const update = useUpdateContributionType()
  const { data: accounts = [] } = useAccounts()
  const toast = useToast()
  const [form, setForm] = useState({
    name: type.name,
    frequency: type.frequency,
    kind: type.kind,
    expected_amount: type.expected_amount ?? '',
    gl_account: type.gl_account != null ? String(type.gl_account) : '',
  })

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await update.mutateAsync({
        id: type.id,
        name: form.name,
        frequency: form.frequency,
        kind: form.kind,
        expected_amount: form.expected_amount || null,
        // Spread, not a plain key: gl_account is non-nullable, so PATCHing null
        // would be refused. Omitting it leaves the current account untouched.
        ...(form.gl_account ? { gl_account: Number(form.gl_account) } : {}),
      })
      toast('Contribution type updated')
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not update type'), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${type.name}`} subtitle="What members pay into">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Name">
          <input required value={form.name} onChange={(e) => set('name', e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Frequency">
            <Select
              value={form.frequency}
              onChange={(e) => set('frequency', e.target.value)}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'one_off', label: 'One-off' },
                { value: 'flexible', label: 'Flexible' },
              ]}
            />
          </Field>
          <Field label="Kind">
            <Select
              value={form.kind}
              onChange={(e) => set('kind', e.target.value)}
              options={[
                { value: 'mandatory', label: 'Mandatory' },
                { value: 'voluntary', label: 'Voluntary' },
              ]}
            />
          </Field>
        </div>
        <Field label="Expected amount (₦)" hint="Leave blank for variable amounts">
          <input inputMode="decimal" value={form.expected_amount} onChange={(e) => set('expected_amount', e.target.value)} className="input" />
        </Field>
        <Field
          label="Posts to (GL account)"
          hint="Applies to contributions not yet posted, including any pending payment already in flight. Journals already posted keep the account they were posted to."
        >
          <Select
            value={form.gl_account}
            onChange={(e) => set('gl_account', e.target.value)}
            options={accounts.map((a) => ({
              value: String(a.id),
              label: `${a.code} — ${a.name} (${a.kind})`,
            }))}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={update.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function NewTypeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateContributionType()
  const { data: accounts = [] } = useAccounts()
  const toast = useToast()
  const [form, setForm] = useState({
    name: '', frequency: 'monthly', kind: 'mandatory', expected_amount: '',
    gl_account: '',
  })

  // Which ledger account a contribution credits is an accounting decision, so
  // it is chosen here rather than guessed server-side. 2000 is the seeded
  // member-funds account and the usual answer; every account is still listed,
  // because share capital credits equity and a levy can credit income.
  const fallbackAccount = accounts.find((a) => a.code === '2000') ?? accounts[0]
  const glAccount = form.gl_account || (fallbackAccount ? String(fallbackAccount.id) : '')

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await create.mutateAsync({
        name: form.name,
        frequency: form.frequency,
        kind: form.kind,
        expected_amount: form.expected_amount || null,
        gl_account: glAccount ? Number(glAccount) : null,
        active: true,
      })
      toast('Contribution type created')
      onClose()
      setForm({
        name: '', frequency: 'monthly', kind: 'mandatory', expected_amount: '',
        gl_account: '',
      })
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not create type'), 'error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New contribution type" subtitle="What members pay into">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Name">
          <input required value={form.name} onChange={(e) => set('name', e.target.value)} className="input" placeholder="Building Fund" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Frequency">
            <Select
              value={form.frequency}
              onChange={(e) => set('frequency', e.target.value)}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'one_off', label: 'One-off' },
                { value: 'flexible', label: 'Flexible' },
              ]}
            />
          </Field>
          <Field label="Kind">
            <Select
              value={form.kind}
              onChange={(e) => set('kind', e.target.value)}
              options={[
                { value: 'mandatory', label: 'Mandatory' },
                { value: 'voluntary', label: 'Voluntary' },
              ]}
            />
          </Field>
        </div>
        <Field label="Expected amount (₦)" hint="Leave blank for variable amounts">
          <input inputMode="decimal" value={form.expected_amount} onChange={(e) => set('expected_amount', e.target.value)} className="input" placeholder="10000" />
        </Field>
        <Field
          label="Posts to (GL account)"
          hint={
            accounts.length === 0
              ? 'No ledger accounts found for this cooperative.'
              : 'The account credited when a member pays this type.'
          }
        >
          <Select
            value={glAccount}
            onChange={(e) => set('gl_account', e.target.value)}
            options={accounts.map((a) => ({
              value: String(a.id),
              label: `${a.code} — ${a.name} (${a.kind})`,
            }))}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={create.isPending} disabled={!glAccount}>
            Create type
          </Button>
        </div>
      </form>
    </Modal>
  )
}
