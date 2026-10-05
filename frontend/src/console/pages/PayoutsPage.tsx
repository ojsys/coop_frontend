import { useMemo, useState } from 'react'
import { usePayouts } from '@/api/hooks'
import { useRecheckPayout, useRecheckAllPayouts } from '@/api/mutations'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Badge, type Tone } from '@/ui/Badge'
import { Table, type Column } from '@/ui/Table'
import { QueryState } from '@/ui/QueryState'
import { StatTile } from '@/ui/StatTile'
import { naira, shortDate } from '@/lib/format'
import type { Payout } from '@/api/types'

type Tab = 'flight' | 'all'

/**
 * Money sent out, and whether it actually landed.
 *
 * This page exists because "sent" is not "settled". A payout is recorded as sent
 * when the payment provider *accepts* the transfer; the provider can still fail
 * or reverse it afterwards, and the webhook telling us so can be missed or
 * delayed. So anything in flight is genuinely unknown, and the officer needs a
 * way to ask — which is what Recheck does.
 *
 * The in-flight list is the default tab on purpose: it is the only one that
 * needs acting on.
 */
export function PayoutsPage() {
  const [tab, setTab] = useState<Tab>('flight')
  const { activeMembership } = useAuth()
  const canManage = activeMembership?.is_privileged ?? false
  const toast = useToast()

  const inFlight = usePayouts({ unsettled: true })
  const all = usePayouts()
  const recheckAll = useRecheckAllPayouts()

  const active = tab === 'flight' ? inFlight : all
  const flight = inFlight.data ?? []

  const flightValue = useMemo(
    () => flight.reduce((sum, p) => sum + Number(p.amount), 0),
    [flight],
  )
  const paidValue = useMemo(
    () =>
      (all.data ?? [])
        .filter((p) => p.status === 'success')
        .reduce((sum, p) => sum + Number(p.amount), 0),
    [all.data],
  )
  const failedCount = useMemo(
    () =>
      (all.data ?? []).filter(
        (p) => p.status === 'failed' || p.status === 'reversed',
      ).length,
    [all.data],
  )

  async function onRecheckAll() {
    try {
      const result = await recheckAll.mutateAsync()
      toast(result.detail)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not reach the payment provider'), 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Payouts"
        subtitle="Money sent to members and back to the society's own account"
        actions={
          canManage && flight.length > 0 ? (
            <Button
              size="sm"
              icon="sync"
              loading={recheckAll.isPending}
              onClick={onRecheckAll}
            >
              Recheck {flight.length} in flight
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatTile label="In flight" value={flight.length} icon="flight_takeoff" iconTone="gold" />
        <StatTile label="In flight · value" value={naira(flightValue)} icon="pending_actions" iconTone="gold" />
        <StatTile label="Paid out" value={naira(paidValue)} icon="payments" iconTone="green" />
        <StatTile label="Failed or reversed" value={failedCount} icon="error" iconTone={failedCount ? 'danger' : 'neutral'} />
      </div>

      {flight.length > 0 && (
        <Card className="mb-4">
          <div className="flex items-start gap-3">
            <Icon name="info" size={18} className="mt-0.5 text-gold-deep" />
            <div className="text-[13px] text-ink-soft">
              <span className="font-semibold text-ink">
                {flight.length} payout{flight.length === 1 ? '' : 's'} not yet
                confirmed by the provider.
              </span>{' '}
              A transfer being accepted is not the same as it arriving, and the
              provider's confirmation can be delayed or missed. Recheck asks it
              directly — safe to press more than once. If a transfer has failed,
              the money returns to the wallet and the loan goes back to approved.
            </div>
          </div>
        </Card>
      )}

      <Card padded={false}>
        <div className="flex items-center gap-1 border-b border-line p-3">
          <TabButton
            active={tab === 'flight'}
            onClick={() => setTab('flight')}
            label={`In flight${flight.length ? ` (${flight.length})` : ''}`}
          />
          <TabButton active={tab === 'all'} onClick={() => setTab('all')} label="All payouts" />
        </div>

        <QueryState isLoading={active.isLoading} isError={active.isError}>
          <PayoutTable rows={active.data ?? []} tab={tab} canManage={canManage} />
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

/**
 * Status tones are mapped here rather than using StatusPill.
 *
 * StatusPill's vocabulary does not cover payout statuses — `success`, `queued`
 * and `reversed` are all absent from its map and would fall back to neutral
 * grey, making a failed payout look exactly like a paid one. On a page about
 * whether money arrived, that is the one thing the colour has to get right.
 */
const STATUS_TONE: Record<Payout['status'], Tone> = {
  success: 'green',
  pending: 'gold',
  queued: 'gold',
  failed: 'danger',
  reversed: 'danger',
}

function PayoutTable({
  rows,
  tab,
  canManage,
}: {
  rows: Payout[]
  tab: Tab
  canManage: boolean
}) {
  const recheck = useRecheckPayout()
  const toast = useToast()
  const [busyId, setBusyId] = useState<number | null>(null)

  async function onRecheck(id: number) {
    setBusyId(id)
    try {
      const result = await recheck.mutateAsync(id)
      toast(result.detail)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not reach the payment provider'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const columns: Column<Payout>[] = [
    { key: 'date', header: 'Sent', render: (p) => shortDate(p.sent_at ?? p.created_at) },
    { key: 'kind', header: 'For', render: (p) => p.kind_display },
    {
      key: 'to',
      header: 'To',
      render: (p) => (
        <div className="min-w-0">
          <div className="truncate text-ink">
            {p.destination_account_name || p.destination_bank_name || '—'}
          </div>
          <div className="font-mono text-xs text-muted-2">
            {p.destination_bank_name} {p.destination_account_no}
          </div>
        </div>
      ),
    },
    {
      key: 'ref',
      header: 'Reference',
      render: (p) => <span className="font-mono text-xs text-muted">{p.reference}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <div>
          <Badge tone={STATUS_TONE[p.status]} dot>
            {p.status_display}
          </Badge>
          {p.failure_reason && (
            <div className="mt-0.5 max-w-[14rem] truncate text-xs text-danger" title={p.failure_reason}>
              {p.failure_reason}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'amt',
      header: 'Amount',
      align: 'right',
      render: (p) => <span className="font-mono tnum">{naira(p.amount)}</span>,
    },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (p) =>
        canManage && p.needs_recheck ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRecheck(p.id)
            }}
            disabled={busyId === p.id}
            className="text-xs font-medium text-green hover:underline disabled:opacity-50"
          >
            {busyId === p.id ? 'Checking…' : 'Recheck'}
          </button>
        ) : null,
    },
  ]

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(p) => p.id}
      empty={
        <span className="text-sm text-muted">
          {tab === 'flight'
            ? 'Nothing in flight — every payout has been confirmed by the provider.'
            : 'No payouts yet. Approving a loan pays it out from the disbursement wallet.'}
        </span>
      }
    />
  )
}
