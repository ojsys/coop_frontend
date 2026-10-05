import { usePaymentEvents, useReconSummary } from '@/api/hooks'
import { useRematchEvent, useRematchAll } from '@/api/mutations'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { StatTile } from '@/ui/StatTile'
import { StatusPill, Badge } from '@/ui/Badge'
import { Icon } from '@/ui/Icon'
import { Table, type Column } from '@/ui/Table'
import { QueryState } from '@/ui/QueryState'
import { EmptyState } from '@/ui/EmptyState'
import { naira, shortDate } from '@/lib/format'
import type { PaymentEvent } from '@/api/types'

const STATUS_LEGEND: { status: string; tone: 'green' | 'gold' | 'danger' | 'neutral'; meaning: string }[] = [
  { status: 'matched', tone: 'green', meaning: 'Settlement was linked to the exact expected contribution — nothing to do.' },
  { status: 'unmatched', tone: 'danger', meaning: 'No expected contribution found for this payment — check the reference or record the contribution.' },
  { status: 'partial', tone: 'gold', meaning: 'Amount received differs from the amount expected — investigate the shortfall/overpayment.' },
  { status: 'duplicate', tone: 'neutral', meaning: 'The same settlement arrived twice — the duplicate is ignored so the member is not double-credited.' },
  { status: 'ignored', tone: 'neutral', meaning: 'A non-success event (e.g. a failed charge) — safely skipped.' },
]

export function ReconciliationPage() {
  const summary = useReconSummary()
  const events = usePaymentEvents()
  const rematch = useRematchEvent()
  const rematchAll = useRematchAll()
  const toast = useToast()

  async function runRematchAll() {
    try {
      const res = await rematchAll.mutateAsync()
      toast(`Re-ran matching on ${res.rematched} exception(s)`)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not re-run matching'), 'error')
    }
  }

  const s = summary.data

  const columns: Column<PaymentEvent>[] = [
    {
      key: 'provider',
      header: 'Provider',
      render: (e) => (
        <span className="flex items-center gap-2">
          <Icon name="account_balance_wallet" size={18} className="text-muted-2" />
          <span className="capitalize">{e.provider}</span>
        </span>
      ),
    },
    {
      key: 'ref',
      header: 'Reference',
      render: (e) => <span className="font-mono text-xs text-muted">{e.reference || e.event_id}</span>,
    },
    { key: 'date', header: 'Received', render: (e) => shortDate(e.received_at) },
    { key: 'status', header: 'Status', render: (e) => <StatusPill status={e.status} /> },
    {
      key: 'amt',
      header: 'Amount',
      align: 'right',
      render: (e) => <span className="font-mono tnum">{naira(e.amount)}</span>,
    },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (e) =>
        e.status !== 'matched' ? (
          <button
            onClick={async () => {
              try {
                await rematch.mutateAsync(e.id)
                toast('Re-ran matching')
              } catch (err) {
                toast(apiErrorMessage(err, 'Could not rematch'), 'error')
              }
            }}
            className="text-xs font-medium text-green hover:underline"
          >
            Rematch
          </button>
        ) : null,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Reconciliation"
        subtitle="Match PSP settlements against expected contributions"
        actions={
          <Button variant="secondary" size="sm" icon="sync" onClick={runRematchAll} loading={rematchAll.isPending}>
            Re-run matching
          </Button>
        }
      />

      {/* Plain-language explainer for coop admins */}
      <Card className="mb-4 !bg-green-50 !border-green-100">
        <div className="flex items-start gap-3">
          <Icon name="info" size={20} className="mt-0.5 text-green" />
          <div className="text-[13px] text-ink-soft">
            <p className="font-medium text-ink">What reconciliation does</p>
            <p className="mt-1">
              When a member pays through Paystack/Flutterwave, the provider sends us a
              settlement notice. We automatically try to match each settlement to the
              contribution the member was expected to make. Matched payments post to the
              ledger; anything that doesn't match becomes an <strong>exception</strong> for
              you to review. Fixing a reference and clicking <strong>Rematch</strong> (or
              <strong> Re-run matching</strong> for all) re-checks them.
            </p>
          </div>
        </div>
      </Card>

      <QueryState isLoading={summary.isLoading} isError={summary.isError}>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Settlements ingested" value={s?.ingested ?? 0} icon="download" iconTone="neutral" />
          <StatTile label="Auto-matched" value={s?.matched ?? 0} icon="check_circle" iconTone="green" />
          <StatTile label="Exceptions" value={s?.exceptions ?? 0} icon="error" iconTone="danger" />
          <StatTile label="Match accuracy" value={`${s?.match_accuracy ?? 100}%`} icon="target" iconTone="gold" />
        </div>
      </QueryState>

      <Card className="mb-4">
        <h3 className="mb-3 font-display text-[15px] font-semibold text-ink">What the statuses mean</h3>
        <div className="grid gap-2.5 md:grid-cols-2">
          {STATUS_LEGEND.map((l) => (
            <div key={l.status} className="flex items-start gap-2.5">
              <Badge tone={l.tone} dot>{l.status}</Badge>
              <span className="flex-1 text-[13px] text-muted">{l.meaning}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card padded={false}>
        <div className="border-b border-line px-5 py-4">
          <h3 className="font-display text-[15px] font-semibold text-ink">Settlements</h3>
          <p className="mt-0.5 text-[13px] text-muted">
            Each event is classified matched / unmatched / partial / duplicate / ignored
          </p>
        </div>
        <QueryState isLoading={events.isLoading} isError={events.isError}>
          {(events.data ?? []).length === 0 ? (
            <EmptyState
              icon="sync_alt"
              title="No settlements yet"
              hint="PSP webhooks (Paystack / Flutterwave) land here and are reconciled automatically against expected contributions."
            />
          ) : (
            <Table columns={columns} rows={events.data ?? []} rowKey={(e) => e.id} />
          )}
        </QueryState>
      </Card>
    </div>
  )
}
