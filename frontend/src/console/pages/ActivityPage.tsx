import { useState } from 'react'
import { useCooperativeActivity } from '@/api/hooks'
import { PageHeader } from '@/ui/PageHeader'
import { Card, CardHeader } from '@/ui/Card'
import { StatTile } from '@/ui/StatTile'
import { QueryState } from '@/ui/QueryState'
import { EmptyState } from '@/ui/EmptyState'
import { Icon } from '@/ui/Icon'
import { Table, type Column } from '@/ui/Table'
import { TrendArea, BarSeries } from '@/ui/Charts'
import { dateTime, naira, num } from '@/lib/format'
import type { ActivityEvent } from '@/api/types'

const WINDOWS = [7, 30, 90] as const

type Contributor = {
  member_no: string
  name: string
  count: number
  total: string
}

/**
 * Activity inside this cooperative.
 *
 * The tenant-scoped twin of the platform's Site Activity page: the server
 * filters every query to the active cooperative, so an officer sees their own
 * society's record and nobody else's.
 */
export function ActivityPage() {
  const [days, setDays] = useState<number>(30)
  const { data, isLoading, isError } = useCooperativeActivity(days)
  const t = data?.totals

  const columns: Column<Contributor>[] = [
    {
      key: 'member',
      header: 'Member',
      render: (c) => (
        <div>
          <div className="font-medium text-ink">{c.name}</div>
          <div className="font-mono text-xs text-muted-2">{c.member_no}</div>
        </div>
      ),
    },
    {
      key: 'count',
      header: 'Payments',
      align: 'right',
      render: (c) => <span className="font-mono tnum">{num(c.count)}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (c) => <span className="font-mono tnum">{naira(c.total)}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Activity"
        subtitle="What has happened in this cooperative, straight from the audit trail"
        actions={
          <div className="flex items-center gap-1 rounded-md bg-sand-deep p-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setDays(w)}
                className={`rounded px-3 py-1 text-[13px] font-medium transition ${
                  days === w ? 'bg-card text-ink shadow-soft' : 'text-muted hover:text-ink'
                }`}
              >
                {w}d
              </button>
            ))}
          </div>
        }
      />

      <QueryState isLoading={isLoading} isError={isError}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Recorded events"
            value={num(t?.audit_events ?? 0)}
            icon="timeline"
            iconTone="green"
            foot={`last ${data?.window_days ?? days} days`}
          />
          <StatTile
            label="Contributions"
            value={naira(t?.contributions_value ?? 0, { compact: true })}
            icon="savings"
            iconTone="green"
            foot={`${num(t?.contributions ?? 0)} recorded`}
          />
          <StatTile
            label="New members"
            value={num(t?.new_members ?? 0)}
            icon="group"
            iconTone="gold"
          />
          <StatTile
            label="Join requests"
            value={num(t?.join_requests ?? 0)}
            icon="person_add"
            iconTone="gold"
            foot={`${num(t?.join_requests_pending ?? 0)} awaiting a decision`}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Activity per day" subtitle="Events recorded each day" />
            <TrendArea data={data?.daily ?? []} xKey="day" yKey="events" format="count" />
          </Card>
          <Card>
            <CardHeader title="Collected per day" subtitle="Confirmed contributions · ₦" />
            <BarSeries
              data={data?.daily ?? []}
              xKey="day"
              yKey="value"
              format="naira"
              highlightLast
            />
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2" padded={false}>
            <div className="border-b border-line px-4 py-3">
              <div className="font-display text-[15px] font-semibold text-ink">
                Most active contributors
              </div>
              <div className="text-[13px] text-muted">By confirmed value in this window</div>
            </div>
            <Table
              columns={columns}
              rows={data?.top_contributors ?? []}
              rowKey={(c) => c.member_no}
              empty={<span className="text-sm text-muted">No contributions in this window.</span>}
            />
          </Card>

          <Card>
            <CardHeader title="What was touched" subtitle="events by record type" />
            {(data?.by_entity ?? []).length === 0 ? (
              <p className="py-2 text-[13px] text-muted">Nothing recorded in this window.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {(data?.by_entity ?? []).map((e) => (
                  <div key={e.entity} className="flex items-center justify-between">
                    <span className="text-ink-soft">{e.entity}</span>
                    <span className="font-mono text-muted tnum">{num(e.count)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="mt-4" padded={false}>
          <div className="border-b border-line px-4 py-3">
            <div className="font-display text-[15px] font-semibold text-ink">Recent events</div>
            <div className="text-[13px] text-muted">
              The immutable audit trail — newest first
            </div>
          </div>
          <Feed rows={data?.feed ?? []} />
        </Card>
      </QueryState>
    </div>
  )
}

function Feed({ rows }: { rows: ActivityEvent[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="timeline"
        title="Nothing recorded yet"
        hint="Recording a payment, admitting a member or opening a resolution will appear here."
      />
    )
  }
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id} className="flex items-start gap-3 px-4 py-2.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-sand-deep text-muted-2">
            <Icon name="bolt" size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] text-ink">{r.action}</div>
            <div className="truncate text-xs text-muted-2">
              {r.actor}
              {r.entity ? ` · ${r.entity}` : ''}
            </div>
          </div>
          <span className="shrink-0 font-mono text-xs text-muted-2">{dateTime(r.created_at)}</span>
        </li>
      ))}
    </ul>
  )
}
