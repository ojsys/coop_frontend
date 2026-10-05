import { useNavigate } from 'react-router-dom'
import { usePlatformOverview, usePlatformAttention, usePlatformAnalytics } from '@/api/hooks'
import { PageHeader } from '@/ui/PageHeader'
import { StatTile } from '@/ui/StatTile'
import { Card, CardHeader } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Avatar } from '@/ui/Avatar'
import { BarSeries } from '@/ui/Charts'
import { QueryState } from '@/ui/QueryState'
import { naira, num, timeAgo } from '@/lib/format'

function monthLabel(period: string) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-NG', { month: 'short' })
}

export function CommandCenterPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = usePlatformOverview()
  const { data: attention = [] } = usePlatformAttention()
  const { data: analytics } = usePlatformAnalytics()

  return (
    <div>
      <PageHeader
        title="Command Center"
        subtitle="Startup Ripple · live overview across all tenants"
        actions={
          <>
            {/* A real anchor, not react-router: /admin/ is served by Django and
                is excluded from the SPA catch-all, so client-side routing would
                push the URL and render nothing. New tab keeps console state. */}
            <a
              href="/admin/"
              target="_blank"
              rel="noopener noreferrer"
              title="Low-level data administration (platform admins only)"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-card px-3 py-1.5 text-[13px] font-semibold text-ink-soft transition hover:bg-sand"
            >
              <Icon name="shield_person" size={17} />
              Django admin
              <Icon name="open_in_new" size={14} className="text-muted-2" />
            </a>
            <Button size="sm" icon="add_business" onClick={() => navigate('/platform/provision')}>
              Provision cooperative
            </Button>
          </>
        }
      />

      <QueryState isLoading={isLoading} isError={isError} minHeight={300}>
        {data && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatTile label="Cooperatives live" value={num(data.cooperatives_live)} icon="apartment" iconTone="green" foot={`${data.cooperatives_total} total`} />
              <StatTile label="Members on platform" value={num(data.members_total)} icon="groups" iconTone="gold" foot={`${num(data.active_members_total)} active`} />
              <StatTile label="Monthly recurring rev." value={naira(data.mrr, { compact: true })} icon="payments" iconTone="green" foot="active subscriptions" />
              <StatTile label="Platform reconciliation" value={`${data.reconciliation_accuracy}%`} icon="verified" iconTone="green" foot="across all tenants" />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <Card>
                <CardHeader title="Platform contributions" subtitle="Collected across all tenants · last 6 months · ₦" />
                <BarSeries
                  data={data.contributions_trend.map((p) => ({ month: monthLabel(p.period), total: Number(p.total) }))}
                  xKey="month"
                  yKey="total"
                  height={240}
                  highlightLast
                />
              </Card>

              <Card>
                <CardHeader title="Recently provisioned" />
                <div className="space-y-3">
                  {data.recently_provisioned.map((c) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <Avatar name={c.name} size={38} />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-ink">{c.name}</div>
                        <div className="text-xs text-muted-2">
                          {c.state} · {timeAgo(c.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {data.recently_provisioned.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted">No cooperatives yet.</p>
                  )}
                </div>
              </Card>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <Card>
                <CardHeader title="Attention needed" subtitle={`${attention.length} item${attention.length === 1 ? '' : 's'}`} />
                <div className="space-y-2.5">
                  {attention.length === 0 && (
                    <p className="rounded-lg border border-dashed border-line px-3.5 py-6 text-center text-sm text-muted">
                      All clear — nothing needs attention.
                    </p>
                  )}
                  {attention.map((a) => (
                    <div key={a.title} className="flex items-start gap-3 rounded-lg border border-line bg-paper px-3.5 py-3">
                      <span
                        className={`mt-0.5 flex size-8 items-center justify-center rounded-md ${
                          a.tone === 'danger' ? 'bg-danger-50 text-danger' : a.tone === 'gold' ? 'bg-gold-50 text-gold-deep' : 'bg-sand-deep text-muted'
                        }`}
                      >
                        <Icon name={a.icon} size={18} />
                      </span>
                      <div className="flex-1">
                        <div className="text-[13px] font-medium text-ink">{a.title}</div>
                        <div className="text-xs text-muted">{a.detail}</div>
                      </div>
                      <button
                        onClick={() => navigate(a.link)}
                        className="text-xs font-semibold text-green hover:underline"
                      >
                        {a.cta}
                      </button>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader title="Platform snapshot" />
                <div className="grid grid-cols-2 gap-3">
                  <SnapshotTile label="Gross contributions (this month)" value={naira(data.gross_contributions, { compact: true })} />
                  <SnapshotTile label="Monthly recurring rev." value={naira(data.mrr, { compact: true })} />
                  <SnapshotTile label="Net revenue retention" value={`${analytics?.net_revenue_retention ?? 100}%`} />
                  <SnapshotTile label="Active members" value={num(data.active_members_total)} />
                </div>
              </Card>
            </div>
          </>
        )}
      </QueryState>
    </div>
  )
}

function SnapshotTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper px-3.5 py-3">
      <div className="text-xs text-muted-2">{label}</div>
      <div className="mt-1 font-display text-xl font-semibold text-ink tnum">{value}</div>
    </div>
  )
}
