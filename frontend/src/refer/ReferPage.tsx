import { useState, type ReactNode } from 'react'
import {
  type BankDetails,
  type CommissionRow,
  type PayoutRow,
  type ReferralRow,
  type ReferrerDashboard,
  useBecomeReferrer,
  useReferrerDashboard,
  useRequestReferralPayout,
  useSaveReferrerBank,
} from '@/api/referrals'
import { useAuth } from '@/auth/AuthContext'
import { SidebarShell, type NavItem } from '@/ui/SidebarShell'
import { PageHeader } from '@/ui/PageHeader'
import { Card, CardHeader } from '@/ui/Card'
import { StatTile } from '@/ui/StatTile'
import { Badge, type Tone } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Icon } from '@/ui/Icon'
import { Modal } from '@/ui/Modal'
import { QueryState } from '@/ui/QueryState'
import { Table, type Column } from '@/ui/Table'
import { BankSelect } from '@/ui/BankSelect'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { longDate, naira, num, shortDate } from '@/lib/format'

/**
 * Refer and earn: a referrer's link, what it has earned, and asking to be
 * paid. Open to every signed-in account — someone who signed up only to
 * refer lands here; a member or officer reaches it from their own surface and
 * turns referrals on with one click.
 */

const PAYOUT_TONE: Record<PayoutRow['status'], Tone> = {
  requested: 'gold',
  paid: 'green',
  rejected: 'danger',
}

const SUBSCRIPTION_LABEL: Record<string, { label: string; tone: Tone }> = {
  trial: { label: 'Free trial', tone: 'neutral' },
  active: { label: 'Paying', tone: 'green' },
  past_due: { label: 'Payment due', tone: 'gold' },
  canceled: { label: 'Cancelled', tone: 'danger' },
}

export function ReferRoutes() {
  const { user } = useAuth()
  const nav: NavItem[] = [{ to: '/refer', label: 'Refer & earn', icon: 'campaign', end: true }]
  if (user?.memberships.some((m) => m.is_officer)) nav.push({ to: '/console', label: 'Admin console', icon: 'dashboard' })
  if (user?.memberships.length) nav.push({ to: '/app', label: 'Member app', icon: 'smartphone' })

  return (
    <SidebarShell brandSubtitle="Refer & earn" sectionLabel="Refer & earn" nav={nav}>
      <ReferPage />
    </SidebarShell>
  )
}

function ReferPage() {
  const { data, isLoading, isError } = useReferrerDashboard()
  return (
    <div>
      <PageHeader
        title="Refer & earn"
        subtitle="Bring cooperatives to the platform and earn a share of what they pay."
      />
      <QueryState isLoading={isLoading} isError={isError} minHeight={240}>
        {data === null ? <TurnOn /> : data ? <Dashboard data={data} /> : null}
      </QueryState>
    </div>
  )
}

function TurnOn() {
  const toast = useToast()
  const become = useBecomeReferrer()
  const { refresh } = useAuth()

  async function start() {
    try {
      await become.mutateAsync()
      await refresh()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not turn referrals on'), 'error')
    }
  }

  return (
    <Card>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green">
          <Icon name="campaign" size={22} />
        </span>
        <div className="flex-1">
          <div className="font-display text-[17px] font-semibold text-ink">Get your referral link</div>
          <p className="mt-1 text-sm text-muted">
            Share it with cooperatives you know. When one signs up through it and starts paying, you earn a
            share of every payment it makes.
          </p>
        </div>
        <Button icon="link" loading={become.isPending} onClick={start}>Get my link</Button>
      </div>
    </Card>
  )
}

function Dashboard({ data }: { data: ReferrerDashboard }) {
  const [asking, setAsking] = useState(false)
  const [editingBank, setEditingBank] = useState(false)
  const { program, totals } = data
  const percent = Number(program.commission_percent)
  const available = Number(totals.available)
  const canAsk = data.status === 'active' && available >= Number(program.minimum_payout)

  return (
    <div className="space-y-4">
      {data.status === 'suspended' && (
        <div className="flex items-start gap-2 rounded-lg bg-danger-50 px-3.5 py-2.5 text-sm text-danger">
          <Icon name="block" size={18} className="mt-px shrink-0" />
          This referral account is suspended. Contact support to find out why.
        </div>
      )}

      <ShareCard data={data} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Available to withdraw" value={naira(totals.available)} icon="account_balance_wallet" />
        <StatTile label="Earned so far" value={naira(totals.earned)} icon="trending_up" iconTone="gold" />
        <StatTile
          label="Paid to you"
          value={naira(totals.paid)}
          icon="payments"
          iconTone="neutral"
          foot={Number(totals.requested) > 0 ? `${naira(totals.requested)} on its way` : undefined}
        />
        <StatTile label="Cooperatives referred" value={num(data.referrals.length)} icon="apartment" iconTone="neutral" />
      </div>

      <Card>
        <CardHeader
          title="Get paid"
          subtitle={`Ask for your balance once it reaches ${naira(program.minimum_payout)}. We pay it to your bank account.`}
          action={
            <Button size="sm" icon="send_money" disabled={!canAsk} onClick={() => (data.has_bank_details ? setAsking(true) : setEditingBank(true))}>
              Withdraw
            </Button>
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sand/60 px-3.5 py-2.5 text-sm">
          {data.has_bank_details ? (
            <span className="text-ink-soft">
              <Icon name="account_balance" size={16} className="mr-1.5 align-[-3px] text-muted" />
              {data.bank.bank_name} · {data.bank.account_no} · {data.bank.account_name}
            </span>
          ) : (
            <span className="text-muted">Add the bank account we should pay.</span>
          )}
          <button type="button" className="text-[13px] font-medium text-green hover:underline" onClick={() => setEditingBank(true)}>
            {data.has_bank_details ? 'Change' : 'Add bank account'}
          </button>
        </div>
      </Card>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Your cooperatives"
            subtitle={`You earn ${percent}% of each payment for ${program.commission_months} months from its first.`}
          />
        </div>
        <ReferralsTable rows={data.referrals} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5"><CardHeader title="Earnings" /></div>
          <CommissionsTable rows={data.commissions} />
        </Card>
        <Card padded={false}>
          <div className="px-5 pt-5"><CardHeader title="Withdrawals" /></div>
          <PayoutsTable rows={data.payouts} />
        </Card>
      </div>

      {asking && <WithdrawModal data={data} onClose={() => setAsking(false)} />}
      {editingBank && <BankModal bank={data.bank} onClose={() => setEditingBank(false)} />}
    </div>
  )
}

function ShareCard({ data }: { data: ReferrerDashboard }) {
  const toast = useToast()
  const percent = Number(data.program.commission_percent)
  const message =
    `Run a cooperative? Put your savings, loans and records on one platform — free for the first month. ` +
    `Sign up here: ${data.link}`

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast(`${what} copied`)
    } catch {
      toast('Could not copy — select it and copy instead', 'error')
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[13px] text-muted">Your referral link</div>
          <div className="mt-1 break-all font-mono text-[15px] text-ink">{data.link}</div>
          <div className="mt-1 text-[13px] text-muted">
            Code <span className="font-mono font-semibold text-ink">{data.code}</span> · earn {percent}% of every
            payment for {data.program.commission_months} months
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon="content_copy" onClick={() => copy(data.link, 'Link')}>Copy link</Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-green px-3 py-1.5 text-[13px] font-semibold text-paper transition hover:bg-green-bright"
          >
            <Icon name="share" size={16} /> Share on WhatsApp
          </a>
        </div>
      </div>
    </Card>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <span className="text-sm text-muted">{children}</span>
}

function ReferralsTable({ rows }: { rows: ReferralRow[] }) {
  const columns: Column<ReferralRow>[] = [
    {
      key: 'coop',
      header: 'Cooperative',
      render: (r) => (
        <div>
          <div className="font-medium text-ink">{r.cooperative_name}</div>
          <div className="text-[12px] text-muted">Joined {shortDate(r.created_at)}{r.cooperative_state && ` · ${r.cooperative_state}`}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const s = SUBSCRIPTION_LABEL[r.subscription_status]
        return s ? <Badge tone={s.tone} dot>{s.label}</Badge> : <span className="text-muted-2">—</span>
      },
    },
    {
      key: 'window',
      header: 'Earning until',
      render: (r) => (
        <span className="text-[13px] text-muted">{r.window_ends_on ? longDate(r.window_ends_on) : 'Starts at first payment'}</span>
      ),
    },
    { key: 'earned', header: 'Earned', align: 'right', render: (r) => <span className="font-mono tnum">{naira(r.earned)}</span> },
  ]
  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      empty={<Empty>No cooperatives yet. Share your link to get started.</Empty>}
    />
  )
}

function CommissionsTable({ rows }: { rows: CommissionRow[] }) {
  const columns: Column<CommissionRow>[] = [
    {
      key: 'coop',
      header: 'From',
      render: (c) => (
        <div>
          <div className={c.status === 'void' ? 'text-muted-2 line-through' : 'text-ink'}>{c.cooperative_name}</div>
          <div className="text-[12px] text-muted">
            {c.percent}% of {naira(c.invoice_amount)} · {shortDate(c.paid_at ?? c.created_at)}
            {c.status === 'void' && ` · voided: ${c.void_reason}`}
          </div>
        </div>
      ),
    },
    { key: 'amt', header: 'Earned', align: 'right', render: (c) => <span className="font-mono tnum">{naira(c.amount)}</span> },
  ]
  return <Table columns={columns} rows={rows} rowKey={(c) => c.id} empty={<Empty>Nothing earned yet.</Empty>} />
}

function PayoutsTable({ rows }: { rows: PayoutRow[] }) {
  const columns: Column<PayoutRow>[] = [
    {
      key: 'when',
      header: 'Asked',
      render: (p) => (
        <div>
          <div className="text-ink">{shortDate(p.created_at)}</div>
          <div className="text-[12px] text-muted">
            {p.bank_name} · {p.account_no}
            {p.status === 'rejected' && p.note && ` · ${p.note}`}
          </div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (p) => <Badge tone={PAYOUT_TONE[p.status]} dot>{p.status_display}</Badge> },
    { key: 'amt', header: 'Amount', align: 'right', render: (p) => <span className="font-mono tnum">{naira(p.amount)}</span> },
  ]
  return <Table columns={columns} rows={rows} rowKey={(p) => p.id} empty={<Empty>No withdrawals yet.</Empty>} />
}

function WithdrawModal({ data, onClose }: { data: ReferrerDashboard; onClose: () => void }) {
  const toast = useToast()
  const request = useRequestReferralPayout()
  const [amount, setAmount] = useState(String(Number(data.totals.available)))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await request.mutateAsync(amount)
      toast('Withdrawal requested — we’ll email you when it’s paid')
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not request the withdrawal'), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title="Withdraw" subtitle={`Up to ${naira(data.totals.available)} is available.`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Amount (₦)" hint={`At least ${naira(data.program.minimum_payout)}.`}>
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            className="input font-mono"
          />
        </Field>
        <p className="rounded-lg bg-sand/60 px-3 py-2 text-[13px] text-ink-soft">
          Paid to {data.bank.bank_name} · {data.bank.account_no} · {data.bank.account_name}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" icon="send_money" loading={request.isPending}>Request withdrawal</Button>
        </div>
      </form>
    </Modal>
  )
}

function BankModal({ bank, onClose }: { bank: BankDetails; onClose: () => void }) {
  const toast = useToast()
  const save = useSaveReferrerBank()
  const [form, setForm] = useState<BankDetails>(bank)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await save.mutateAsync(form)
      toast('Bank account saved')
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not save the bank account'), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title="Where should we pay you?">
      <form onSubmit={submit} className="space-y-4">
        <BankSelect
          required
          name={form.bank_name}
          code={form.bank_code}
          onChange={(b) => setForm({ ...form, ...b })}
        />
        <Field label="Account number">
          <input
            required
            inputMode="numeric"
            maxLength={10}
            value={form.account_no}
            onChange={(e) => setForm({ ...form, account_no: e.target.value.replace(/\D/g, '') })}
            className="input font-mono"
          />
        </Field>
        <Field label="Account name" hint="As your bank shows it.">
          <input
            required
            value={form.account_name}
            onChange={(e) => setForm({ ...form, account_name: e.target.value })}
            className="input"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}
