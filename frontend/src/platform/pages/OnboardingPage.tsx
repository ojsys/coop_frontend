import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { StatTile } from '@/ui/StatTile'
import { QueryState } from '@/ui/QueryState'
import { Modal } from '@/ui/Modal'
import { Field, Select } from '@/ui/Field'
import { LocationSelect, CoopTypeSelect } from '@/ui/StateLGASelect'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { useOnboardingItems } from '@/api/hooks'
import { useOnboardingCrud, useProvisionCooperative } from '@/api/mutations'
import type { OnboardingItem, OnboardingStage } from '@/api/types'

const STAGES: { key: OnboardingStage; label: string; icon: string }[] = [
  { key: 'discovery', label: 'Discovery', icon: 'search' },
  { key: 'data_migration', label: 'Data migration', icon: 'database' },
  { key: 'parallel_run', label: 'Parallel run', icon: 'sync' },
  { key: 'go_live', label: 'Go-live', icon: 'rocket_launch' },
]

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

export function OnboardingPage() {
  const { data: items = [], isLoading, isError } = useOnboardingItems()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { action, remove } = useOnboardingCrud()
  const toast = useToast()

  const active = items.filter((i) => i.stage !== 'done')
  const atGoLive = items.filter((i) => i.stage === 'go_live').length
  const completed = items.filter((i) => i.stage === 'done').length

  async function advance(item: OnboardingItem) {
    try {
      const next = STAGES.findIndex((s) => s.key === item.stage) + 1
      await action.mutateAsync({ id: item.id, action: 'advance' })
      toast(
        next >= STAGES.length - 1
          ? `${item.display_name} is live — tenant activated`
          : `${item.display_name} advanced`,
      )
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not advance'), 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Onboarding"
        subtitle="Provision a cooperative and walk it from Discovery to Go-live — each step is saved"
        actions={
          <Button size="sm" icon="add_business" onClick={() => setOpen(true)}>
            Start onboarding
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile label="In onboarding" value={active.length} icon="conveyor_belt" iconTone="green" />
        <StatTile label="At go-live" value={atGoLive} icon="rocket_launch" iconTone="gold" />
        <StatTile label="Completed" value={completed} icon="task_alt" iconTone="green" />
      </div>

      <QueryState isLoading={isLoading} isError={isError} minHeight={240}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((stage) => {
            const inStage = active.filter((i) => i.stage === stage.key)
            return (
              <Card key={stage.key}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name={stage.icon} size={20} className="text-green" />
                    <span className="font-display text-[15px] font-semibold text-ink">{stage.label}</span>
                  </div>
                  <span className="flex size-6 items-center justify-center rounded-full bg-green-50 font-mono text-xs font-semibold text-green">
                    {inStage.length}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {inStage.length === 0 && (
                    <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-muted-2">
                      Nothing here
                    </p>
                  )}
                  {inStage.map((item) => (
                    <div key={item.id} className="rounded-lg border border-line bg-paper px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => item.cooperative && navigate(`/platform/cooperatives/${item.cooperative}`)}
                          className="text-left text-[13px] font-medium text-ink hover:text-green hover:underline"
                          disabled={!item.cooperative}
                        >
                          {item.display_name}
                        </button>
                        <button
                          onClick={() => remove.mutate(item.id)}
                          className="text-muted-2 transition hover:text-danger"
                          title="Remove from pipeline"
                        >
                          <Icon name="close" size={15} />
                        </button>
                      </div>
                      {item.target_go_live && (
                        <div className="mt-0.5 text-xs text-muted-2">Target: {item.target_go_live}</div>
                      )}
                      <button
                        onClick={() => advance(item)}
                        className="mt-2 flex items-center gap-1 text-xs font-semibold text-green hover:underline"
                      >
                        {stage.key === 'go_live' ? 'Complete & activate' : 'Advance'} <Icon name="arrow_forward" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      </QueryState>

      <StartOnboardingModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

function StartOnboardingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const provision = useProvisionCooperative()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({
    name: '',
    registration_no: '',
    country: '',
    state: '',
    lga: '',
    coop_type: 'Multipurpose',
    tier: 'small',
    member_cap: '500',
  })

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const coop = await provision.mutateAsync({
        name: form.name,
        slug: slugify(form.name),
        registration_no: form.registration_no,
        country: form.country,
        state: form.state,
        lga: form.lga,
        coop_type: form.coop_type,
        tier: form.tier,
        member_cap: Number(form.member_cap),
      })
      toast('Cooperative provisioned — onboarding started at Discovery')
      onClose()
      setForm({ name: '', registration_no: '', country: '', state: '', lga: '', coop_type: 'Multipurpose', tier: 'small', member_cap: '500' })
      navigate(`/platform/cooperatives/${coop.id}`)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not start onboarding'), 'error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Start onboarding" subtitle="Provisions a prospective tenant and adds it to the pipeline">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Registered name">
          <input required value={form.name} onChange={(e) => set('name', e.target.value)} className="input" placeholder="Kano Millers Union" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Registration number">
            <input value={form.registration_no} onChange={(e) => set('registration_no', e.target.value)} className="input" placeholder="KN/2026/0043" />
          </Field>
          <CoopTypeSelect value={form.coop_type} onChange={(v) => set('coop_type', v)} />
        </div>
        <LocationSelect country={form.country} state={form.state} lga={form.lga} onCountry={(v) => set('country', v)} onState={(v) => set('state', v)} onLga={(v) => set('lga', v)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plan tier">
            <Select
              value={form.tier}
              onChange={(e) => set('tier', e.target.value)}
              options={[
                { value: 'small', label: 'Small (50–500)' },
                { value: 'medium', label: 'Medium (500–5,000)' },
                { value: 'large', label: 'Large / Institutional' },
              ]}
            />
          </Field>
          <Field label="Member cap">
            <input inputMode="numeric" value={form.member_cap} onChange={(e) => set('member_cap', e.target.value)} className="input" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={provision.isPending}>Provision & start</Button>
        </div>
      </form>
    </Modal>
  )
}
