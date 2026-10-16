import { useMemo, useState } from 'react'
import {
  useAccounts,
  useContributions,
  useContributionTypes,
  useInternalTransfers,
  useLedgerEntries,
  useMembers,
} from '@/api/hooks'
import {
  useRecordContribution,
  useRecordInternalTransfer,
  useReverseContribution,
} from '@/api/mutations'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { StatusPill, Badge } from '@/ui/Badge'
import { Table, type Column } from '@/ui/Table'
import { QueryState } from '@/ui/QueryState'
import { Modal } from '@/ui/Modal'
import { Field, Select } from '@/ui/Field'
import { MemberSearchSelect } from '@/ui/MemberSearchSelect'
import { ImmutableNotice } from '@/ui/ImmutableNotice'
import { StatTile } from '@/ui/StatTile'
import { naira, shortDate } from '@/lib/format'
import { downloadFile } from '@/lib/download'
import type { Contribution, InternalTransfer, LedgerEntry } from '@/api/types'

type Tab = 'ledger' | 'contributions' | 'transfers'

export function LedgerPage() {
  const [tab, setTab] = useState<Tab>('ledger')
  const [recordOpen, setRecordOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const entries = useLedgerEntries()
  const contributions = useContributions()
  const accounts = useAccounts()
  const transfers = useInternalTransfers()
  const { activeMembership } = useAuth()
  const canTransfer = activeMembership?.is_privileged ?? false
  const toast = useToast()

  async function exportCsv() {
    try {
      if (tab === 'contributions') {
        await downloadFile('/contributions/export/', 'contributions.csv')
      } else {
        await downloadFile('/ledger-entries/export/', 'ledger-entries.csv')
      }
    } catch (err) {
      toast(apiErrorMessage(err, 'Export failed'), 'error')
    }
  }

  const periodCollected = useMemo(
    () =>
      (contributions.data ?? [])
        .filter((c) => c.status === 'confirmed')
        .reduce((s, c) => s + Number(c.amount), 0),
    [contributions.data],
  )

  return (
    <div>
      <PageHeader
        title="Ledger & Contributions"
        subtitle="Append-only double-entry · balances are derived, never edited"
        actions={
          <>
            <Button variant="secondary" size="sm" icon="download" onClick={exportCsv}>
              Export {tab === 'contributions' ? 'contributions' : 'ledger'}
            </Button>
            {canTransfer && (
              <Button
                variant="secondary"
                size="sm"
                icon="swap_horiz"
                onClick={() => setTransferOpen(true)}
              >
                Record transfer
              </Button>
            )}
            <Button size="sm" icon="add" onClick={() => setRecordOpen(true)}>
              Record contribution
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile label="Collected · confirmed" value={naira(periodCollected)} icon="payments" iconTone="green" />
        <StatTile
          label="Accounts"
          value={accounts.data?.length ?? 0}
          icon="account_tree"
          iconTone="gold"
        />
        <StatTile
          label="Ledger entries"
          value={entries.data?.length ?? 0}
          icon="receipt_long"
          iconTone="neutral"
        />
      </div>

      <div className="mb-4">
        <ImmutableNotice />
      </div>

      <Card padded={false}>
        <div className="flex items-center gap-1 border-b border-line p-3">
          <TabButton active={tab === 'ledger'} onClick={() => setTab('ledger')} label="Ledger" />
          <TabButton active={tab === 'contributions'} onClick={() => setTab('contributions')} label="Contributions" />
          <TabButton active={tab === 'transfers'} onClick={() => setTab('transfers')} label="Transfers" />
        </div>

        {tab === 'ledger' && (
          <QueryState isLoading={entries.isLoading} isError={entries.isError}>
            <LedgerTable rows={entries.data ?? []} />
          </QueryState>
        )}
        {tab === 'contributions' && (
          <QueryState isLoading={contributions.isLoading} isError={contributions.isError}>
            <ContributionsTable rows={contributions.data ?? []} />
          </QueryState>
        )}
        {tab === 'transfers' && (
          <QueryState isLoading={transfers.isLoading} isError={transfers.isError}>
            <TransfersTable rows={transfers.data ?? []} />
          </QueryState>
        )}
      </Card>

      <RecordModal open={recordOpen} onClose={() => setRecordOpen(false)} />
      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} />
    </div>
  )
}

function TransfersTable({ rows }: { rows: InternalTransfer[] }) {
  const columns: Column<InternalTransfer>[] = [
    { key: 'date', header: 'Date', render: (t) => shortDate(t.occurred_at) },
    {
      key: 'from',
      header: 'Out of',
      render: (t) => (
        <span className="text-ink-soft">
          <span className="font-mono text-xs text-muted-2">{t.from_account_code}</span>{' '}
          {t.from_account_name}
        </span>
      ),
    },
    {
      key: 'to',
      header: 'Into',
      render: (t) => (
        <span className="text-ink-soft">
          <span className="font-mono text-xs text-muted-2">{t.to_account_code}</span>{' '}
          {t.to_account_name}
        </span>
      ),
    },
    { key: 'note', header: 'Note', render: (t) => t.note || <span className="text-faint">—</span> },
    {
      key: 'by',
      header: 'Recorded by',
      render: (t) => t.recorded_by_name ?? <span className="text-faint">—</span>,
    },
    {
      key: 'amt',
      header: 'Amount',
      align: 'right',
      render: (t) => <span className="font-mono tnum">{naira(t.amount)}</span>,
    },
  ]
  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(t) => t.id}
      empty={
        <span className="text-sm text-muted">
          No internal transfers recorded.
        </span>
      }
    />
  )
}

/**
 * Recording a transfer the officer has already made at the bank.
 *
 * This posts straight away rather than raising an approval, because both legs
 * are the cooperative's own accounts: the total it holds is unchanged and no
 * member's balance moves. Paying money *out* to a member is a withdrawal
 * instead, and that needs a second officer.
 */
function TransferModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const accounts = useAccounts()
  const record = useRecordInternalTransfer()
  const toast = useToast()
  const [form, setForm] = useState({ from_account: '', to_account: '', amount: '', occurred_at: '', note: '' })

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  // Only the cooperative's own asset accounts — cash, bank, PSP settlement.
  // The backend refuses anything else, but offering the choice at all would
  // invite an officer to try to move Member Funds and read an error instead.
  const assetAccounts = (accounts.data ?? []).filter((a) => a.kind === 'asset')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.from_account === form.to_account) {
      toast('Choose two different accounts', 'error')
      return
    }
    try {
      await record.mutateAsync({
        from_account: Number(form.from_account),
        to_account: Number(form.to_account),
        amount: form.amount,
        occurred_at: form.occurred_at || undefined,
        note: form.note || undefined,
      })
      toast('Transfer recorded & posted to ledger')
      onClose()
      setForm({ from_account: '', to_account: '', amount: '', occurred_at: '', note: '' })
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not record transfer'), 'error')
    }
  }

  const options = (placeholder: string) => [
    { value: '', label: placeholder },
    ...assetAccounts.map((a) => ({ value: String(a.id), label: `${a.code} · ${a.name}` })),
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record internal transfer"
      subtitle="Money moved between the cooperative's own accounts — posts immediately"
    >
      <form onSubmit={submit} className="space-y-3.5">
        <div className="rounded-lg bg-sand-deep px-3 py-2.5 text-xs text-muted">
          Use this after you have actually moved the money at the bank — for
          example banking the cash float. Paying a member their savings is a
          withdrawal instead, and needs a second officer's approval.
        </div>
        <Field label="Out of">
          <Select
            required
            value={form.from_account}
            onChange={(e) => set('from_account', e.target.value)}
            options={options(assetAccounts.length ? 'Select account…' : 'No asset accounts')}
          />
        </Field>
        <Field label="Into">
          <Select
            required
            value={form.to_account}
            onChange={(e) => set('to_account', e.target.value)}
            options={options(assetAccounts.length ? 'Select account…' : 'No asset accounts')}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₦)">
            <input
              required
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              className="input"
              placeholder="50000"
            />
          </Field>
          <Field label="Date it moved" hint="Defaults to now">
            <input
              type="date"
              value={form.occurred_at}
              onChange={(e) => set('occurred_at', e.target.value)}
              className="input"
            />
          </Field>
        </div>
        <Field label="Note">
          <input
            value={form.note}
            onChange={(e) => set('note', e.target.value)}
            className="input"
            placeholder="Banked the Friday cash float"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={record.isPending}>
            Record & post
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
        active ? 'bg-green-50 text-green' : 'text-muted hover:bg-sand-deep'
      }`}
    >
      {label}
    </button>
  )
}

function LedgerTable({ rows }: { rows: LedgerEntry[] }) {
  const columns: Column<LedgerEntry>[] = [
    { key: 'date', header: 'Date', render: (l) => shortDate(l.occurred_at) },
    {
      key: 'ref',
      header: 'Reference',
      render: (l) => <span className="font-mono text-xs text-muted">{l.reference}</span>,
    },
    { key: 'desc', header: 'Description', render: (l) => l.description },
    {
      key: 'acct',
      header: 'Account',
      render: (l) => (
        <span className="text-ink-soft">
          <span className="font-mono text-xs text-muted-2">{l.account_code}</span>{' '}
          {l.account_name}
        </span>
      ),
    },
    {
      key: 'dr',
      header: 'Debit',
      align: 'right',
      render: (l) =>
        Number(l.debit) ? <span className="font-mono tnum">{naira(l.debit)}</span> : <span className="text-faint">—</span>,
    },
    {
      key: 'cr',
      header: 'Credit',
      align: 'right',
      render: (l) =>
        Number(l.credit) ? <span className="font-mono tnum">{naira(l.credit)}</span> : <span className="text-faint">—</span>,
    },
  ]
  return (
    <Table columns={columns} rows={rows} rowKey={(l) => l.id} empty={<span className="text-sm text-muted">No ledger entries.</span>} />
  )
}

function ContributionsTable({ rows }: { rows: Contribution[] }) {
  const reverse = useReverseContribution()
  const toast = useToast()

  async function onReverse(id: number) {
    if (!confirm('Post a reversing entry for this contribution? The original stays for audit.')) return
    try {
      await reverse.mutateAsync(id)
      toast('Reversing entry posted')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not reverse'), 'error')
    }
  }

  const CHANNEL_ICON: Record<string, string> = { cash: 'payments', transfer: 'account_balance', psp: 'credit_card' }

  const columns: Column<Contribution>[] = [
    {
      key: 'member',
      header: 'Member',
      render: (c) => (
        <span className="font-mono text-xs text-muted-2">{c.member_no ?? `#${c.membership}`}</span>
      ),
    },
    { key: 'type', header: 'Type', render: (c) => c.type_name ?? `Type ${c.contribution_type}` },
    {
      key: 'channel',
      header: 'Channel',
      render: (c) => (
        <span className="flex items-center gap-1.5 text-ink-soft">
          <Icon name={CHANNEL_ICON[c.channel] ?? 'payments'} size={16} className="text-muted-2" />
          {c.channel}
        </span>
      ),
    },
    { key: 'date', header: 'Date', render: (c) => shortDate(c.occurred_at) },
    { key: 'status', header: 'Status', render: (c) => <StatusPill status={c.status} /> },
    {
      key: 'amt',
      header: 'Amount',
      align: 'right',
      render: (c) => <span className="font-mono tnum">{naira(c.amount)}</span>,
    },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (c) =>
        c.status === 'confirmed' ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onReverse(c.id)
            }}
            className="text-xs font-medium text-danger hover:underline"
          >
            Reverse
          </button>
        ) : (
          <Badge tone="neutral">{c.status}</Badge>
        ),
    },
  ]
  return (
    <Table columns={columns} rows={rows} rowKey={(c) => c.id} empty={<span className="text-sm text-muted">No contributions recorded.</span>} />
  )
}

function RecordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const members = useMembers()
  const types = useContributionTypes()
  const record = useRecordContribution()
  const toast = useToast()
  const [form, setForm] = useState({ membership: '', contribution_type: '', amount: '', channel: 'cash' })

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await record.mutateAsync({
        membership: Number(form.membership),
        contribution_type: Number(form.contribution_type),
        amount: form.amount,
        channel: form.channel as 'cash' | 'transfer' | 'psp',
      })
      toast('Contribution recorded & posted to ledger')
      onClose()
      setForm({ membership: '', contribution_type: '', amount: '', channel: 'cash' })
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not record contribution'), 'error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record contribution" subtitle="Posts a balanced journal to the ledger">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Member" interactive>
          <MemberSearchSelect required members={members.data ?? []} value={form.membership} onChange={(v) => set('membership', v)} />
        </Field>
        <Field label="Contribution type">
          <Select
            required
            value={form.contribution_type}
            onChange={(e) => set('contribution_type', e.target.value)}
            options={[
              { value: '', label: 'Select type…' },
              ...(types.data ?? []).map((t) => ({ value: String(t.id), label: t.name })),
            ]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₦)">
            <input required inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="input" placeholder="5000" />
          </Field>
          <Field label="Channel">
            <Select
              value={form.channel}
              onChange={(e) => set('channel', e.target.value)}
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'transfer', label: 'Bank transfer' },
                { value: 'psp', label: 'Payment provider' },
              ]}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={record.isPending}>
            Record & post
          </Button>
        </div>
      </form>
    </Modal>
  )
}
