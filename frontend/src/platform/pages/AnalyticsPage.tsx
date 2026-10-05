import { useState } from 'react'
import { PageHeader } from '@/ui/PageHeader'
import { Card, CardHeader } from '@/ui/Card'
import { Avatar } from '@/ui/Avatar'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { StatTile } from '@/ui/StatTile'
import { QueryState } from '@/ui/QueryState'
import { TrendArea, BarSeries } from '@/ui/Charts'
import { usePlatformAnalytics, usePlatformOverview } from '@/api/hooks'
import { api } from '@/api/client'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { naira, num } from '@/lib/format'
import type { CohortRow } from '@/api/types'

const RANGES = [3, 6, 12] as const

const TIER_LABEL: Record<string, string> = {
  small: 'Small', medium: 'Medium', large: 'Large',
}

export function AnalyticsPage() {
  const [months, setMonths] = useState<number>(6)
  const { data, isLoading, isError } = usePlatformAnalytics(months)
  const { data: overview } = usePlatformOverview()
  const toast = useToast()

  async function exportCsv() {
    try {
      const { data: blob } = await api.get('/platform/analytics/export/', {
        params: { months }, responseType: 'blob',
      })
      const url = URL.createObjectURL(blob as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `platform-analytics-${months}mo.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not export'), 'error')
    }
  }

  const coopsByState = data?.coops_by_state ?? []
  const maxState = Math.max(1, ...coopsByState.map((r) => r.count))
  const pv = data?.paid_vs_trial ?? { paid: 0, trial: 0 }
  const ad = data?.active_vs_dormant ?? { active: 0, dormant: 0 }

  return (
    <div>
      <PageHeader
        title="B2B Analytics"
        subtitle="Revenue, growth, activation & retention across the whole portfolio"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md bg-sand-deep p-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setMonths(r)}
                  className={`rounded px-2.5 py-1 text-[13px] font-medium transition ${
                    months === r ? 'bg-card text-ink shadow-soft' : 'text-muted hover:text-ink'
                  }`}
                >
                  {r}mo
                </button>
              ))}
            </div>
            <Button size="sm" variant="secondary" icon="download" onClick={exportCsv}>Export CSV</Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Monthly recurring rev." value={naira(overview?.mrr ?? 0, { compact: true })} icon="payments" iconTone="green" />
        <StatTile label="ARPU" value={naira(data?.arpu ?? 0, { compact: true })} icon="account_balance" iconTone="gold" foot="per cooperative" />
        <StatTile label="Net revenue retention" value={`${data?.net_revenue_retention ?? 100}%`} icon="trending_up" iconTone="green" />
        <StatTile label="Active tenants" value={num(ad.active)} icon="bolt" iconTone="green" foot={`${ad.dormant} dormant`} />
      </div>

      <QueryState isLoading={isLoading} isError={isError} minHeight={320}>
        {data && (
          <div className="space-y-4">
            {/* Revenue */}
            <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <Card>
                <CardHeader title="Monthly recurring revenue" subtitle={`Last ${months} months · ₦`} />
                <TrendArea
                  data={data.mrr_trend.map((m) => ({ month: m.month, mrr: Number(m.mrr) }))}
                  xKey="month"
                  yKey="mrr"
                  height={240}
                />
              </Card>
              <Card>
                <CardHeader title="Revenue by plan tier" subtitle="Monthly · ₦" />
                <BarSeries
                  data={data.revenue_by_tier.map((t) => ({ tier: TIER_LABEL[t.tier] ?? t.tier, revenue: Number(t.revenue) }))}
                  xKey="tier"
                  yKey="revenue"
                  height={180}
                />
                <SplitBar
                  a={{ label: 'Paid', value: pv.paid, tone: 'bg-green' }}
                  b={{ label: 'Trial', value: pv.trial, tone: 'bg-gold' }}
                />
              </Card>
            </div>

            {/* Growth & activation */}
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader title="New cooperatives" subtitle="provisioned per month" />
                <BarSeries
                  data={data.growth_trend.map((g) => ({ month: g.month, n: g.new_coops }))}
                  xKey="month" yKey="n" height={170} format="count"
                />
              </Card>
              <Card>
                <CardHeader title="New members" subtitle="registered per month" />
                <BarSeries
                  data={data.growth_trend.map((g) => ({ month: g.month, n: g.new_members }))}
                  xKey="month" yKey="n" height={170} format="count" color="#d99e2b"
                />
              </Card>
              <Card>
                <CardHeader title="Activation funnel" subtitle="provisioned → live" />
                <Funnel steps={data.activation_funnel} />
              </Card>
            </div>

            {/* Retention */}
            <Card>
              <CardHeader
                title="Cohort retention"
                subtitle="Share of each provisioning-month cohort still contributing in later months"
              />
              <CohortGrid rows={data.cohort_retention.rows} span={data.cohort_retention.span} />
            </Card>

            {/* Portfolio */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="Feature adoption" subtitle="% of live cooperatives actively using" />
                <div className="space-y-3">
                  {data.feature_adoption.map((f) => (
                    <div key={f.feature}>
                      <div className="mb-1 flex justify-between text-[13px]">
                        <span className="text-ink-soft">{f.feature}</span>
                        <span className="font-mono text-muted tnum">{f.pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-sand-deep">
                        <div className="h-full rounded-full bg-green" style={{ width: `${f.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <CardHeader title="Cooperatives by state" />
                <div className="space-y-2.5">
                  {coopsByState.length === 0 && <p className="py-3 text-sm text-muted">No cooperatives yet.</p>}
                  {coopsByState.slice(0, 8).map((r) => (
                    <div key={r.state} className="flex items-center gap-3">
                      <span className="w-16 text-[13px] text-ink-soft">{r.state}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded bg-sand-deep">
                        <div className="h-full rounded bg-gold" style={{ width: `${(r.count / maxState) * 100}%` }} />
                      </div>
                      <span className="w-6 text-right font-mono text-xs text-muted">{r.count}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader title="Churn-risk watchlist" subtitle="Blends billing, contribution recency & active membership" />
                <div className="space-y-2">
                  {data.churn_watchlist.length === 0 && <p className="py-3 text-sm text-muted">No cooperatives currently flagged. 🎉</p>}
                  {data.churn_watchlist.map((r) => (
                    <div key={r.cooperative_id} className="flex items-center gap-3 rounded-lg border border-line bg-paper px-3.5 py-3">
                      <Avatar name={r.name} size={36} />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-ink">{r.name}</div>
                        <div className="text-xs text-muted">{r.reason}</div>
                      </div>
                      <Badge tone={r.score >= 75 ? 'danger' : r.score >= 50 ? 'gold' : 'neutral'}>risk {r.score}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  )
}

function SplitBar({ a, b }: { a: { label: string; value: number; tone: string }; b: { label: string; value: number; tone: string } }) {
  const total = a.value + b.value || 1
  return (
    <div className="mt-4">
      <div className="flex h-3 overflow-hidden rounded-full">
        <div className={a.tone} style={{ width: `${(a.value / total) * 100}%` }} />
        <div className={`${b.tone} border-l-2 border-card`} style={{ width: `${(b.value / total) * 100}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs">
        <span className="flex items-center gap-1.5 text-ink-soft"><span className={`size-2 rounded-full ${a.tone}`} /> {a.label} · {a.value}</span>
        <span className="flex items-center gap-1.5 text-ink-soft"><span className={`size-2 rounded-full ${b.tone}`} /> {b.label} · {b.value}</span>
      </div>
    </div>
  )
}

function Funnel({ steps }: { steps: { stage: string; count: number }[] }) {
  const top = steps[0]?.count || 1
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const pct = Math.round((s.count / top) * 100)
        const conv = i === 0 ? 100 : steps[i - 1].count ? Math.round((s.count / steps[i - 1].count) * 100) : 0
        return (
          <div key={s.stage}>
            <div className="mb-1 flex justify-between text-[13px]">
              <span className="text-ink-soft">{s.stage}</span>
              <span className="font-mono text-muted-2 tnum">{s.count}{i > 0 && ` · ${conv}%`}</span>
            </div>
            <div className="h-6 overflow-hidden rounded-md bg-sand-deep">
              <div className="flex h-full items-center rounded-md bg-green px-2 text-[11px] font-medium text-paper" style={{ width: `${Math.max(pct, 6)}%` }}>
                {pct >= 20 && `${pct}%`}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CohortGrid({ rows, span }: { rows: CohortRow[]; span: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-2">Cohort</th>
            <th className="px-2 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-2">Size</th>
            {Array.from({ length: span }).map((_, k) => (
              <th key={k} className="px-2 py-1.5 text-center text-[11px] font-semibold text-muted-2">M{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cohort}>
              <td className="px-2 py-1.5 font-medium text-ink-soft">{r.cohort}</td>
              <td className="px-2 py-1.5 text-right font-mono text-muted-2">{r.size}</td>
              {Array.from({ length: span }).map((_, k) => {
                const v = r.values[k]
                if (v == null) return <td key={k} className="px-1 py-1" />
                const alpha = 0.12 + (v / 100) * 0.78
                return (
                  <td key={k} className="px-1 py-1">
                    <div
                      className="flex h-8 items-center justify-center rounded font-mono text-xs"
                      style={{ background: `rgba(11,79,58,${alpha})`, color: v > 45 ? '#f4f1ea' : '#3a3a34' }}
                    >
                      {v}%
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
