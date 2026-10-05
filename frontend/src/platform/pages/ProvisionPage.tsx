import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProvisionCooperative } from '@/api/mutations'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Field, Select } from '@/ui/Field'
import { LocationSelect, CoopTypeSelect } from '@/ui/StateLGASelect'

const STEPS = ['Society', 'Plan', 'Payments']

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

export function ProvisionPage() {
  const navigate = useNavigate()
  const provision = useProvisionCooperative()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '',
    registration_no: '',
    country: '',
    state: '',
    lga: '',
    coop_type: 'Multipurpose',
    tier: 'small',
    member_cap: '500',
    admin_name: '',
    admin_email: '',
  })

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit() {
    try {
      const coop = await provision.mutateAsync({
        name: form.name,
        slug: slugify(form.name),
        registration_no: form.registration_no,
        coop_type: form.coop_type,
        country: form.country,
        state: form.state,
        lga: form.lga,
        tier: form.tier,
        member_cap: Number(form.member_cap),
      })
      toast('Cooperative provisioned — onboarding started at Discovery')
      navigate(`/platform/cooperatives/${coop.id}`)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not provision cooperative'), 'error')
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => navigate('/platform/cooperatives')}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted transition hover:text-ink"
      >
        <Icon name="arrow_back" size={18} /> Cancel
      </button>

      <h1 className="font-display text-2xl font-semibold text-ink">Provision a cooperative</h1>
      <p className="mt-1 text-sm text-muted">
        Spin up a fully isolated tenant · row-level scoped · own PSP subaccount
      </p>

      {/* Stepper */}
      <div className="my-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <span
              className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
                i <= step ? 'bg-green text-paper' : 'bg-sand-deep text-muted-2'
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-sm font-medium ${i <= step ? 'text-ink' : 'text-muted-2'}`}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
          </div>
        ))}
      </div>

      <Card>
        {step === 0 && (
          <div className="space-y-3.5">
            <Field label="Registered name">
              <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" placeholder="Lagos Drivers Union MCS" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Registration number">
                <input value={form.registration_no} onChange={(e) => set('registration_no', e.target.value)} className="input" placeholder="LSCS/2026/1187" />
              </Field>
              <CoopTypeSelect value={form.coop_type} onChange={(v) => set('coop_type', v)} />
            </div>
            <LocationSelect
              country={form.country}
              state={form.state}
              lga={form.lga}
              onCountry={(v) => set('country', v)}
              onState={(v) => set('state', v)}
              onLga={(v) => set('lga', v)}
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3.5">
            <Field label="Subscription plan">
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
              <input value={form.member_cap} onChange={(e) => set('member_cap', e.target.value)} className="input" inputMode="numeric" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Primary admin (Chairperson)">
                <input value={form.admin_name} onChange={(e) => set('admin_name', e.target.value)} className="input" placeholder="Musa Danladi" />
              </Field>
              <Field label="Admin email">
                <input value={form.admin_email} onChange={(e) => set('admin_email', e.target.value)} className="input" placeholder="m.danladi@ldumcs.ng" />
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex items-start gap-3 rounded-lg border border-green-100 bg-green-50 p-4">
            <Icon name="info" size={20} className="mt-0.5 text-green" />
            <p className="text-[13px] text-green">
              A dedicated chart of accounts and the society's roles are created on
              provision. Its PSP settlement subaccount is connected separately —
              from Settings → Payment providers — once its bank details are on
              file, because a subaccount needs a verified bank account and those
              details arrive through dual control.
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <Button variant="secondary" size="sm" onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" icon="arrow_forward" disabled={step === 0 && !form.name} onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          ) : (
            <Button size="sm" icon="add_business" loading={provision.isPending} onClick={submit}>
              Provision cooperative
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
