import { useState } from 'react'
import { usePlatformSiteActivity } from '@/api/hooks'
import { PageHeader } from '@/ui/PageHeader'
import { Card, CardHeader } from '@/ui/Card'
import { StatTile } from '@/ui/StatTile'
import { QueryState } from '@/ui/QueryState'
import { EmptyState } from '@/ui/EmptyState'
import { Icon } from '@/ui/Icon'
import { Badge } from '@/ui/Badge'
import { TrendArea, BarSeries } from '@/ui/Charts'
import { dateTime, naira, num } from '@/lib/format'
import type { ActivityEvent } from '@/api/types'

const WINDOWS = [7, 30, 90] as const

/**
 * Site activity — what has actually happened, from our own records.
 *
 * Deliberately *not* Google Analytics. GA measures visits to the public pages;
 * this measures the things the platform did: cooperatives provisioned, members
 * admitted, money recorded, requests decided. The two answer different
 * questions, and this one needs no third party to be true.
 */
export function SiteActivityPage() {
  const [days, setDays] = useState<number>(30)
  const { data, isLoading, isError } = usePlatformSiteActivity(days)
  const t = data?.totals

  return (
    <div>
      <PageHeader
        title="Site Activity"
        subtitle="First-party record of what happened across the platform — no third party involved"
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
            label="New cooperatives"
            value={num(t?.new_cooperatives ?? 0)}
            icon="apartment"
            iconTone="gold"
            foot={`${num(t?.onboarding_started ?? 0)} entered onboarding`}
          />
          <StatTile
            label="New members"
            value={num(t?.new_members ?? 0)}
            icon="group"
            iconTone="green"
          />
          <StatTile
            label="Contributions"
            value={naira(t?.contributions_value ?? 0, { compact: true })}
            icon="savings"
            iconTone="green"
            foot={`${num(t?.contributions ?? 0)} recorded`}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Activity per day"
              subtitle="Audit events recorded each day"
            />
            <TrendArea data={data?.daily ?? []} xKey="day" yKey="events" format="count" />
          </Card>

          <Card>
            <CardHeader
              title="Contributions per day"
              subtitle="Payments recorded each day"
            />
            <BarSeries
              data={data?.daily ?? []}
              xKey="day"
              yKey="contributions"
              format="count"
              highlightLast
            />
          </Card>

          <Card>
            <CardHeader
              title="New cooperatives"
              subtitle="per month — same figures as B2B Analytics"
            />
            <BarSeries
              data={data?.growth_trend ?? []}
              xKey="month"
              yKey="new_coops"
              format="count"
            />
          </Card>

          <Card>
            <CardHeader
              title="Activation funnel"
              subtitle="provisioned → first contribution → first reconciled cycle"
            />
            <div className="space-y-2.5 pt-1">
              {(data?.activation_funnel ?? []).map((s) => {
                const top = data?.activation_funnel?.[0]?.count || 1
                return (
                  <div key={s.stage}>
                    <div className="mb-1 flex items-center justify-between text-[13px]">
                      <span className="text-ink-soft">{s.stage}</span>
                      <span className="font-mono text-muted tnum">{num(s.count)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-sand-deep">
                      <div
                        className="h-full rounded-full bg-green"
                        style={{ width: `${Math.min(100, (s.count / top) * 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader title="Join requests" subtitle={`last ${data?.window_days ?? days} days`} />
            <div className="space-y-2 text-sm">
              <Row label="Received" value={num(t?.join_requests ?? 0)} />
              <Row label="Approved" value={num(t?.join_requests_approved ?? 0)} />
              <Row
                label="Still pending"
                value={num(t?.join_requests_pending ?? 0)}
                tone={(t?.join_requests_pending ?? 0) > 0 ? 'warn' : undefined}
              />
              <Row label="Announcements sent" value={num(t?.announcements ?? 0)} />
            </div>
          </Card>

          <Card>
            <CardHeader title="What was touched" subtitle="audit events by record type" />
            {(data?.by_entity ?? []).length === 0 ? (
              <p className="py-2 text-[13px] text-muted">Nothing recorded in this window.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {(data?.by_entity ?? []).map((e) => (
                  <Row key={e.entity} label={e.entity} value={num(e.count)} />
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Busiest cooperatives" subtitle="by recorded events" />
            {(data?.busiest_cooperatives ?? []).length === 0 ? (
              <p className="py-2 text-[13px] text-muted">Nothing recorded in this window.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {(data?.busiest_cooperatives ?? []).map((c) => (
                  <Row key={c.cooperative} label={c.cooperative} value={num(c.count)} />
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader
            title="Payment events"
            subtitle={`${data?.payments?.total_events ?? 0} in the last ${data?.payments?.window_days ?? 0} days · ${data?.payments?.success_rate ?? 0}% matched`}
            action={
              (data?.payments?.exceptions ?? 0) > 0 ? (
                <Badge tone="gold">{num(data?.payments?.exceptions ?? 0)} exceptions</Badge>
              ) : undefined
            }
          />
          <BarSeries
            data={data?.payments?.trend ?? []}
            xKey="day"
            yKey="total"
            format="count"
            height={160}
          />
        </Card>

        <Card className="mt-4" padded={false}>
          <div className="border-b border-line px-4 py-3">
            <div className="font-display text-[15px] font-semibold text-ink">Recent events</div>
            <div className="text-[13px] text-muted">
              Straight from the immutable audit trail, newest first
            </div>
          </div>
          <Feed rows={data?.feed ?? []} />
        </Card>
      </QueryState>
    </div>
  )
}

function Row({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'warn'
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-soft">{label}</span>
      <span
        className={`font-mono tnum ${tone === 'warn' ? 'font-semibold text-gold-deep' : 'text-muted'}`}
      >
        {value}
      </span>
    </div>
  )
}

function Feed({ rows }: { rows: ActivityEvent[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="timeline"
        title="Nothing recorded yet"
        hint="Provisioning a cooperative, admitting a member or recording a payment will appear here."
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
              {r.cooperative ? ` · ${r.cooperative}` : ''}
              {r.entity ? ` · ${r.entity}` : ''}
            </div>
          </div>
          <span className="shrink-0 font-mono text-xs text-muted-2">{dateTime(r.created_at)}</span>
        </li>
      ))}
    </ul>
  )
}
