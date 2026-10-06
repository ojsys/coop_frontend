import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useContributionTypes,
  useCooperative,
  useMembers,
  useProviderAccounts,
  useRoles,
  useSavingsProducts,
} from '@/api/hooks'
import {
  useUpdateCooperative,
  useProposeBankDetails,
  useUploadCooperativeBrandAsset,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useProviderAccountsCrud,
  useSavingsProductsCrud,
  useConnectSettlementAccount,
} from '@/api/mutations'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/ui/toast'
import { PageHeader } from '@/ui/PageHeader'
import { Card, CardHeader } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Badge } from '@/ui/Badge'
import { Modal } from '@/ui/Modal'
import { Field, Select } from '@/ui/Field'
import { BankSelect } from '@/ui/BankSelect'
import { BrandAssetField } from '@/ui/BrandAssetField'
import { apiErrorMessage } from '@/lib/apiError'
import { LocationSelect, CoopTypeSelect } from '@/ui/StateLGASelect'
import { naira } from '@/lib/format'
import type { Cooperative, Role } from '@/api/types'

// Permission catalogue shown in the role editor (mirrors accounts.models.Role).
const PERMISSIONS: { slug: string; label: string; privileged?: boolean }[] = [
  { slug: 'self.view', label: 'View own records' },
  { slug: 'reports.view', label: 'View reports' },
  { slug: 'governance.vote', label: 'Vote in resolutions' },
  { slug: 'governance.approve', label: 'Approve resolutions' },
  { slug: 'governance.manage', label: 'Manage governance', privileged: true },
  { slug: 'members.manage', label: 'Manage members', privileged: true },
  { slug: 'comms.broadcast', label: 'Broadcast announcements' },
  { slug: 'ledger.post', label: 'Post to the ledger', privileged: true },
  { slug: 'ledger.reconcile', label: 'Reconcile payments', privileged: true },
]

const TIER_LABEL: Record<string, string> = {
  small: 'Small', medium: 'Medium', large: 'Large / Institutional',
}

export function SettingsPage() {
  const { activeMembership, activeCooperativeId } = useAuth()
  // The console is open to any office-holder (a Chairperson sits on it for
  // approvals), but roles and the society profile are writable only by a
  // privileged member. Showing those controls to everyone else just hands
  // them a 403.
  const canManage = activeMembership?.is_privileged ?? false
  const coop = useCooperative(activeCooperativeId ?? undefined)
  const types = useContributionTypes()
  const providers = useProviderAccounts()
  const roles = useRoles()
  const members = useMembers()
  const [profileOpen, setProfileOpen] = useState(false)
  const [roleEditing, setRoleEditing] = useState<Role | 'new' | null>(null)
  const [providerOpen, setProviderOpen] = useState(false)
  const brandUpload = useUploadCooperativeBrandAsset()
  const brandToast = useToast()
  const connectAccount = useConnectSettlementAccount()
  const toast = useToast()

  async function onBrandUpload(field: 'logo' | 'favicon', file: File) {
    if (!activeCooperativeId) return
    try {
      await brandUpload.mutateAsync({ id: activeCooperativeId, field, file })
      brandToast(field === 'logo' ? 'Logo updated' : 'Favicon updated')
    } catch (error) {
      brandToast(apiErrorMessage(error, 'Could not upload image'), 'error')
    }
  }

  /**
   * Create the society's settlement subaccount at the payment provider.
   *
   * Idempotent server-side, so a double click returns the existing account
   * rather than splitting settlement across two subaccounts. A society whose
   * bank details predate bank selection has no bank *code*, and the API answers
   * 400 naming what is missing — which is why the error is surfaced verbatim
   * rather than replaced with a generic message.
   */
  async function connectSettlement() {
    const id = coop.data?.id
    if (!id) return
    try {
      const result = await connectAccount.mutateAsync(id)
      toast(result.detail)
    } catch (error) {
      toast(
        apiErrorMessage(error, 'Could not connect the settlement account'),
        'error',
      )
    }
  }

  const roleCounts = (roles.data ?? []).map((r) => ({
    ...r,
    count: (members.data ?? []).filter((m) => m.role_name === r.name).length,
  }))
  const privilegedRoleCount = (roles.data ?? []).filter((r) => r.is_privileged).length
  const connectedProviders = (providers.data ?? []).filter(
    (p: Record<string, unknown>) => p.connected,
  ).length

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Society profile, contribution types, payments, roles & security"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Society profile"
            action={
              canManage ? (
                <Button size="sm" variant="secondary" icon="edit" onClick={() => setProfileOpen(true)}>
                  Edit
                </Button>
              ) : undefined
            }
          />
          <div className="flex items-center gap-3">
            {coop.data?.logo ? (
              <img
                src={coop.data.logo}
                alt=""
                className="size-12 rounded-lg border border-line bg-paper object-contain"
              />
            ) : (
              <span className="flex size-12 items-center justify-center rounded-lg text-green"
                style={{ background: (coop.data?.brand_color ?? '#0b4f3a') + '18' }}>
                <Icon name="storefront" size={24} />
              </span>
            )}
            <div>
              <div className="font-display text-[15px] font-semibold text-ink">
                {coop.data?.name ?? activeMembership?.cooperative_name}
              </div>
              <div className="text-[13px] text-muted">
                {coop.data ? `${TIER_LABEL[coop.data.tier] ?? coop.data.tier} plan · ${coop.data.base_currency}` : '—'}
                {coop.data?.state ? ` · ${coop.data.state}` : ''}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Branding"
            subtitle="Shown in the member app and on statements"
          />
          {coop.data ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <BrandAssetField
                label="Logo"
                hint="Appears in the member app and atop PDF statements."
                url={coop.data.logo}
                field="logo"
                pending={brandUpload.isPending}
                onUpload={onBrandUpload}
              />
              <BrandAssetField
                label="Favicon"
                hint="Square mark for the browser tab and PWA icon."
                url={coop.data.favicon}
                field="favicon"
                pending={brandUpload.isPending}
                onUpload={onBrandUpload}
                round
              />
            </div>
          ) : (
            <p className="py-2 text-sm text-muted">Loading…</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Contribution types" subtitle={`${types.data?.length ?? 0} configured`} />
          <div className="space-y-2">
            {(types.data ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">{t.name}</span>
                <span className="font-mono text-muted tnum">
                  {t.expected_amount ? naira(t.expected_amount) : 'Variable'}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <SavingsProductsCard />

        <Card>
          <CardHeader
            title="Payment providers"
            subtitle="Collections settle to the society's own account. Lending draws on the disbursement wallet below."
            action={
              canManage ? (
                <div className="flex gap-2">
                  {/* The proper path: creates the subaccount at the provider
                      from the society's vetted bank details. "Add" below
                      stores a hand-typed code, which cannot be verified. */}
                  <Button
                    size="sm"
                    icon="link"
                    loading={connectAccount.isPending}
                    onClick={connectSettlement}
                  >
                    Connect
                  </Button>
                  <Button size="sm" variant="secondary" icon="add" onClick={() => setProviderOpen(true)}>Add</Button>
                </div>
              ) : undefined
            }
          />
          <div className="space-y-2.5">
            {(providers.data ?? []).map((p: Record<string, unknown>) => (
              <div key={String(p.id)} className="flex items-center justify-between rounded-lg border border-line bg-paper px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Icon name="credit_card" size={20} className="text-muted-2" />
                  <div>
                    <div className="text-sm font-medium capitalize text-ink">{String(p.provider)}</div>
                    <div className="font-mono text-xs text-muted-2">
                      {String(p.subaccount_code)} · {String(p.bank_name)}
                    </div>
                  </div>
                </div>
                <Badge tone={p.connected ? 'green' : 'neutral'} dot>
                  {p.connected ? 'Connected' : 'Not connected'}
                </Badge>
              </div>
            ))}
            {(providers.data ?? []).length === 0 && (
              <p className="py-2 text-sm text-muted">No PSP subaccounts connected.</p>
            )}
          </div>
        </Card>

        {/* The wallet moved to its own page: it is an everyday lending
            operation, not a setting, and officers could not find it here. */}
        <Card>
          <CardHeader
            title="Disbursement wallet"
            subtitle="The float this society lends from, with top-ups and history."
            action={
              <Link to="/console/wallet">
                <Button size="sm" variant="secondary" icon="arrow_forward">
                  Open wallet
                </Button>
              </Link>
            }
          />
        </Card>

        <Card>
          <CardHeader
            title="Roles & permissions"
            subtitle="scoped to this society"
            action={
              canManage ? (
                <Button size="sm" variant="secondary" icon="add" onClick={() => setRoleEditing('new')}>
                  Add role
                </Button>
              ) : undefined
            }
          />
          <div className="space-y-1">
            {roleCounts.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-sand/60">
                <span className="flex items-center gap-2 text-ink-soft">
                  {r.name}
                  {r.is_privileged && <Badge tone="gold">2FA</Badge>}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-2">{r.count}</span>
                  {canManage && (
                    <button onClick={() => setRoleEditing(r)} className="rounded p-1 text-muted-2 hover:text-ink" title="Edit role">
                      <Icon name="edit" size={16} />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <CollectionAccountCard coop={coop.data} canManage={canManage} />

        <Card className="lg:col-span-2">
          <CardHeader title="Security & compliance" />
          {/* These were three fixed labels — "Enforced", "Configured",
              "Verified" — asserted to every cooperative regardless of its
              actual state, including "Verified" with no payment provider
              connected at all. Only facts this page can actually see are
              shown; the NDPA claim had no signal behind it and is gone. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Compliance
              icon="verified_user"
              title="Privileged roles (2FA required)"
              status={`${privilegedRoleCount} of ${(roles.data ?? []).length} roles`}
              ok={privilegedRoleCount > 0}
            />
            <Compliance
              icon="shield"
              title="Payment provider"
              status={connectedProviders > 0 ? `${connectedProviders} connected` : 'Not connected'}
              ok={connectedProviders > 0}
            />
          </div>
        </Card>
      </div>

      {coop.data && (
        <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} coop={coop.data} />
      )}
      <RoleModal role={roleEditing} onClose={() => setRoleEditing(null)} />
      {providerOpen && <ProviderModal onClose={() => setProviderOpen(false)} />}
    </div>
  )
}

function ProfileModal({ open, onClose, coop }: { open: boolean; onClose: () => void; coop: Cooperative }) {
  const update = useUpdateCooperative()
  const toast = useToast()
  const [form, setForm] = useState({
    name: coop.name,
    coop_type: coop.coop_type ?? '',
    country: coop.country ?? '',
    state: coop.state ?? '',
    lga: coop.lga ?? '',
    base_currency: coop.base_currency,
    tier: coop.tier,
    brand_color: coop.brand_color,
    member_cap: String(coop.member_cap),
    contact_email: coop.contact_email ?? '',
    contact_phone: coop.contact_phone ?? '',
    contact_address: coop.contact_address ?? '',
    statement_footer: coop.statement_footer ?? '',
  })

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await update.mutateAsync({
        id: coop.id,
        name: form.name,
        coop_type: form.coop_type,
        country: form.country,
        state: form.state,
        lga: form.lga,
        base_currency: form.base_currency,
        tier: form.tier,
        brand_color: form.brand_color,
        member_cap: Number(form.member_cap),
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        contact_address: form.contact_address,
        statement_footer: form.statement_footer,
      })
      toast('Society profile updated')
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not update profile'), 'error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit society profile" subtitle="Visible to members and on statements">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Society name">
          <input required value={form.name} onChange={(e) => set('name', e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <CoopTypeSelect value={form.coop_type} onChange={(v) => set('coop_type', v)} />
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
        </div>
        <LocationSelect
          country={form.country}
          state={form.state}
          lga={form.lga}
          onCountry={(v) => set('country', v)}
          onState={(v) => set('state', v)}
          onLga={(v) => set('lga', v)}
        />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Currency">
            <input value={form.base_currency} onChange={(e) => set('base_currency', e.target.value)} className="input" maxLength={3} />
          </Field>
          <Field label="Member cap">
            <input inputMode="numeric" value={form.member_cap} onChange={(e) => set('member_cap', e.target.value)} className="input" />
          </Field>
          <Field label="Brand colour">
            <input type="color" value={form.brand_color} onChange={(e) => set('brand_color', e.target.value)} className="input h-[38px] p-1" />
          </Field>
        </div>
        <div className="rounded-xl border border-line bg-sand/50 p-3">
          <div className="mb-2 text-[13px] font-semibold text-ink">Contact details</div>
          <p className="mb-3 text-xs text-muted-2">Shown to members and printed at the foot of statements.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} className="input" placeholder="hello@society.coop" />
            </Field>
            <Field label="Phone">
              <input value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} className="input" placeholder="0803 000 0000" />
            </Field>
          </div>
          <Field label="Address">
            <input value={form.contact_address} onChange={(e) => set('contact_address', e.target.value)} className="input" placeholder="12 Awolowo Road, Ikoyi, Lagos" />
          </Field>
          <Field label="Statement footer" hint="Replaces the default line at the foot of generated statements.">
            <input value={form.statement_footer} onChange={(e) => set('statement_footer', e.target.value)} className="input" placeholder="Ìmọ̀lè MCS — RC 12345" />
          </Field>
        </div>

        {/* The collection account is not edited here. It is the one field where
            one officer could redirect every future payment, so it needs a
            second officer's approval — see the Collection account card. Leaving
            the inputs here would post values the server now discards, which
            looks like saving and is not. */}
        <div className="rounded-xl border border-line bg-sand/50 px-3.5 py-3 text-[13px] text-ink-soft">
          <Icon name="lock" size={15} className="mr-1.5 inline text-muted-2" />
          Bank details are changed under <strong className="font-medium">Collection
          account</strong>, where another officer approves them.
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={update.isPending}>
            Save profile
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function RoleModal({ role, onClose }: { role: Role | 'new' | null; onClose: () => void }) {
  if (role === null) return null
  return <RoleForm key={role === 'new' ? 'new' : role.id} role={role} onClose={onClose} />
}

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function RoleForm({ role, onClose }: { role: Role | 'new'; onClose: () => void }) {
  const isNew = role === 'new'
  const create = useCreateRole()
  const update = useUpdateRole()
  const del = useDeleteRole()
  const toast = useToast()
  const [name, setName] = useState(isNew ? '' : role.name)
  const [perms, setPerms] = useState<string[]>(isNew ? ['self.view'] : role.permissions)
  // Unticking a privileged permission can demote every holder at once; the
  // server refuses that and says what to do instead. Keep the explanation on
  // screen next to the tickbox that caused it.
  const [error, setError] = useState<string | null>(null)

  function toggle(slug: string) {
    setPerms((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug]))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (isNew) {
        await create.mutateAsync({ name, slug: slugify(name), permissions: perms })
        toast('Role created')
      } else {
        await update.mutateAsync({ id: role.id, name, permissions: perms })
        toast('Role updated')
      }
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save role'))
    }
  }

  async function remove() {
    if (isNew) return
    setError(null)
    try {
      await del.mutateAsync(role.id)
      toast('Role deleted')
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete role'))
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add role' : `Edit ${role.name}`} subtitle="A named bundle of permissions">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Role name">
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Auditor" />
        </Field>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Permissions</span>
          <div className="space-y-1.5">
            {PERMISSIONS.map((p) => (
              <label key={p.slug} className="flex items-center gap-2.5 rounded-md border border-line px-3 py-2 text-[13px]">
                <input type="checkbox" checked={perms.includes(p.slug)} onChange={() => toggle(p.slug)} className="accent-green" />
                <span className="flex-1 text-ink-soft">{p.label}</span>
                {p.privileged && <Badge tone="gold">2FA</Badge>}
              </label>
            ))}
          </div>
        </div>
        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-[13px] text-danger">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between pt-2">
          {!isNew ? (
            <Button type="button" variant="danger" size="sm" icon="delete" onClick={remove} loading={del.isPending}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={create.isPending || update.isPending}>
              {isNew ? 'Create role' : 'Save changes'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

function SavingsProductsCard() {
  const { data: products = [] } = useSavingsProducts()
  const { data: types = [] } = useContributionTypes()
  const { create, remove } = useSavingsProductsCrud()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', interest_rate: '0', contribution_type: '' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await create.mutateAsync({ name: form.name, description: form.description, interest_rate: form.interest_rate, contribution_type: form.contribution_type ? Number(form.contribution_type) : null, active: true })
      toast('Savings product added'); setOpen(false); setForm({ name: '', description: '', interest_rate: '0', contribution_type: '' })
    } catch (err) { toast(apiErrorMessage(err, 'Could not add product'), 'error') }
  }

  return (
    <Card>
      <CardHeader title="Savings products" subtitle="Named savings plans (Ajo, target savings…)" action={<Button size="sm" variant="secondary" icon="add" onClick={() => setOpen(true)}>Add</Button>} />
      <div className="space-y-2">
        {products.length === 0 && <p className="text-[13px] text-muted">No savings products yet.</p>}
        {products.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">{p.name} <span className="text-muted-2">· {p.goal_count} goals</span></span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-2">{p.interest_rate}%</span>
              <button onClick={() => remove.mutate(p.id)} className="text-muted-2 hover:text-danger"><Icon name="delete" size={16} /></button>
            </span>
          </div>
        ))}
      </div>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="New savings product">
          <form onSubmit={submit} className="space-y-3.5">
            <Field label="Name"><input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" placeholder="Target Savings (Ajo)" /></Field>
            <Field label="Description"><input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="input" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Interest rate (%)"><input type="number" min="0" step="0.1" value={form.interest_rate} onChange={(e) => setForm((f) => ({ ...f, interest_rate: e.target.value }))} className="input" /></Field>
              <Field label="Counts contributions of" hint="Optional">
                <Select value={form.contribution_type} onChange={(e) => setForm((f) => ({ ...f, contribution_type: e.target.value }))} options={[{ value: '', label: 'Total savings' }, ...types.map((t) => ({ value: String(t.id), label: t.name }))]} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" loading={create.isPending}>Add product</Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  )
}

function ProviderModal({ onClose }: { onClose: () => void }) {
  const { create } = useProviderAccountsCrud()
  const toast = useToast()
  const [form, setForm] = useState({ provider: 'paystack', subaccount_code: '', bank_name: '' })
  function set(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await create.mutateAsync({ ...form, connected: true })
      toast('Payment provider added')
      onClose()
    } catch (err) { toast(apiErrorMessage(err, 'Could not add provider'), 'error') }
  }

  return (
    <Modal open onClose={onClose} title="Add payment provider" subtitle="Collections settle to the society's own subaccount">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Provider">
          <Select value={form.provider} onChange={(e) => set('provider', e.target.value)} options={[
            { value: 'paystack', label: 'Paystack' }, { value: 'flutterwave', label: 'Flutterwave' },
          ]} />
        </Field>
        <Field label="Subaccount code" hint="From the PSP dashboard">
          <input required value={form.subaccount_code} onChange={(e) => set('subaccount_code', e.target.value)} className="input font-mono" placeholder="ACCT_xxxxxx" />
        </Field>
        <Field label="Bank name">
          <input value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} className="input" placeholder="GTBank" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={create.isPending}>Add provider</Button>
        </div>
      </form>
    </Modal>
  )
}

/** `ok` false renders neutrally — a green "Verified" badge for something that
 *  is not set up reads as a guarantee the platform has not earned. */
function Compliance({
  icon,
  title,
  status,
  ok = true,
}: {
  icon: string
  title: string
  status: string
  ok?: boolean
}) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 ${
        ok ? 'border-green-100 bg-green-50' : 'border-line bg-paper'
      }`}
    >
      <Icon name={icon} size={20} className={`mt-0.5 ${ok ? 'text-green' : 'text-muted-2'}`} />
      <div>
        <div className="text-[13px] font-medium text-ink">{title}</div>
        <div className={`mt-0.5 text-xs font-semibold ${ok ? 'text-green' : 'text-muted'}`}>
          {status}
        </div>
      </div>
    </div>
  )
}

/**
 * The cooperative's collection account — proposed here, approved elsewhere.
 *
 * Deliberately not part of the profile form. A bank account is the one field
 * where a single mistaken or compromised officer could redirect every future
 * payment, so the server refuses it on the profile endpoint: a change proposed
 * here takes effect only once a *different* privileged officer approves it
 * under Approvals.
 */

function CollectionAccountCard({
  coop,
  canManage,
}: {
  coop?: Cooperative
  canManage: boolean
}) {
  const propose = useProposeBankDetails()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    bank_name: '',
    bank_code: '',
    bank_account_name: '',
    bank_account_no: '',
    note: '',
  })

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!coop) return
    try {
      const result = await propose.mutateAsync({ id: coop.id, ...form })
      toast(result.detail)
      setOpen(false)
      setForm({ bank_name: '', bank_code: '', bank_account_name: '', bank_account_no: '', note: '' })
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not send it for approval'), 'error')
    }
  }

  const unset = !coop?.bank_account_no

  return (
    <Card>
      <CardHeader
        title="Collection account"
        subtitle="Where members' direct transfers are paid in"
        action={
          canManage ? (
            <Button size="sm" variant="secondary" icon="edit" onClick={() => setOpen(true)}>
              Propose change
            </Button>
          ) : undefined
        }
      />

      {unset ? (
        <p className="py-2 text-[13px] text-muted">
          No account set. Members have nowhere to transfer to until one is added
          and approved.
        </p>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Bank</span>
            <span className="text-ink">{coop?.bank_name || '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Account number</span>
            <span className="font-mono text-ink">{coop?.bank_account_no}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Account name</span>
            <span className="truncate text-ink">{coop?.bank_account_name || '—'}</span>
          </div>
        </div>
      )}

      <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-sand px-3 py-2 text-xs text-muted">
        <Icon name="verified_user" size={14} className="mt-0.5 shrink-0" />
        Changes need a second officer's approval before they take effect — whoever
        proposes one cannot approve it.
      </p>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Propose a new collection account"
          subtitle="Another officer must approve it before anything changes"
        >
          <form onSubmit={submit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <BankSelect
                label="Bank name"
                required
                name={form.bank_name}
                code={form.bank_code}
                onChange={(next) => setForm((f) => ({ ...f, ...next }))}
              />
              <Field label="Account number">
                <input required inputMode="numeric" value={form.bank_account_no} onChange={(e) => set('bank_account_no', e.target.value)} className="input font-mono" placeholder="0123456789" />
              </Field>
            </div>
            <Field label="Account name">
              <input required value={form.bank_account_name} onChange={(e) => set('bank_account_name', e.target.value)} className="input" placeholder={coop?.name} />
            </Field>
            <Field label="Note for the approver" hint="Optional — why it is changing.">
              <input value={form.note} onChange={(e) => set('note', e.target.value)} className="input" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={propose.isPending}>
                Send for approval
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  )
}
