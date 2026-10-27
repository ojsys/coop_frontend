import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  useCooperative,
  useInvoices,
  useSubscriptions,
  usePlans,
  useSupportTickets,
  usePlatformMembers,
  usePlatformMember,
  usePlatformMemberDocuments,
} from '@/api/hooks'
import {
  useUpdateCooperative,
  useSubscriptionsCrud,
  useSupportTicketsCrud,
  useCooperativeAction,
  useImpersonate,
  useCooperativeHealthCheck,
} from '@/api/mutations'
import { session } from '@/api/session'
import { DomainManager } from '../DomainManager'
import { PageHeader } from '@/ui/PageHeader'
import { Card, CardHeader } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Avatar } from '@/ui/Avatar'
import { Badge, StatusPill } from '@/ui/Badge'
import { StatTile } from '@/ui/StatTile'
import { QueryState } from '@/ui/QueryState'
import { Modal } from '@/ui/Modal'
import { Field, Select } from '@/ui/Field'
import { LocationSelect, CoopTypeSelect } from '@/ui/StateLGASelect'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { naira, num, longDate, shortDate, dateTime, memberCap } from '@/lib/format'
import { Table, Pagination, type Column } from '@/ui/Table'
import { memberMatches } from '@/lib/members'
import type {
  Cooperative, CooperativeHealth, Member, SupportTicket,
} from '@/api/types'

type Tab = 'overview' | 'members' | 'config' | 'support'

export function CooperativeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: coop, isLoading, isError } = useCooperative(id)
  const { data: subscriptions = [] } = useSubscriptions()
  const { data: invoices = [] } = useInvoices()
  // ?member=<id> arrives from the platform-wide person search: open that
  // person's profile straight away.
  const [params] = useSearchParams()
  const linkedMember = Number(params.get('member')) || null
  const [tab, setTab] = useState<Tab>(linkedMember ? 'members' : 'overview')

  const coopId = coop?.id
  const subscription = subscriptions.find((s) => s.cooperative === coopId)
  const coopInvoices = invoices.filter((i) => i.cooperative === coopId).slice(0, 5)

  return (
    <div>
      <button
        onClick={() => navigate('/platform/cooperatives')}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted transition hover:text-ink"
      >
        <Icon name="arrow_back" size={18} /> All cooperatives
      </button>

      <QueryState isLoading={isLoading} isError={isError}>
        {coop && (
          <>
            <div className="mb-5 flex items-center gap-4">
              <Avatar name={coop.name} size={52} />
              <div className="flex-1">
                <PageHeader
                  title={coop.name}
                  subtitle={`${coop.state || '—'} · Reg. ${coop.registration_no || '—'} · provisioned ${longDate(coop.created_at)}`}
                />
              </div>
              <StatusPill status={coop.status} />
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile label="Plan" value={coop.plan_name ?? '—'} icon="workspace_premium" iconTone="gold" />
              <StatTile label="Member cap" value={memberCap(coop.member_cap)} icon="groups" iconTone="green" />
              <StatTile label="Currency" value={coop.base_currency} icon="payments" iconTone="neutral" />
              <StatTile label="Type" value={coop.coop_type || '—'} icon="category" iconTone="neutral" />
            </div>

            <div className="mb-4 flex items-center gap-1 rounded-lg border border-line bg-card p-1">
              {(['overview', 'members', 'config', 'support'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
                    tab === t ? 'bg-green-50 text-green' : 'text-muted hover:bg-sand-deep'
                  }`}
                >
                  {t === 'config' ? 'Configuration' : t}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <OnboardingCard coopId={coop.id} />
                <Card>
                  <CardHeader
                    title="Billing & subscription"
                    subtitle={
                      subscription
                        ? `${subscription.plan_name} · ${subscription.status_display}`
                        : 'No active subscription'
                    }
                  />
                  {subscription ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Badge tone={subscription.status === 'active' ? 'green' : subscription.status === 'past_due' ? 'danger' : 'gold'} dot>
                          {subscription.status_display}
                        </Badge>
                        {subscription.current_period_end && (
                          <span className="text-xs text-muted-2">renews {shortDate(subscription.current_period_end)}</span>
                        )}
                      </div>
                      <div className="mt-3 space-y-1.5">
                        {coopInvoices.length === 0 && <p className="text-[13px] text-muted">No invoices yet.</p>}
                        {coopInvoices.map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between text-[13px]">
                            <span className="font-mono text-xs text-muted-2">{inv.number}</span>
                            <span className="flex items-center gap-2">
                              <span className="font-mono tnum text-ink-soft">{naira(inv.amount)}</span>
                              <StatusPill status={inv.status} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-[13px] text-muted">
                      Not on a plan yet — assign one from the Configuration tab.
                    </p>
                  )}
                </Card>
              </div>
            )}

            {tab === 'members' && <MembersTab coop={coop} initialViewing={linkedMember} />}

            {tab === 'config' && <ConfigTab coop={coop} />}

            {tab === 'support' && <SupportTab coop={coop} />}
          </>
        )}
      </QueryState>
    </div>
  )
}

// ── Overview: real onboarding checklist ─────────────────────────────────────
function OnboardingCard({ coopId }: { coopId: number }) {
  const health = useCooperativeHealthCheck()
  const [data, setData] = useState<CooperativeHealth | null>(null)
  const { mutateAsync } = health

  useEffect(() => {
    mutateAsync(coopId).then(setData).catch(() => {})
  }, [coopId, mutateAsync])

  return (
    <Card>
      <CardHeader title="Onboarding" subtitle="Live readiness — first call to first reconciled cycle" />
      <div className="space-y-2.5">
        {!data && <p className="py-2 text-sm text-muted">Checking…</p>}
        {data?.checks.map((c) => (
          <div key={c.key} className="flex items-center gap-2.5 text-sm">
            <Icon
              name={c.ok ? 'check_circle' : 'radio_button_unchecked'}
              size={18}
              fill={c.ok}
              className={c.ok ? 'text-green-bright' : 'text-muted-2'}
            />
            <span className="flex-1 text-ink-soft">{c.label}</span>
            <span className="text-xs text-muted-2">{c.detail}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Configuration tab ───────────────────────────────────────────────────────
function ConfigTab({ coop }: { coop: Cooperative }) {
  const { data: plans = [] } = usePlans()
  const { data: subscriptions = [] } = useSubscriptions()
  const subs = useSubscriptionsCrud()
  const toast = useToast()
  const [profileOpen, setProfileOpen] = useState(false)

  const subscription = subscriptions.find((s) => s.cooperative === coop.id)

  async function save(patch: Record<string, unknown>) {
    try {
      if (subscription) {
        await subs.update.mutateAsync({ id: subscription.id, ...patch })
      } else if (patch.plan) {
        await subs.create.mutateAsync({ cooperative: coop.id, status: 'active', ...patch })
      }
      toast('Subscription updated')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not update subscription'), 'error')
    }
  }
  const setPlan = (planId: string) => planId && save({ plan: Number(planId) })
  const [override, setOverride] = useState<string | null>(null)
  const overrideValue = override ?? subscription?.price_override ?? ''

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Society profile"
          action={<Button size="sm" variant="secondary" icon="edit" onClick={() => setProfileOpen(true)}>Edit</Button>}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Detail label="Name" value={coop.name} />
          <Detail label="Type" value={coop.coop_type || '—'} />
          <Detail label="State / LGA" value={`${coop.state || '—'}${coop.lga ? ` · ${coop.lga}` : ''}`} />
          <Detail label="Member cap" value={`${memberCap(coop.member_cap)} · set by the plan`} />
          <Detail label="Base currency" value={coop.base_currency} />
          <Detail label="Brand colour" value={coop.brand_color} swatch={coop.brand_color} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Subscription plan" subtitle="Assign or change the billing plan" />
        <div className="space-y-3">
          <Field label="Plan">
            <Select
              value={subscription ? String(subscription.plan) : ''}
              onChange={(e) => setPlan(e.target.value)}
              options={[
                { value: '', label: subscription ? '—' : 'No plan — select to assign' },
                ...plans.map((p) => ({ value: String(p.id), label: `${p.name} · ${p.band_label} · ${naira(p.price_monthly)}/mo` })),
              ]}
            />
          </Field>
          {subscription && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Billing">
                <Select
                  value={subscription.billing_cycle}
                  onChange={(e) => save({ billing_cycle: e.target.value })}
                  options={[
                    { value: 'annual', label: 'Annual (2 months free)' },
                    { value: 'monthly', label: 'Monthly' },
                  ]}
                />
              </Field>
              {/* Institutional is quoted per society; a negotiated figure is
                  recorded here and is what every invoice then charges. */}
              <Field label="Negotiated price (₦ per cycle)" hint="Blank = list price">
                <input
                  type="number"
                  min="0"
                  value={overrideValue}
                  onChange={(e) => setOverride(e.target.value)}
                  onBlur={() => {
                    if (override === null) return
                    save({ price_override: override === '' ? null : override })
                    setOverride(null)
                  }}
                  className="input"
                />
              </Field>
            </div>
          )}
          {subscription && (
            // Until this date the society keeps every feature whatever its
            // plan. Clearing it makes features follow the plan from today.
            <Field label="All features until" hint="Blank = features follow the plan">
              <input
                type="date"
                value={subscription.features_grace_until ?? ''}
                onChange={(e) => save({ features_grace_until: e.target.value || null })}
                className="input"
              />
            </Field>
          )}
          {subscription && (
            <p className="text-xs text-muted-2">
              {subscription.cycle_amount
                ? `Invoiced ${naira(subscription.cycle_amount)} per ${subscription.billing_cycle === 'annual' ? 'year' : 'month'}.`
                : 'No annual price yet — enter the quoted price, or billing will skip this society.'}
            </p>
          )}
          {subscription && (
            <Field label="Status">
              <Select
                value={subscription.status}
                onChange={(e) => save({ status: e.target.value })}
                options={[
                  { value: 'trial', label: 'Trial' },
                  { value: 'active', label: 'Active' },
                  { value: 'past_due', label: 'Past due' },
                  { value: 'canceled', label: 'Canceled' },
                ]}
              />
            </Field>
          )}
          {subs.update.isPending || subs.create.isPending ? (
            <p className="text-xs text-muted-2">Saving…</p>
          ) : null}
        </div>
      </Card>

      <div className="lg:col-span-2">
        <DomainManager cooperativeId={coop.id} />
      </div>

      {profileOpen && <ProfileModal coop={coop} onClose={() => setProfileOpen(false)} />}
    </div>
  )
}

function ProfileModal({ coop, onClose }: { coop: Cooperative; onClose: () => void }) {
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
      })
      toast('Society profile updated')
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not update profile'), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit society profile" subtitle={coop.name}>
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
                { value: 'small', label: 'Small' },
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' },
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency"><input value={form.base_currency} maxLength={3} onChange={(e) => set('base_currency', e.target.value)} className="input" /></Field>
          <Field label="Brand"><input type="color" value={form.brand_color} onChange={(e) => set('brand_color', e.target.value)} className="input h-[38px] p-1" /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={update.isPending}>Save profile</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Support tab ─────────────────────────────────────────────────────────────
// ── Members: who is actually inside this cooperative ────────────────────────
const MEMBERS_PAGE = 25

function MembersTab({ coop, initialViewing = null }: { coop: Cooperative; initialViewing?: number | null }) {
  const { data: members = [], isLoading, isError } = usePlatformMembers(coop.id)
  const [target, setTarget] = useState<Member | null>(null)
  const [viewing, setViewing] = useState<number | null>(initialViewing)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const officers = members.filter((m) => m.role_name && m.role_name !== 'Member')
  const nonMembers = members.filter((m) => m.kind === 'non_member')
  const filtered = members.filter((m) => memberMatches(m, search))
  const paged = filtered.slice((page - 1) * MEMBERS_PAGE, page * MEMBERS_PAGE)

  const columns: Column<Member>[] = [
    {
      key: 'member',
      header: 'Member',
      render: (m) => (
        <div className="flex items-center gap-3">
          <Avatar name={m.full_name} size={34} />
          <div>
            <div className="flex items-center gap-1.5 font-medium text-ink">
              {m.full_name}
              {m.kind === 'non_member' && <Badge tone="blue">Non-member</Badge>}
            </div>
            <div className="font-mono text-xs text-muted-2">{m.member_no}</div>
          </div>
        </div>
      ),
    },
    { key: 'email', header: 'Contact', render: (m) => (
      <div>
        <div>{m.email || '—'}</div>
        {m.phone && <div className="text-xs text-muted-2">{m.phone}</div>}
      </div>
    ) },
    { key: 'role', header: 'Role', render: (m) => m.role_name ?? '—' },
    { key: 'status', header: 'Status', render: (m) => <StatusPill status={m.status} /> },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (m) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" icon="badge" onClick={() => setViewing(m.id)}>
            View
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon="login"
            onClick={() => setTarget(m)}
          >
            Impersonate
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="People" value={num(members.length)} icon="group" iconTone="green" />
        <StatTile label="Officers" value={num(officers.length)} icon="shield_person" iconTone="gold" />
        <StatTile label="Non-members" value={num(nonMembers.length)} icon="person_outline" iconTone="neutral" />
        <StatTile
          label="Cap"
          value={coop.member_cap ? `${num(members.length)} / ${num(coop.member_cap)}` : `${num(members.length)} · no limit`}
          icon="groups"
          iconTone="neutral"
        />
      </div>

      <Card padded={false}>
        <div className="border-b border-line px-5 py-3.5">
          <CardHeader
            title="Members"
            subtitle="Everyone with an account in this cooperative. Opening a profile and impersonating are both written to the audit log."
          />
          <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2">
            <Icon name="search" size={18} className="text-muted-2" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search name, member no., phone or email…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-2"
            />
          </div>
        </div>
        <QueryState isLoading={isLoading} isError={isError}>
          <Table
            columns={columns}
            rows={paged}
            rowKey={(m) => m.id}
            empty={
              <div className="text-sm text-muted">
                <p className="font-medium text-ink">No members yet.</p>
                <p className="mt-1">
                  Nobody can sign in to this cooperative, and it has no one to
                  notify at go-live. Add an officer from the console, or run{' '}
                  <span className="font-mono text-[12px]">
                    manage.py backfill_founding_admins
                  </span>{' '}
                  if it has a contact address on record.
                </p>
              </div>
            }
          />
          {filtered.length > MEMBERS_PAGE && (
            <Pagination page={page} pageSize={MEMBERS_PAGE} total={filtered.length} onPage={setPage} />
          )}
          {search && filtered.length === 0 && members.length > 0 && (
            <p className="px-5 py-4 text-sm text-muted">No one matches “{search}”.</p>
          )}
        </QueryState>
      </Card>

      <MemberProfileModal coop={coop} membershipId={viewing} onClose={() => setViewing(null)} />

      <ImpersonateMemberModal
        member={target}
        coop={coop}
        onClose={() => setTarget(null)}
      />
    </div>
  )
}

// ── A member's profile, for KYC and support checks ──────────────────────────
function MemberProfileModal({
  coop,
  membershipId,
  onClose,
}: {
  coop: Cooperative
  membershipId: number | null
  onClose: () => void
}) {
  const { data: m, isLoading, isError } = usePlatformMember(coop.id, membershipId)
  const { data: docs = [] } = usePlatformMemberDocuments(coop.id, membershipId)

  const sections: [string, [string, string][]][] = m
    ? [
        ['Membership', [
          ['Member no.', m.member_no],
          ['Type', m.kind === 'non_member' ? 'Non-member' : 'Member'],
          ['Role', m.role_name ?? 'Member'],
          ['Status', m.status],
          ['Joined', m.joined_at ? longDate(m.joined_at) : '—'],
          ['Share capital', naira(m.share_capital)],
          ['Savings balance', naira(m.savings_balance)],
        ]],
        ['Contact', [
          ['Email', m.email || '—'],
          ['Phone', m.phone || '—'],
          ['Address', m.address || '—'],
        ]],
        ['Personal (KYC)', [
          ['Date of birth', m.date_of_birth ? longDate(m.date_of_birth) : '—'],
          ['Gender', m.gender || '—'],
          ['Occupation', m.occupation || '—'],
          ['Next of kin', m.next_of_kin_name || '—'],
          ['Next of kin phone', m.next_of_kin_phone || '—'],
        ]],
        ['Bank (payout destination)', [
          ['Bank', m.bank_name || '—'],
          ['Account number', m.bank_account_no || '—'],
        ]],
      ]
    : []

  return (
    <Modal
      open={membershipId != null}
      onClose={onClose}
      width={620}
      title={m ? m.full_name : 'Member profile'}
      subtitle={`${coop.name} · viewing is recorded in the audit log`}
    >
      <QueryState isLoading={isLoading} isError={isError}>
        {m && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {m.photo ? (
                <img src={m.photo} alt="" className="size-16 rounded-full object-cover" />
              ) : (
                <Avatar name={m.full_name} size={64} />
              )}
              <div>
                <div className="font-display text-lg font-semibold text-ink">{m.full_name}</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <StatusPill status={m.status} />
                  {m.kind === 'non_member' && <Badge tone="blue">Non-member</Badge>}
                </div>
              </div>
            </div>

            {sections.map(([title, rows]) => (
              <div key={title}>
                <h4 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-2">{title}</h4>
                <div className="divide-y divide-line rounded-lg border border-line">
                  {rows.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 px-3.5 py-2 text-sm">
                      <span className="text-muted-2">{k}</span>
                      <span className="text-right text-ink-soft">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <h4 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-2">Documents</h4>
              <div className="divide-y divide-line rounded-lg border border-line">
                {docs.length === 0 && <p className="px-3.5 py-3 text-sm text-muted">No documents uploaded.</p>}
                {docs.map((d) => (
                  <a
                    key={d.id}
                    href={d.file}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 px-3.5 py-2.5 transition hover:bg-sand"
                  >
                    <Icon name="description" size={18} className="text-muted-2" />
                    <span className="flex-1 text-sm text-ink">{d.label || d.doc_type_display}</span>
                    <span className="text-xs text-muted-2">{d.doc_type_display} · {shortDate(d.created_at)}</span>
                    <Icon name="open_in_new" size={16} className="text-muted-2" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </QueryState>
    </Modal>
  )
}

function ImpersonateMemberModal({
  member,
  coop,
  onClose,
}: {
  member: Member | null
  coop: Cooperative
  onClose: () => void
}) {
  const impersonate = useImpersonate()
  const toast = useToast()
  const [consent, setConsent] = useState(false)

  useEffect(() => {
    if (member) setConsent(false)
  }, [member])

  async function start() {
    if (!member) return
    try {
      const res = await impersonate.mutateAsync({
        id: coop.id,
        membership: member.id,
      })
      session.startImpersonation({
        token: res.token,
        cooperativeId: res.cooperative_id,
        label: `Impersonating ${res.user.full_name} (${res.user.role}) at ${coop.name}`,
      })
      // An ordinary member has no console; opening one would land them on a
      // permission wall, so follow whichever surface the server says.
      window.location.assign(res.user.is_privileged ? '/console' : '/app')
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      toast(detail ?? 'Could not start impersonation', 'error')
    }
  }

  return (
    <Modal
      open={member != null}
      onClose={onClose}
      title="Impersonate with consent"
      subtitle={member ? `${member.full_name} · ${coop.name}` : undefined}
    >
      <div className="space-y-4">
        <p className="text-[13px] text-muted">
          You will be signed in as{' '}
          <span className="font-medium text-ink">{member?.full_name}</span>
          {member?.role_name ? ` (${member.role_name})` : ''} and taken to the
          surface they use. This is{' '}
          <span className="font-medium text-ink">recorded in the audit log</span>.
        </p>
        <label className="flex items-start gap-2.5 rounded-lg border border-line bg-paper px-3.5 py-3 text-[13px]">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 accent-green"
          />
          <span className="text-ink-soft">
            I confirm the cooperative has consented to this support session.
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            icon="login"
            disabled={!consent}
            loading={impersonate.isPending}
            onClick={start}
          >
            Start session
          </Button>
        </div>
      </div>
    </Modal>
  )
}


function SupportTab({ coop }: { coop: Cooperative }) {
  const { data: tickets = [] } = useSupportTickets(coop.id)
  const ticketCrud = useSupportTicketsCrud()
  const lifecycle = useCooperativeAction()
  const toast = useToast()
  const [ticketOpen, setTicketOpen] = useState(false)
  const [impersonateOpen, setImpersonateOpen] = useState(false)
  const [health, setHealth] = useState<CooperativeHealth | null>(null)
  const runHealth = useCooperativeHealthCheck()

  async function lifecycleAction(action: 'suspend' | 'reactivate' | 'offboard', label: string) {
    if (!window.confirm(`${label} ${coop.name}?`)) return
    try {
      await lifecycle.mutateAsync({ id: coop.id, action })
      toast(`${coop.name} ${action === 'reactivate' ? 'reactivated' : action + 'ed'}`)
    } catch (err) {
      toast(apiErrorMessage(err, 'Action failed'), 'error')
    }
  }

  async function runHealthCheck() {
    try {
      setHealth(await runHealth.mutateAsync(coop.id))
    } catch (err) {
      toast(apiErrorMessage(err, 'Health check failed'), 'error')
    }
  }

  async function closeTicket(t: SupportTicket) {
    try {
      await ticketCrud.action.mutateAsync({ id: t.id, action: 'close' })
      toast('Ticket closed')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not close ticket'), 'error')
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Support tickets */}
      <Card className="lg:col-span-2" padded={false}>
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h3 className="font-display text-[15px] font-semibold text-ink">Support tickets</h3>
            <p className="text-[13px] text-muted">{tickets.filter((t) => t.status !== 'closed').length} open</p>
          </div>
          <Button size="sm" icon="support_agent" onClick={() => setTicketOpen(true)}>Open ticket</Button>
        </div>
        <div className="divide-y divide-line">
          {tickets.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">No tickets for this cooperative.</p>}
          {tickets.map((t) => (
            <div key={t.id} className="flex items-start gap-3 px-5 py-3.5">
              <span className={`mt-0.5 flex size-8 items-center justify-center rounded-md ${
                t.priority === 'high' ? 'bg-danger-50 text-danger' : t.priority === 'low' ? 'bg-sand-deep text-muted' : 'bg-gold-50 text-gold-deep'
              }`}>
                <Icon name="confirmation_number" size={17} />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-ink">{t.subject}</span>
                  <Badge tone={t.status === 'closed' ? 'neutral' : t.status === 'in_progress' ? 'gold' : 'green'} dot>{t.status_display}</Badge>
                  <Badge tone={t.priority === 'high' ? 'danger' : 'neutral'}>{t.priority_display}</Badge>
                </div>
                {t.body && <p className="mt-0.5 text-[13px] text-muted">{t.body}</p>}
                <div className="mt-1 text-xs text-muted-2">
                  {t.created_by_name ?? '—'} · {dateTime(t.created_at)}
                </div>
              </div>
              {t.status !== 'closed' && (
                <Button size="sm" variant="ghost" onClick={() => closeTicket(t)}>Close</Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Data health check */}
      <Card>
        <CardHeader
          title="Data health check"
          subtitle="Read-only diagnostics across this tenant's records"
          action={<Button size="sm" variant="secondary" icon="fact_check" onClick={runHealthCheck} loading={runHealth.isPending}>Run check</Button>}
        />
        {!health && <p className="text-[13px] text-muted">Run a check to see live diagnostics.</p>}
        {health && (
          <div className="space-y-2">
            <div className="mb-2 flex items-center gap-2">
              <Badge tone={health.healthy ? 'green' : 'gold'} dot>{health.healthy ? 'Healthy' : 'Needs attention'}</Badge>
            </div>
            {health.checks.map((c) => (
              <div key={c.key} className="flex items-center gap-2.5 text-[13px]">
                <Icon name={c.ok ? 'check_circle' : 'error'} size={16} fill className={c.ok ? 'text-green-bright' : 'text-gold-deep'} />
                <span className="flex-1 text-ink-soft">{c.label}</span>
                <span className="text-xs text-muted-2">{c.detail}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Impersonation */}
      <Card>
        <CardHeader title="Impersonate with consent" subtitle="Open this cooperative's console as an official to reproduce an issue" />
        <p className="text-[13px] text-muted">
          Starts an audit-logged session as a privileged official. A banner lets you exit back to the platform.
        </p>
        <Button className="mt-3" size="sm" variant="secondary" icon="admin_panel_settings" onClick={() => setImpersonateOpen(true)}>
          Start impersonation
        </Button>
      </Card>

      {/* Lifecycle */}
      <Card className="lg:col-span-2">
        <div className="rounded-lg border border-danger-50 bg-danger-50/40 p-3.5">
          <div className="flex items-center gap-2 text-sm font-medium text-danger">
            <Icon name="gpp_maybe" size={18} /> Lifecycle — suspend or offboard this cooperative
          </div>
          <p className="mt-1 text-xs text-muted">
            Suspension freezes new activity; data is retained per NDPA policy. Offboarding closes the tenant (schedules a full export).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {coop.status === 'suspended' ? (
              <Button variant="secondary" size="sm" icon="play_circle" loading={lifecycle.isPending} onClick={() => lifecycleAction('reactivate', 'Reactivate')}>
                Reactivate
              </Button>
            ) : (
              <Button variant="secondary" size="sm" icon="pause_circle" loading={lifecycle.isPending} onClick={() => lifecycleAction('suspend', 'Suspend')}>
                Suspend
              </Button>
            )}
            <Button variant="danger" size="sm" icon="archive" loading={lifecycle.isPending} onClick={() => lifecycleAction('offboard', 'Offboard')}>
              Offboard
            </Button>
          </div>
        </div>
      </Card>

      <NewTicketModal open={ticketOpen} onClose={() => setTicketOpen(false)} coopId={coop.id} />
      <ImpersonateModal open={impersonateOpen} onClose={() => setImpersonateOpen(false)} coop={coop} />
    </div>
  )
}

function NewTicketModal({ open, onClose, coopId }: { open: boolean; onClose: () => void; coopId: number }) {
  const { create } = useSupportTicketsCrud()
  const toast = useToast()
  const [form, setForm] = useState({ subject: '', body: '', priority: 'normal' })

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await create.mutateAsync({ cooperative: coopId, subject: form.subject, body: form.body, priority: form.priority })
      toast('Ticket opened')
      onClose()
      setForm({ subject: '', body: '', priority: 'normal' })
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not open ticket'), 'error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Open support ticket" subtitle="Track an issue for this cooperative">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Subject">
          <input required value={form.subject} onChange={(e) => set('subject', e.target.value)} className="input" placeholder="Cannot reconcile June cycle" />
        </Field>
        <Field label="Details">
          <textarea rows={4} value={form.body} onChange={(e) => set('body', e.target.value)} className="input resize-none" placeholder="What's happening…" />
        </Field>
        <Field label="Priority">
          <Select
            value={form.priority}
            onChange={(e) => set('priority', e.target.value)}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'High' },
            ]}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={create.isPending}>Open ticket</Button>
        </div>
      </form>
    </Modal>
  )
}

function ImpersonateModal({ open, onClose, coop }: { open: boolean; onClose: () => void; coop: Cooperative }) {
  const impersonate = useImpersonate()
  const toast = useToast()
  const [consent, setConsent] = useState(false)

  async function start() {
    try {
      const res = await impersonate.mutateAsync({ id: coop.id })
      session.startImpersonation({
        token: res.token,
        cooperativeId: res.cooperative_id,
        label: `Impersonating ${res.user.full_name} (${res.user.role}) at ${coop.name}`,
      })
      // Full reload so AuthContext re-boots as the impersonated official.
      window.location.assign(res.user.is_privileged ? '/console' : '/app')
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast(detail ?? 'Could not start impersonation', 'error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Impersonate with consent" subtitle={coop.name}>
      <div className="space-y-4">
        <p className="text-[13px] text-muted">
          You will be signed in as a privileged official of <span className="font-medium text-ink">{coop.name}</span> and
          taken to their console. This action is <span className="font-medium text-ink">recorded in the audit log</span>.
          Use only with the cooperative's consent.
        </p>
        <label className="flex items-start gap-2.5 rounded-lg border border-line bg-paper px-3.5 py-3 text-[13px]">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-green" />
          <span className="text-ink-soft">I confirm the cooperative has consented to this support session.</span>
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" icon="login" disabled={!consent} loading={impersonate.isPending} onClick={start}>
            Start session
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function Detail({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-2">{label}</div>
      <div className="mt-1 flex items-center gap-2 text-sm font-medium capitalize text-ink">
        {swatch && <span className="size-4 rounded" style={{ background: swatch }} />}
        {value}
      </div>
    </div>
  )
}
