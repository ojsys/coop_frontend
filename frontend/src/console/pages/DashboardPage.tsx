import { useDashboard, useLoans, useWallet } from '@/api/hooks'
import { WalletShortBanner } from '@/console/FundWalletPrompt'
import { VerificationBanner } from '@/console/VerificationBanner'
import { RenewPanel } from '@/console/RenewSubscription'
import { useSubscriptionState } from '@/console/subscription'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/ui/PageHeader'
import { StatTile } from '@/ui/StatTile'
import { Card, CardHeader } from '@/ui/Card'
import { TrendArea } from '@/ui/Charts'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Spinner } from '@/ui/Spinner'
import { ErrorState } from '@/ui/EmptyState'
import { naira, num } from '@/lib/format'

function monthLabel(period: string) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-NG', { month: 'short' })
}

export function DashboardPage() {
  const { user, activeMembership } = useAuth()
  const { data, isLoading, isError } = useDashboard()
  // Approved loans waiting on an empty wallet are the one thing here that
  // stops a member being paid, so it is said on arrival, not only on Loans.
  const { data: loans = [] } = useLoans()
  const wallet = useWallet()

  const firstName = user?.full_name?.split(' ')[0] ?? 'there'
  const { lapsed } = useSubscriptionState()

  if (lapsed) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Society Dashboard" subtitle={<span>Welcome back, {firstName}</span>} />
        <RenewPanel />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Society Dashboard"
        subtitle={<span>Welcome back, {firstName}</span>}
        actions={
          <>
            <Button variant="secondary" icon="calendar_month" size="sm">
              {data ? monthLabel(data.period) : '—'}
            </Button>
            <Button variant="secondary" icon="download" size="sm">
              Export report
            </Button>
          </>
        }
      />

      <RenewPanel />
      <VerificationBanner />

      {wallet.data && (
        <WalletShortBanner
          loans={loans}
          walletBalance={Number(wallet.data.balance)}
          canManage={activeMembership?.is_privileged ?? false}
        />
      )}

      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner className="size-7" />
        </div>
      )}
      {isError && <ErrorState />}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Contributions · this month"
              value={naira(data.contributions_this_period)}
              icon="payments"
              iconTone="green"
            />
            <StatTile
              label="Total savings"
              value={naira(data.total_savings)}
              icon="savings"
              iconTone="gold"
            />
            <StatTile
              label="Arrears outstanding"
              value={naira(data.arrears_outstanding)}
              icon="error"
              iconTone="danger"
              foot={`${data.members_in_arrears} members behind`}
            />
            <StatTile
              label="Active members"
              value={num(data.active_members)}
              icon="group"
              iconTone="green"
              foot={`of ${num(data.total_members)} · ${data.participation_rate}% participation`}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader
                title="Contributions trend"
                subtitle="Monthly collected · last 6 months"
              />
              <TrendArea
                data={data.contributions_trend.map((p) => ({
                  month: monthLabel(p.period),
                  total: Number(p.total),
                }))}
                xKey="month"
                yKey="total"
                height={240}
              />
            </Card>

            <Card>
              <CardHeader title="Reconciliation" subtitle="Settlement cycle" />
              <div className="flex items-end gap-2">
                <span className="font-display text-4xl font-semibold text-green tnum">
                  {data.reconciliation.match_accuracy}%
                </span>
                <span className="pb-1.5 text-sm text-muted">matched</span>
              </div>
              <div className="mt-4 space-y-2.5 text-sm">
                <ReconRow label="Ingested" value={data.reconciliation.ingested} icon="download" tone="text-muted" />
                <ReconRow label="Matched" value={data.reconciliation.matched} icon="check_circle" tone="text-green-bright" />
                <ReconRow label="Exceptions" value={data.reconciliation.exceptions} icon="error" tone="text-danger" />
              </div>
              {data.reconciliation.exceptions > 0 && (
                <button className="mt-4 flex w-full items-center justify-between rounded-md bg-sand px-3 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-sand-deep">
                  Resolve {data.reconciliation.exceptions} exceptions
                  <Icon name="arrow_forward" size={18} />
                </button>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function ReconRow({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: string
  tone: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted">
        <Icon name={icon} size={17} className={tone} />
        {label}
      </span>
      <span className="font-mono font-medium text-ink tnum">{num(value)}</span>
    </div>
  )
}
