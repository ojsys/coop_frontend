import { useState } from 'react'
import {
  REFERRALS_PAGE_SIZE,
  type CommissionRow,
  type PayoutRow,
  type PlatformReferrer,
  useDecidePayout,
  usePlatformCommissions,
  usePlatformPayouts,
  usePlatformReferralProgram,
  usePlatformReferrer,
  usePlatformReferrers,
  useReferrerAction,
  useSaveReferralProgram,
  useVoidCommission,
} from '@/api/referrals'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Badge, type Tone } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Modal } from '@/ui/Modal'
import { QueryState } from '@/ui/QueryState'
import { Pagination, Table, type Column } from '@/ui/Table'
import { CooperativeSearchSelect } from '@/ui/CooperativeSearchSelect'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { dateTime, naira, num, shortDate } from '@/lib/format'

/**
 * Refer and earn, from the platform's side: pay (or turn down) withdrawal
 * requests, look after referrers, void a commission whose payment was
 * refunded, and set the terms new referrals are made on. Payouts are made by
 * bank transfer outside the system and recorded here.
 */

type Tab = 'payouts' | 'referrers' | 'commissions' | 'program'

const TABS: { key: Tab; label: string }[] = [
  { key: 'payouts', label: 'Payout requests' },
  { key: 'referrers', label: 'Referrers' },
  { key: 'commissions', label: 'Commissions' },
  { key: 'program', label: 'Program' },
]

const PAYOUT_TONE: Record<PayoutRow['status'], Tone> = { requested: 'gold', paid: 'green', rejected: 'danger' }

export function ReferralsPage() {
  const [tab, setTab] = useState<Tab>('payouts')
  return (
    <div>
      <PageHeader title="Referrals" subtitle="People who bring cooperatives, what they've earned, and paying them." />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
              tab === t.key ? 'bg-green text-paper' : 'bg-sand-deep text-ink-soft hover:bg-sand'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'payouts' && <Payouts />}
      {tab === 'referrers' && <Referrers />}
      {tab === 'commissions' && <Commissions />}
      {tab === 'program' && <Program />}
    </div>
  )
}

// ── Payouts ─────────────────────────────────────────────────────────────────
function Payouts() {
  const [status, setStatus] = useState('requested')
  const [page, setPage] = useState(1)
  const [deciding, setDeciding] = useState<PayoutRow | null>(null)
  const { data, isLoading, isError } = usePlatformPayouts(status, page)

  const columns: Column<PayoutRow>[] = [
    {
      key: 'who',
      header: 'Referrer',
      render: (p) => (
        <div>
          <div className="font-medium text-ink">{p.referrer_name}</div>
          <div className="text-[12px] text-muted">{p.referrer_email}</div>
        </div>
      ),
    },
    {
      key: 'bank',
      header: 'Pay to',
      render: (p) => (
        <div className="text-[13px]">
          <div className="font-mono text-ink">{p.account_no}</div>
          <div className="text-[12px] text-muted">{p.bank_name} · {p.account_name}</div>
        </div>
      ),
    },
    { key: 'asked', header: 'Asked', render: (p) => <span className="text-[13px] text-muted">{dateTime(p.created_at)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <div>
          <Badge tone={PAYOUT_TONE[p.status]} dot>{p.status_display}</Badge>
          {(p.reference || p.note) && <div className="mt-0.5 text-[12px] text-muted">{p.reference || p.note}</div>}
        </div>
      ),
    },
    { key: 'amt', header: 'Amount', align: 'right', render: (p) => <span className="font-mono tnum">{naira(p.amount)}</span> },
  ]

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {[
          { key: 'requested', label: 'Waiting' },
          { key: 'paid', label: 'Paid' },
          { key: 'rejected', label: 'Rejected' },
          { key: '', label: 'All' },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              setStatus(f.key)
              setPage(1)
            }}
            className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
              status === f.key ? 'border-green bg-green-50 text-green' : 'border-line bg-paper text-ink-soft hover:bg-sand/60'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <Card padded={false}>
        <QueryState isLoading={isLoading} isError={isError} minHeight={200}>
          <Table
            columns={columns}
            rows={data?.results ?? []}
            rowKey={(p) => p.id}
            onRowClick={(p) => p.status === 'requested' && setDeciding(p)}
            empty={<span className="text-sm text-muted">Nothing here.</span>}
          />
          {(data?.count ?? 0) > REFERRALS_PAGE_SIZE && (
            <div className="border-t border-line px-4 py-3">
              <Pagination page={page} pageSize={REFERRALS_PAGE_SIZE} total={data?.count ?? 0} onPage={setPage} />
            </div>
          )}
        </QueryState>
      </Card>
      {deciding && <DecidePayout payout={deciding} onClose={() => setDeciding(null)} />}
    </>
  )
}

function DecidePayout({ payout, onClose }: { payout: PayoutRow; onClose: () => void }) {
  const toast = useToast()
  const decide = useDecidePayout()
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)

  async function act(decision: 'mark-paid' | 'reject') {
    try {
      await decide.mutateAsync({ id: payout.id, decision, reference, note })
      toast(decision === 'mark-paid' ? 'Marked paid — the referrer has been emailed' : 'Request rejected')
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not record that'), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title={`Pay ${naira(payout.amount)}`} subtitle={payout.referrer_name}>
      <div className="space-y-4">
        <div className="rounded-lg bg-sand/60 px-3.5 py-3 text-sm">
          <div className="font-mono text-[15px] text-ink">{payout.account_no}</div>
          <div className="text-muted">{payout.bank_name} · {payout.account_name}</div>
        </div>
        <p className="text-[13px] text-muted">
          Transfer the amount from the platform's bank account first, then record it here. The referrer is emailed
          when it is marked paid.
        </p>
        {rejecting ? (
          <Field label="Why it is being turned down" hint="The referrer sees this. The amount returns to their balance.">
            <input value={note} onChange={(e) => setNote(e.target.value)} className="input" autoFocus />
          </Field>
        ) : (
          <Field label="Transfer reference" hint="Optional, but it settles any question later.">
            <input value={reference} onChange={(e) => setReference(e.target.value)} className="input font-mono" />
          </Field>
        )}
        <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
          {rejecting ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>Back</Button>
              <Button variant="danger" size="sm" loading={decide.isPending} disabled={!note.trim()} onClick={() => act('reject')}>
                Reject request
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setRejecting(true)}>Reject…</Button>
              <Button size="sm" icon="check" loading={decide.isPending} onClick={() => act('mark-paid')}>
                I've paid it
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ── Referrers ───────────────────────────────────────────────────────────────
function Referrers() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<number | null>(null)
  const { data, isLoading, isError } = usePlatformReferrers(page, search)

  const columns: Column<PlatformReferrer>[] = [
    {
      key: 'who',
      header: 'Referrer',
      render: (r) => (
        <div>
          <div className="font-medium text-ink">{r.full_name}</div>
          <div className="text-[12px] text-muted">{r.email}</div>
        </div>
      ),
    },
    { key: 'code', header: 'Code', render: (r) => <span className="font-mono text-[13px]">{r.code}</span> },
    { key: 'count', header: 'Cooperatives', render: (r) => num(r.referral_count) },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge tone={r.status === 'active' ? 'green' : 'danger'} dot>{r.status === 'active' ? 'Active' : 'Suspended'}</Badge>,
    },
    { key: 'earned', header: 'Earned', align: 'right', render: (r) => <span className="font-mono tnum">{naira(r.earned)}</span> },
    { key: 'avail', header: 'Unpaid', align: 'right', render: (r) => <span className="font-mono tnum">{naira(r.totals.available)}</span> },
  ]

  return (
    <>
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
        placeholder="Search by name, email or code…"
        className="input mb-3 max-w-sm"
      />
      <Card padded={false}>
        <QueryState isLoading={isLoading} isError={isError} minHeight={200}>
          <Table
            columns={columns}
            rows={data?.results ?? []}
            rowKey={(r) => r.id}
            onRowClick={(r) => setViewing(r.id)}
            empty={<span className="text-sm text-muted">No referrers yet.</span>}
          />
          {(data?.count ?? 0) > REFERRALS_PAGE_SIZE && (
            <div className="border-t border-line px-4 py-3">
              <Pagination page={page} pageSize={REFERRALS_PAGE_SIZE} total={data?.count ?? 0} onPage={setPage} />
            </div>
          )}
        </QueryState>
      </Card>
      {viewing != null && <ReferrerDetail id={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

function ReferrerDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const toast = useToast()
  const { data: r, isLoading, isError } = usePlatformReferrer(id)
  const act = useReferrerAction()
  const [coopId, setCoopId] = useState<number | null>(null)

  async function run(verb: 'suspend' | 'reactivate' | 'attach') {
    try {
      await act.mutateAsync({ id, verb, cooperative: coopId ?? undefined })
      toast(verb === 'attach' ? 'Cooperative credited' : verb === 'suspend' ? 'Referrer suspended' : 'Referrer reactivated')
      setCoopId(null)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not do that'), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title={r?.full_name ?? 'Referrer'} subtitle={r ? `${r.email} · code ${r.code}` : undefined} width={720}>
      <QueryState isLoading={isLoading} isError={isError} minHeight={200}>
        {r && (
          <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Earned', r.totals.earned],
                ['Paid', r.totals.paid],
                ['Requested', r.totals.requested],
                ['Unpaid', r.totals.available],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line px-3 py-2">
                  <div className="font-mono text-[15px] font-semibold text-ink">{naira(value)}</div>
                  <div className="text-[12px] text-muted">{label}</div>
                </div>
              ))}
            </div>

            <div className="text-[13px] text-muted">
              Bank: {r.account_no ? `${r.bank_name} · ${r.account_no} · ${r.account_name}` : 'not added yet'}
              {r.phone && ` · Phone ${r.phone}`} · Joined {shortDate(r.created_at)}
            </div>

            <div className="rounded-lg border border-line">
              <Table
                columns={[
                  { key: 'c', header: 'Cooperative', render: (x) => x.cooperative_name },
                  { key: 's', header: 'Since', render: (x) => <span className="text-[13px] text-muted">{shortDate(x.created_at)}{x.source === 'platform' && ' · added by staff'}</span> },
                  { key: 't', header: 'Terms', render: (x) => <span className="text-[13px]">{Number(x.commission_percent)}% · {x.commission_months} mo</span> },
                  { key: 'e', header: 'Earned', align: 'right', render: (x) => <span className="font-mono tnum">{naira(x.earned)}</span> },
                ]}
                rows={r.referrals ?? []}
                rowKey={(x) => x.id}
                empty={<span className="text-sm text-muted">No cooperatives yet.</span>}
              />
            </div>

            <Field
              label="Credit a cooperative to this referrer"
              hint="For a society that signed up without the link. It earns on invoices paid from now on."
              interactive
            >
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-[240px] flex-1">
                  <CooperativeSearchSelect value={coopId} onChange={setCoopId} />
                </div>
                <Button size="sm" disabled={coopId == null} loading={act.isPending} onClick={() => run('attach')}>
                  Credit
                </Button>
              </div>
            </Field>

            <div className="flex justify-end border-t border-line pt-4">
              {r.status === 'active' ? (
                <Button variant="ghost" size="sm" icon="block" onClick={() => run('suspend')}>Suspend referrer</Button>
              ) : (
                <Button variant="secondary" size="sm" icon="check_circle" onClick={() => run('reactivate')}>Reactivate</Button>
              )}
            </div>
          </div>
        )}
      </QueryState>
    </Modal>
  )
}

// ── Commissions ─────────────────────────────────────────────────────────────
function Commissions() {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const { data, isLoading, isError } = usePlatformCommissions(page)
  const voidIt = useVoidCommission()
  const [voiding, setVoiding] = useState<CommissionRow | null>(null)
  const [reason, setReason] = useState('')

  async function confirmVoid() {
    if (!voiding) return
    try {
      await voidIt.mutateAsync({ id: voiding.id, reason })
      toast('Commission voided')
      setVoiding(null)
      setReason('')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not void it'), 'error')
    }
  }

  const columns: Column<CommissionRow>[] = [
    {
      key: 'coop',
      header: 'Cooperative',
      render: (c) => (
        <div>
          <div className={c.status === 'void' ? 'text-muted-2 line-through' : 'text-ink'}>{c.cooperative_name}</div>
          <div className="text-[12px] text-muted">{c.invoice_number} · paid {shortDate(c.paid_at)}{c.status === 'void' && ` · void: ${c.void_reason}`}</div>
        </div>
      ),
    },
    { key: 'ref', header: 'Referrer', render: (c) => c.referrer_name },
    { key: 'calc', header: 'Of', render: (c) => <span className="text-[13px] text-muted">{c.percent}% of {naira(c.invoice_amount)}</span> },
    { key: 'amt', header: 'Commission', align: 'right', render: (c) => <span className="font-mono tnum">{naira(c.amount)}</span> },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (c) =>
        c.status === 'earned' ? (
          <button type="button" className="text-[12px] font-medium text-danger hover:underline" onClick={() => setVoiding(c)}>
            Void
          </button>
        ) : null,
    },
  ]

  return (
    <>
      <Card padded={false}>
        <QueryState isLoading={isLoading} isError={isError} minHeight={200}>
          <Table columns={columns} rows={data?.results ?? []} rowKey={(c) => c.id} empty={<span className="text-sm text-muted">No commissions yet.</span>} />
          {(data?.count ?? 0) > REFERRALS_PAGE_SIZE && (
            <div className="border-t border-line px-4 py-3">
              <Pagination page={page} pageSize={REFERRALS_PAGE_SIZE} total={data?.count ?? 0} onPage={setPage} />
            </div>
          )}
        </QueryState>
      </Card>
      {voiding && (
        <Modal open onClose={() => setVoiding(null)} title={`Void ${naira(voiding.amount)}?`} subtitle={`${voiding.cooperative_name} · ${voiding.referrer_name}`}>
          <div className="space-y-4">
            <Field label="Reason" hint="For example, the payment behind it was refunded. The referrer sees this.">
              <input value={reason} onChange={(e) => setReason(e.target.value)} className="input" autoFocus />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setVoiding(null)}>Cancel</Button>
              <Button variant="danger" size="sm" disabled={!reason.trim()} loading={voidIt.isPending} onClick={confirmVoid}>Void commission</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Program ─────────────────────────────────────────────────────────────────
function Program() {
  const { data, isLoading, isError } = usePlatformReferralProgram()
  return (
    <Card>
      <QueryState isLoading={isLoading} isError={isError} minHeight={200}>
        {data && <ProgramForm key={data.updated_at} initial={data} />}
      </QueryState>
    </Card>
  )
}

function ProgramForm({ initial }: { initial: NonNullable<ReturnType<typeof usePlatformReferralProgram>['data']> }) {
  const toast = useToast()
  const save = useSaveReferralProgram()
  const [form, setForm] = useState({
    active: initial.active,
    commission_percent: String(Number(initial.commission_percent)),
    commission_months: String(initial.commission_months),
    minimum_payout: String(Number(initial.minimum_payout)),
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await save.mutateAsync({ ...form, commission_months: Number(form.commission_months) })
      toast('Program saved')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not save the program'), 'error')
    }
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4">
      <label className="flex items-start gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="mt-0.5 accent-green" />
        <span>
          Taking new referrers
          <span className="block text-[13px] text-muted">
            Off hides “Refer and earn” from the signup page and stops crediting new signups. Existing referrals keep
            earning on their terms.
          </span>
        </span>
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Commission %">
          <input required inputMode="decimal" value={form.commission_percent} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} className="input font-mono" />
        </Field>
        <Field label="For (months)">
          <input required inputMode="numeric" value={form.commission_months} onChange={(e) => setForm({ ...form, commission_months: e.target.value })} className="input font-mono" />
        </Field>
        <Field label="Minimum payout (₦)">
          <input required inputMode="decimal" value={form.minimum_payout} onChange={(e) => setForm({ ...form, minimum_payout: e.target.value })} className="input font-mono" />
        </Field>
      </div>
      <p className="text-[13px] text-muted">
        New terms apply to cooperatives that sign up from now on. Each existing referral keeps the terms it was made
        on.
      </p>
      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending}>Save</Button>
      </div>
    </form>
  )
}
