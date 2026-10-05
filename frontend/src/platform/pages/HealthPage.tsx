import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/ui/PageHeader'
import { Card, CardHeader } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Badge } from '@/ui/Badge'
import { StatTile } from '@/ui/StatTile'
import { QueryState } from '@/ui/QueryState'
import { Modal } from '@/ui/Modal'
import { Field, Select } from '@/ui/Field'
import { Sparkline } from '@/ui/Charts'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import {
  usePlatformHealth,
  useFleetHealth,
  usePaymentMonitor,
  useAuditStream,
  useIncidents,
} from '@/api/hooks'
import { useIncidentsCrud, useProviderStatusCrud } from '@/api/mutations'
import { naira, dateTime, timeAgo } from '@/lib/format'
import type { Incident } from '@/api/types'

const KIND_ICON: Record<string, string> = { psp: 'credit_card', sms: 'sms', email: 'mail', other: 'extension' }
const provTone = (s: string) => (s === 'operational' ? 'green' : s === 'degraded' ? 'gold' : 'danger')
const sevTone = (s: string) => (s === 'critical' || s === 'major' ? 'danger' : s === 'minor' ? 'gold' : 'neutral')

export function HealthPage() {
  const health = usePlatformHealth()
  const fleet = useFleetHealth()
  const monitor = usePaymentMonitor()
  const audit = useAuditStream()
  const { data: incidents = [] } = useIncidents()
  const navigate = useNavigate()
  const [incidentOpen, setIncidentOpen] = useState(false)
  const incidentCrud = useIncidentsCrud()
  const providerCrud = useProviderStatusCrud()
  const toast = useToast()

  async function resolveIncident(i: Incident) {
    try {
      await incidentCrud.action.mutateAsync({ id: i.id, action: 'resolve' })
      toast('Incident resolved')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not resolve'), 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="System Health"
        subtitle="Fleet health, payments, providers, incidents & audit"
        actions={<Button size="sm" icon="add" variant="secondary" onClick={() => setIncidentOpen(true)}>Log incident</Button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Fleet healthy" value={`${fleet.data?.healthy ?? 0}/${fleet.data?.total ?? 0}`} icon="verified" iconTone="green" foot={`${fleet.data?.at_risk_count ?? 0} at risk`} />
        <StatTile label="Webhook success" value={`${monitor.data?.success_rate ?? 100}%`} icon="webhook" iconTone="green" foot={`${monitor.data?.window_days ?? 14}d`} />
        <StatTile label="Recon exceptions" value={monitor.data?.exceptions ?? 0} icon="report" iconTone="gold" />
        <StatTile label="Open incidents" value={incidents.filter((i) => i.status !== 'resolved').length} icon="crisis_alert" iconTone="danger" />
      </div>

      {/* Fleet rollup */}
      <Card className="mb-4" padded={false}>
        <div className="px-5 py-4">
          <h3 className="font-display text-[15px] font-semibold text-ink">Fleet health rollup</h3>
          <p className="text-[13px] text-muted">Tenants needing attention (unbalanced ledger, exceptions, missing setup)</p>
        </div>
        <QueryState isLoading={fleet.isLoading} isError={fleet.isError} minHeight={100}>
          {fleet.data && fleet.data.at_risk.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-muted">Every cooperative is healthy. 🎉</p>
          ) : (
            <div className="divide-y divide-line">
              {fleet.data?.at_risk.slice(0, 8).map((t) => (
                <button
                  key={t.cooperative_id}
                  onClick={() => navigate(`/platform/cooperatives/${t.cooperative_id}`)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-sand/60"
                >
                  <Icon name={t.ledger_balanced ? 'warning' : 'error'} size={18} className={t.ledger_balanced ? 'text-gold-deep' : 'text-danger'} />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-ink">{t.name}</div>
                    <div className="text-xs text-muted">{t.failing.join(' · ')}</div>
                  </div>
                  {t.recon_exceptions > 0 && <Badge tone="gold">{t.recon_exceptions} exc.</Badge>}
                  <Badge tone={t.status === 'active' ? 'green' : 'gold'} dot>{t.status}</Badge>
                  <Icon name="chevron_right" size={18} className="text-faint" />
                </button>
              ))}
            </div>
          )}
        </QueryState>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Payment monitor */}
        <Card>
          <CardHeader
            title="Payment & webhook monitor"
            subtitle={`${monitor.data?.total_events ?? 0} events · last ${monitor.data?.window_days ?? 14} days`}
            action={<Sparkline values={(monitor.data?.trend ?? []).map((d) => d.success)} width={110} height={30} />}
          />
          <div className="space-y-1.5">
            {(monitor.data?.recent ?? []).length === 0 && (
              <p className="py-3 text-center text-sm text-muted">No recent payment events.</p>
            )}
            {(monitor.data?.recent ?? []).slice(0, 8).map((e) => (
              <div key={e.id} className="flex items-center gap-2.5 text-[13px]">
                <Badge tone={e.status === 'matched' ? 'green' : e.status === 'ignored' ? 'neutral' : 'danger'} dot>{e.status}</Badge>
                <span className="flex-1 truncate font-mono text-xs text-muted">{e.reference}</span>
                <span className="text-muted-2">{e.cooperative ?? '—'}</span>
                <span className="font-mono tnum text-ink-soft">{naira(e.amount)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Provider latency history */}
        <Card>
          <CardHeader title="Provider latency" subtitle="Recent samples per integration" />
          <QueryState isLoading={health.isLoading} isError={health.isError} minHeight={120}>
            <div className="space-y-2.5">
              {(health.data?.provider_history ?? []).map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-line bg-paper px-3 py-2.5">
                  <Icon name={KIND_ICON[p.kind] ?? 'extension'} size={18} className="text-muted-2" />
                  <span className="flex-1 text-sm font-medium text-ink">{p.name}</span>
                  <Sparkline values={p.history.map((h) => h.latency_ms)} width={90} height={26} color={provTone(p.status) === 'green' ? '#0b4f3a' : '#d99e2b'} />
                  <span className="w-14 text-right font-mono text-xs text-muted-2">{p.latency_ms}ms</span>
                  <Badge tone={provTone(p.status)} dot>{p.status}</Badge>
                  <button
                    onClick={async () => {
                      try { await providerCrud.action.mutateAsync({ id: p.id, action: 'record' }); toast('Sampled') } catch (err) { toast(apiErrorMessage(err, 'Failed'), 'error') }
                    }}
                    className="text-muted-2 transition hover:text-ink"
                    title="Record a fresh sample"
                  >
                    <Icon name="refresh" size={16} />
                  </button>
                </div>
              ))}
            </div>
          </QueryState>
        </Card>

        {/* Incident log */}
        <Card>
          <CardHeader title="Incidents" subtitle="Open & recent" />
          <div className="space-y-2">
            {incidents.length === 0 && <p className="py-2 text-sm text-muted">No incidents logged.</p>}
            {incidents.slice(0, 6).map((i) => (
              <div key={i.id} className="flex items-start gap-2.5 rounded-lg border border-line bg-paper px-3 py-2.5">
                <Icon name="crisis_alert" size={17} className={sevTone(i.severity) === 'danger' ? 'text-danger' : 'text-gold-deep'} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-ink">{i.title}</span>
                    <Badge tone={sevTone(i.severity)}>{i.severity_display}</Badge>
                    <Badge tone={i.status === 'resolved' ? 'green' : 'gold'} dot>{i.status_display}</Badge>
                  </div>
                  {i.note && <p className="mt-0.5 text-xs text-muted">{i.note}</p>}
                  <div className="mt-0.5 text-xs text-muted-2">{timeAgo(i.started_at)}</div>
                </div>
                {i.status !== 'resolved' && (
                  <Button size="sm" variant="ghost" onClick={() => resolveIncident(i)}>Resolve</Button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Audit stream */}
        <Card>
          <CardHeader title="Platform audit stream" subtitle="Provisioning, lifecycle & impersonation" />
          <QueryState isLoading={audit.isLoading} isError={audit.isError} minHeight={120}>
            <div className="space-y-1.5">
              {(audit.data ?? []).length === 0 && <p className="py-2 text-sm text-muted">No recent activity.</p>}
              {(audit.data ?? []).slice(0, 8).map((e) => (
                <div key={e.id} className="flex items-center gap-2.5 text-[13px]">
                  <span className="font-mono text-xs text-green">{e.action.replace('cooperative.', '')}</span>
                  <span className="flex-1 truncate text-ink-soft">{e.cooperative ?? e.entity}</span>
                  <span className="text-muted-2">{e.actor}</span>
                  <span className="text-xs text-muted-2">{dateTime(e.created_at)}</span>
                </div>
              ))}
            </div>
          </QueryState>
        </Card>
      </div>

      <LogIncidentModal open={incidentOpen} onClose={() => setIncidentOpen(false)} />
    </div>
  )
}

function LogIncidentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useIncidentsCrud()
  const toast = useToast()
  const [form, setForm] = useState({ title: '', severity: 'minor', note: '' })

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await create.mutateAsync({ title: form.title, severity: form.severity, note: form.note })
      toast('Incident logged')
      onClose()
      setForm({ title: '', severity: 'minor', note: '' })
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not log incident'), 'error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log incident" subtitle="Track a platform issue">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Title">
          <input required value={form.title} onChange={(e) => set('title', e.target.value)} className="input" placeholder="Paystack webhook delays" />
        </Field>
        <Field label="Severity">
          <Select
            value={form.severity}
            onChange={(e) => set('severity', e.target.value)}
            options={[
              { value: 'info', label: 'Info' },
              { value: 'minor', label: 'Minor' },
              { value: 'major', label: 'Major' },
              { value: 'critical', label: 'Critical' },
            ]}
          />
        </Field>
        <Field label="Note">
          <textarea rows={3} value={form.note} onChange={(e) => set('note', e.target.value)} className="input resize-none" placeholder="What's happening and impact…" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={create.isPending}>Log incident</Button>
        </div>
      </form>
    </Modal>
  )
}
