import { useState } from 'react'
import { PageHeader } from '@/ui/PageHeader'
import { Card, CardHeader } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { BrandAssetField } from '@/ui/BrandAssetField'
import { apiErrorMessage } from '@/lib/apiError'
import { Avatar } from '@/ui/Avatar'
import { Badge } from '@/ui/Badge'
import { QueryState } from '@/ui/QueryState'
import { Modal } from '@/ui/Modal'
import { Field, Select } from '@/ui/Field'
import { useToast } from '@/ui/toast'
import {
  usePlatformTeam,
  usePlatformHealth,
  usePlans,
  usePlatformProfile,
  useNotificationTemplates,
  useAuditStream,
} from '@/api/hooks'
import {
  usePlatformTeamCrud,
  usePlansCrud,
  useUpdatePlatformProfile,
  useUploadPlatformBrandAsset,
  useNotificationTemplatesCrud,
} from '@/api/mutations'
import { api } from '@/api/client'
import { naira, dateTime } from '@/lib/format'
import type { NotificationTemplate, PlatformTeamMember, Plan } from '@/api/types'

const TABS = [
  { key: 'plans', label: 'Plans & pricing', icon: 'sell' },
  { key: 'branding', label: 'Branding', icon: 'palette' },
  { key: 'templates', label: 'Templates', icon: 'mail' },
  { key: 'team', label: 'Team', icon: 'group' },
  { key: 'compliance', label: 'Compliance & data', icon: 'shield' },
] as const
type Tab = (typeof TABS)[number]['key']

export function PlatformSettingsPage() {
  const [tab, setTab] = useState<Tab>('plans')
  return (
    <div>
      <PageHeader title="Platform Settings" subtitle="Pricing, branding, messaging, team & compliance — governs the whole platform" />
      <div className="mb-4 flex flex-wrap items-center gap-1 rounded-lg border border-line bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key ? 'bg-green-50 text-green' : 'text-muted hover:bg-sand-deep'
            }`}
          >
            <Icon name={t.icon} size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'plans' && <PlansTab />}
      {tab === 'branding' && <BrandingTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'team' && <TeamTab />}
      {tab === 'compliance' && <ComplianceTab />}
    </div>
  )
}

// ── Plans & pricing ─────────────────────────────────────────────────────────
function PlansTab() {
  const { data: plans = [], isLoading, isError } = usePlans()
  const [editing, setEditing] = useState<Plan | 'new' | null>(null)
  const { remove } = usePlansCrud()

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" icon="add" onClick={() => setEditing('new')}>New plan</Button>
      </div>
      <QueryState isLoading={isLoading} isError={isError}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-[15px] font-semibold text-ink">{p.name}</div>
                  <div className="text-[13px] capitalize text-muted">{p.tier} · {p.subscriber_count} coops</div>
                </div>
                <Badge tone={p.active ? 'green' : 'neutral'} dot>{p.active ? 'Active' : 'Off'}</Badge>
              </div>
              <div className="mt-3 flex items-end gap-1">
                {p.price_is_from && <span className="pb-1 text-sm text-muted">From</span>}
                <span className="font-display text-2xl font-semibold text-green tnum">{naira(p.price_monthly)}</span>
                <span className="pb-1 text-sm text-muted">/mo</span>
              </div>
              <div className="mt-1 text-xs text-muted-2">
                {p.price_annual ? `${naira(p.price_annual)}/yr` : 'Annual quoted'} · {p.band_label}
              </div>
              <div className="mt-3 flex gap-2 border-t border-line pt-3">
                <Button size="sm" variant="secondary" icon="edit" className="flex-1" onClick={() => setEditing(p)}>Edit</Button>
                <Button size="sm" variant="ghost" icon="delete" onClick={() => remove.mutate(p.id)} />
              </div>
            </Card>
          ))}
        </div>
      </QueryState>
      {editing && <PlanModal plan={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function PlanModal({ plan, onClose }: { plan: Plan | 'new'; onClose: () => void }) {
  const isNew = plan === 'new'
  const { create, update } = usePlansCrud()
  const toast = useToast()
  const [form, setForm] = useState({
    name: isNew ? '' : plan.name,
    tier: String(isNew ? 'small' : plan.tier),
    price_monthly: isNew ? '' : plan.price_monthly,
    price_annual: isNew ? '' : (plan.price_annual ?? ''),
    price_is_from: isNew ? false : plan.price_is_from,
    min_members: isNew ? '0' : String(plan.min_members),
    max_members: isNew ? '0' : String(plan.max_members),
    description: isNew ? '' : plan.description,
    active: isNew ? true : plan.active,
  })
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      name: form.name, tier: form.tier, price_monthly: form.price_monthly,
      // Blank means the annual price is quoted per society.
      price_annual: form.price_annual === '' ? null : form.price_annual,
      price_is_from: form.price_is_from,
      min_members: Number(form.min_members), max_members: Number(form.max_members),
      description: form.description, active: form.active,
    }
    try {
      if (isNew) await create.mutateAsync(payload)
      else await update.mutateAsync({ id: plan.id, ...payload })
      toast(isNew ? 'Plan created' : 'Plan updated')
      onClose()
    } catch (err) { toast(apiErrorMessage(err, 'Could not save plan'), 'error') }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'New plan' : `Edit ${plan.name}`} subtitle="A member band and its prices">
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><input required value={form.name} onChange={(e) => set('name', e.target.value)} className="input" /></Field>
          <Field label="Tier">
            <Select value={form.tier} onChange={(e) => set('tier', e.target.value)} options={[
              { value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' },
            ]} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (₦/mo)"><input required type="number" min="0" value={form.price_monthly} onChange={(e) => set('price_monthly', e.target.value)} className="input" /></Field>
          <Field label="Price (₦/yr)" hint="Blank = quoted per society">
            <input type="number" min="0" value={form.price_annual} onChange={(e) => set('price_annual', e.target.value)} className="input" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min active members"><input type="number" min="0" value={form.min_members} onChange={(e) => set('min_members', e.target.value)} className="input" /></Field>
          <Field label="Max active members" hint="0 = no upper limit"><input type="number" min="0" value={form.max_members} onChange={(e) => set('max_members', e.target.value)} className="input" /></Field>
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={form.price_is_from} onChange={(e) => set('price_is_from', e.target.checked)} className="accent-green" /> Show the monthly price as a starting price (“From …”)
        </label>
        <Field label="Description"><input value={form.description} onChange={(e) => set('description', e.target.value)} className="input" /></Field>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} className="accent-green" /> Active (offered to new cooperatives)
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={create.isPending || update.isPending}>{isNew ? 'Create' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Branding & profile ──────────────────────────────────────────────────────
function BrandingTab() {
  const { data: profile } = usePlatformProfile()
  const update = useUpdatePlatformProfile()
  const upload = useUploadPlatformBrandAsset()
  const toast = useToast()
  const [form, setForm] = useState<Record<string, string> | null>(null)
  const f = form ?? (profile as unknown as Record<string, string>) ?? {}
  function set(k: string, v: string) { setForm({ ...f, [k]: v }) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    // logo/favicon come back as media URLs; sending those strings to an
    // ImageField would fail validation. They are saved by upload() instead.
    const { logo: _logo, favicon: _favicon, ...payload } = f
    try { await update.mutateAsync(payload); toast('Platform profile saved') }
    catch (err) { toast(apiErrorMessage(err, 'Could not save'), 'error') }
  }

  async function onUpload(field: 'logo' | 'favicon', file: File) {
    try { await upload.mutateAsync({ field, file }); toast(`${field === 'logo' ? 'Logo' : 'Favicon'} updated`) }
    catch (error) { toast(apiErrorMessage(error, 'Could not upload image'), 'error') }
  }

  if (!profile) return <Card><p className="py-4 text-sm text-muted">Loading…</p></Card>
  return (
    <Card className="max-w-2xl">
      <CardHeader title="Platform profile" subtitle="Your brand & defaults applied across the platform" />
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Platform name"><input value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} className="input" /></Field>
          <Field label="Brand colour"><input type="color" value={f.brand_color ?? '#0b4f3a'} onChange={(e) => set('brand_color', e.target.value)} className="input h-[38px] p-1" /></Field>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-sand/50 p-3">
          <BrandAssetField
            label="Logo"
            hint="Used where no cooperative brand applies — sign-in and default emails."
            url={profile.logo}
            field="logo"
            onUpload={onUpload}
            pending={upload.isPending}
          />
          <BrandAssetField
            label="Favicon"
            hint="Square mark for the browser tab."
            url={profile.favicon}
            field="favicon"
            onUpload={onUpload}
            pending={upload.isPending}
            round
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Support email"><input type="email" value={f.support_email ?? ''} onChange={(e) => set('support_email', e.target.value)} className="input" /></Field>
          <Field label="Support phone"><input value={f.support_phone ?? ''} onChange={(e) => set('support_phone', e.target.value)} className="input" placeholder="0803 000 0000" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Default currency"><input value={f.default_currency ?? ''} maxLength={3} onChange={(e) => set('default_currency', e.target.value)} className="input" /></Field>
          <Field label="Default timezone"><input value={f.default_timezone ?? ''} onChange={(e) => set('default_timezone', e.target.value)} className="input" /></Field>
          <Field
            label="Google Analytics tag"
            hint="Paste the measurement ID or the whole Google tag snippet — the ID is taken from it. Blank switches tracking off everywhere."
          >
            <input
              value={f.ga_measurement_id ?? ''}
              onChange={(e) => set('ga_measurement_id', e.target.value)}
              className="input font-mono"
              placeholder="G-XXXXXXXXXX  — or paste the whole <script> tag"
            />
          </Field>
        </div>
        <div className="flex justify-end pt-1">
          <Button type="submit" size="sm" loading={update.isPending}>Save profile</Button>
        </div>
      </form>
    </Card>
  )
}

// ── Notification templates ──────────────────────────────────────────────────
function TemplatesTab() {
  const { data: templates = [], isLoading, isError } = useNotificationTemplates()
  const [editing, setEditing] = useState<NotificationTemplate | 'new' | null>(null)

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" icon="add" onClick={() => setEditing('new')}>New template</Button>
      </div>
      <QueryState isLoading={isLoading} isError={isError}>
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-[15px] font-semibold text-ink">{t.name}</div>
                  <div className="font-mono text-xs text-muted-2">{t.key}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{t.channel_display}</Badge>
                  <Badge tone={t.active ? 'green' : 'neutral'} dot>{t.active ? 'On' : 'Off'}</Badge>
                </div>
              </div>
              {t.subject && <div className="mt-2 text-[13px] font-medium text-ink-soft">{t.subject}</div>}
              <p className="mt-1 line-clamp-2 text-[13px] text-muted">{t.body}</p>
              <div className="mt-3 border-t border-line pt-2">
                <Button size="sm" variant="secondary" icon="edit" onClick={() => setEditing(t)}>Edit & preview</Button>
              </div>
            </Card>
          ))}
        </div>
      </QueryState>
      {editing && <TemplateModal template={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function TemplateModal({ template, onClose }: { template: NotificationTemplate | 'new'; onClose: () => void }) {
  const isNew = template === 'new'
  const { create, update } = useNotificationTemplatesCrud()
  const toast = useToast()
  const [form, setForm] = useState({
    key: isNew ? '' : template.key,
    name: isNew ? '' : template.name,
    channel: String(isNew ? 'email' : template.channel),
    subject: isNew ? '' : template.subject,
    body: isNew ? '' : template.body,
    active: isNew ? true : template.active,
  })
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null)
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })) }

  async function runPreview() {
    if (isNew) { setPreview({ subject: form.subject, body: form.body }); return }
    try {
      const { data } = await api.post(`/notification-templates/${template.id}/preview/`)
      setPreview(data)
    } catch (err) { toast(apiErrorMessage(err, 'Preview failed'), 'error') }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (isNew) await create.mutateAsync(form)
      else await update.mutateAsync({ id: template.id, ...form })
      toast('Template saved')
      onClose()
    } catch (err) { toast(apiErrorMessage(err, 'Could not save template'), 'error') }
  }

  return (
    <Modal open onClose={onClose} width={620} title={isNew ? 'New template' : template.name} subtitle="Use {{placeholders}} like {{coop_name}}, {{amount}}">
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><input required value={form.name} onChange={(e) => set('name', e.target.value)} className="input" /></Field>
          <Field label="Key"><input required value={form.key} onChange={(e) => set('key', e.target.value)} className="input font-mono" placeholder="invoice-issued" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Channel">
            <Select value={form.channel} onChange={(e) => set('channel', e.target.value)} options={[
              { value: 'email', label: 'Email' }, { value: 'sms', label: 'SMS' }, { value: 'in_app', label: 'In-app' },
            ]} />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-[13px]">
            <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} className="accent-green" /> Active
          </label>
        </div>
        {form.channel === 'email' && (
          <Field label="Subject"><input value={form.subject} onChange={(e) => set('subject', e.target.value)} className="input" /></Field>
        )}
        <Field label="Body"><textarea rows={5} value={form.body} onChange={(e) => set('body', e.target.value)} className="input resize-none font-mono text-[13px]" /></Field>

        {preview && (
          <div className="rounded-lg border border-green-100 bg-green-50 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-green">Preview (sample data)</div>
            {preview.subject && <div className="mt-1 text-[13px] font-medium text-ink">{preview.subject}</div>}
            <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink-soft">{preview.body}</p>
          </div>
        )}
        <div className="flex justify-between pt-1">
          <Button type="button" variant="secondary" size="sm" icon="visibility" onClick={runPreview}>Preview</Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" loading={create.isPending || update.isPending}>Save</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── Team ────────────────────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'onboarding_lead', label: 'Onboarding lead' },
  { value: 'support', label: 'Support' },
  { value: 'finance', label: 'Finance' },
]

function TeamTab() {
  const { data: team = [], isLoading, isError } = usePlatformTeam()
  const { data: health } = usePlatformHealth()
  const [open, setOpen] = useState(false)
  const { update, remove } = usePlatformTeamCrud()
  const toast = useToast()

  async function changeRole(m: PlatformTeamMember, role: string) {
    try { await update.mutateAsync({ id: m.id, role }); toast('Role updated') }
    catch (err) { toast(apiErrorMessage(err, 'Could not update role'), 'error') }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Startup Ripple team" action={<Button size="sm" variant="secondary" icon="add" onClick={() => setOpen(true)}>Invite</Button>} />
        <QueryState isLoading={isLoading} isError={isError} minHeight={120}>
          <div className="space-y-2.5">
            {team.map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                <Avatar name={t.name} size={36} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-ink">{t.name}</div>
                  <div className="text-xs text-muted-2">{t.email}</div>
                </div>
                <Select value={t.role} onChange={(e) => changeRole(t, e.target.value)} options={ROLE_OPTIONS} className="!py-1 !text-[13px]" />
                <button onClick={() => remove.mutate(t.id)} className="text-muted-2 transition hover:text-danger" title="Remove"><Icon name="delete" size={18} /></button>
              </div>
            ))}
          </div>
        </QueryState>
      </Card>

      <Card>
        <CardHeader title="Live integrations" subtitle="Shared provider health across tenants" />
        <div className="space-y-2">
          {(health?.providers ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-line bg-paper px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-sm font-medium text-ink"><Icon name="extension" size={18} className="text-muted-2" /> {p.name}</span>
              <Badge tone={p.status === 'operational' ? 'green' : p.status === 'degraded' ? 'gold' : 'danger'} dot>{p.status}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <InviteModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = usePlatformTeamCrud()
  const toast = useToast()
  const [form, setForm] = useState({ invite_name: '', invite_email: '', role: 'support' })
  function set(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await create.mutateAsync({ invite_name: form.invite_name, invite_email: form.invite_email, role: form.role })
      toast('Team member invited'); onClose(); setForm({ invite_name: '', invite_email: '', role: 'support' })
    } catch (err) { toast(apiErrorMessage(err, 'Could not invite'), 'error') }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite team member" subtitle="Grants platform-admin access">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Full name"><input required value={form.invite_name} onChange={(e) => set('invite_name', e.target.value)} className="input" /></Field>
        <Field label="Email"><input required type="email" value={form.invite_email} onChange={(e) => set('invite_email', e.target.value)} className="input" /></Field>
        <Field label="Role"><Select value={form.role} onChange={(e) => set('role', e.target.value)} options={ROLE_OPTIONS} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={create.isPending}>Send invite</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Compliance & data ───────────────────────────────────────────────────────
function ComplianceTab() {
  const { data: events = [], isLoading, isError } = useAuditStream()
  const toast = useToast()

  async function exportData() {
    try {
      const { data: blob } = await api.get('/platform/export/', { responseType: 'blob' })
      const url = URL.createObjectURL(blob as Blob)
      const a = document.createElement('a'); a.href = url; a.download = 'cooperatives-export.csv'; a.click(); URL.revokeObjectURL(url)
    } catch (err) { toast(apiErrorMessage(err, 'Export failed'), 'error') }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <div className="grid gap-3 sm:grid-cols-3">
          <Item icon="verified_user" title="NDPA 2023" hint="Consent, retention & subject-access flows configured" />
          <Item icon="shield" title="Tenant isolation" hint="Row-level scoping enforced on every endpoint" />
          <Item icon="history" title="Immutable audit" hint="Every super-admin action logged & exportable" />
        </div>
      </Card>

      <Card>
        <CardHeader title="Data export" subtitle="Download the cooperative directory (CSV)" />
        <Button size="sm" icon="download" onClick={exportData}>Export cooperatives</Button>
      </Card>

      <Card>
        <CardHeader title="Platform audit log" subtitle="Recent admin actions" />
        <QueryState isLoading={isLoading} isError={isError} minHeight={120}>
          <div className="space-y-1.5">
            {events.length === 0 && <p className="py-2 text-sm text-muted">No recent activity.</p>}
            {events.slice(0, 10).map((e) => (
              <div key={e.id} className="flex items-center gap-2.5 text-[13px]">
                <span className="font-mono text-xs text-green">{e.action.replace('cooperative.', '')}</span>
                <span className="flex-1 truncate text-ink-soft">{e.cooperative ?? e.entity}</span>
                <span className="text-muted-2">{e.actor}</span>
                <span className="text-xs text-muted-2">{dateTime(e.created_at)}</span>
              </div>
            ))}
          </div>
        </QueryState>
      </Card>
    </div>
  )
}

function Item({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-green-100 bg-green-50 px-3.5 py-3">
      <Icon name={icon} size={20} className="mt-0.5 text-green" />
      <div>
        <div className="text-[13px] font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-xs text-muted">{hint}</div>
      </div>
    </div>
  )
}
