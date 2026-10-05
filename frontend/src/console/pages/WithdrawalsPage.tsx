import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWithdrawals } from '@/api/hooks'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { StatusPill } from '@/ui/Badge'
import { Table, type Column } from '@/ui/Table'
import { QueryState } from '@/ui/QueryState'
import { StatTile } from '@/ui/StatTile'
import { naira, shortDate } from '@/lib/format'
import type { Withdrawal } from '@/api/types'

type Tab = 'pending' | 'all'

/**
 * Every member savings payout in one place.
 *
 * This exists because withdrawals were previously only visible inside each
 * member's own detail page, so an officer had no way to see what the
 * cooperative owed or what was waiting on them without opening members one by
 * one.
 *
 * The "awaiting approval" list is fetched with the backend's own `unpaid`
 * filter rather than filtered here, because /withdrawals/ paginates at 25: a
 * client-side filter over one page would quietly miss pending requests once a
 * society has more than 25 payouts on record, which is precisely the view that
 * must not be wrong.
 *
 * There is deliberately no "new payout" form on this page. Starting one needs a
 * member, and a member picker here would either be capped at the same 25 rows
 * (hiding members) or have to load every member — and MembershipSerializer
 * computes savings_balance per row from the ledger, so that is roughly two
 * queries per member on every open. Paying out is instead started from the
 * member's own page, where their balance and bank details are already in view.
 */
export function WithdrawalsPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const navigate = useNavigate()
  const { activeMembership } = useAuth()
  const canPayOut = activeMembership?.is_privileged ?? false

  const pending = useWithdrawals({ unpaid: true })
  const all = useWithdrawals()

  const active = tab === 'pending' ? pending : all

  const pendingTotal = useMemo(
    () => (pending.data ?? []).reduce((s, w) => s + Number(w.amount), 0),
    [pending.data],
  )
  const paidTotal = useMemo(
    () =>
      (all.data ?? [])
        .filter((w) => w.is_paid)
        .reduce((s, w) => s + Number(w.amount), 0),
    [all.data],
  )

  return (
    <div>
      <PageHeader
        title="Withdrawals"
        subtitle="Member savings paid out · each payout needs a second officer's approval"
        actions={
          canPayOut ? (
            <Button size="sm" icon="group" onClick={() => navigate('/console/members')}>
              Pay out a member
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Awaiting approval"
          value={pending.data?.length ?? 0}
          icon="hourglass_top"
          iconTone="gold"
        />
        <StatTile label="Awaiting approval · value" value={naira(pendingTotal)} icon="pending_actions" iconTone="gold" />
        <StatTile label="Paid out" value={naira(paidTotal)} icon="payments" iconTone="green" />
      </div>

      {(pending.data?.length ?? 0) > 0 && (
        <Card className="mb-4">
          <div className="flex items-start gap-3">
            <Icon name="fact_check" size={18} className="mt-0.5 text-gold-deep" />
            <div className="text-[13px] text-ink-soft">
              <span className="font-semibold text-ink">
                {pending.data?.length} payout{pending.data?.length === 1 ? '' : 's'} waiting on approval.
              </span>{' '}
              Nothing has left the cooperative yet — a payout posts to the ledger
              only when an officer other than the one who requested it approves
              it under{' '}
              <button
                onClick={() => navigate('/console/approvals')}
                className="font-medium text-green underline"
              >
                Approvals
              </button>
              .
            </div>
          </div>
        </Card>
      )}

      <Card padded={false}>
        <div className="flex items-center gap-1 border-b border-line p-3">
          <TabButton
            active={tab === 'pending'}
            onClick={() => setTab('pending')}
            label={`Awaiting approval${pending.data?.length ? ` (${pending.data.length})` : ''}`}
          />
          <TabButton active={tab === 'all'} onClick={() => setTab('all')} label="All withdrawals" />
        </div>

        <QueryState isLoading={active.isLoading} isError={active.isError}>
          <WithdrawalsTable
            rows={active.data ?? []}
            tab={tab}
            onOpenMember={(id) => navigate(`/console/members/${id}`)}
          />
        </QueryState>
      </Card>
    </div>
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

function WithdrawalsTable({
  rows,
  tab,
  onOpenMember,
}: {
  rows: Withdrawal[]
  tab: Tab
  onOpenMember: (membershipId: number) => void
}) {
  const columns: Column<Withdrawal>[] = [
    {
      key: 'member',
      header: 'Member',
      render: (w) => (
        <button
          onClick={() => onOpenMember(w.membership)}
          className="text-left hover:underline"
        >
          <span className="block font-medium text-ink">{w.member_name}</span>
          <span className="font-mono text-xs text-muted-2">{w.member_no}</span>
        </button>
      ),
    },
    { key: 'requested', header: 'Requested', render: (w) => shortDate(w.created_at) },
    {
      key: 'channel',
      header: 'Paid by',
      render: (w) => (
        <span className="flex items-center gap-1.5 text-ink-soft">
          <Icon
            name={w.channel === 'cash' ? 'payments' : 'account_balance'}
            size={16}
            className="text-muted-2"
          />
          {w.channel_display}
        </span>
      ),
    },
    {
      key: 'destination',
      header: 'Destination',
      render: (w) =>
        w.channel === 'transfer' ? (
          <span className="text-ink-soft">
            {w.destination_bank_name || '—'}{' '}
            <span className="font-mono text-xs text-muted-2">{w.destination_account_no}</span>
          </span>
        ) : (
          <span className="text-muted">Collected in cash</span>
        ),
    },
    {
      key: 'by',
      header: 'Requested by',
      render: (w) => w.requested_by_name ?? <span className="text-faint">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (w) => <StatusPill status={w.is_paid ? 'paid' : 'pending'} />,
    },
    {
      key: 'amt',
      header: 'Amount',
      align: 'right',
      render: (w) => <span className="font-mono tnum">{naira(w.amount)}</span>,
    },
  ]

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(w) => w.id}
      empty={
        <span className="text-sm text-muted">
          {tab === 'pending'
            ? 'No payouts are waiting on approval.'
            : 'No withdrawals recorded yet. Open a member to pay out their savings.'}
        </span>
      }
    />
  )
}
