import { useState } from 'react'
import {
  useArrears, useAuditLogs, useContributionSummary, useMembers,
  useTrialBalance, useIncomeStatement, useBalanceSheet,
} from '@/api/hooks'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Avatar } from '@/ui/Avatar'
import { Badge } from '@/ui/Badge'
import { Table, type Column } from '@/ui/Table'
import { QueryState } from '@/ui/QueryState'
import { Modal } from '@/ui/Modal'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { useSendArrearsReminders } from '@/api/mutations'
import { naira, dateTime } from '@/lib/format'
import { downloadFile } from '@/lib/download'
import type { AuditLog } from '@/api/types'

export function ReportsPage() {
  const arrears = useArrears()
  const summary = useContributionSummary()
  const audit = useAuditLogs()
  const toast = useToast()
  const [statementsOpen, setStatementsOpen] = useState(false)
  const [financial, setFinancial] = useState<'trial' | 'income' | 'balance' | null>(null)
  const reminders = useSendArrearsReminders()

  async function sendReminders() {
    try {
      const res = await reminders.mutateAsync()
      toast(`Reminders sent to ${res.reached} member${res.reached === 1 ? '' : 's'} in arrears`)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not send reminders'), 'error')
    }
  }

  async function download(path: string, filename: string) {
    try {
      await downloadFile(path, filename)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not generate report'), 'error')
    }
  }

  const reports = [
    {
      icon: 'summarize',
      title: 'Contribution summary',
      hint: summary.data ? `${naira(summary.data.total)} across ${summary.data.by_type.length} types` : 'By type & period',
      tone: 'green' as const,
      cta: 'Export CSV',
      onClick: () => download('/reports/contribution-summary-csv/', 'contribution-summary.csv'),
    },
    {
      icon: 'receipt_long',
      title: 'Member statements',
      hint: 'Per-member dated PDF statements',
      tone: 'gold' as const,
      cta: 'Choose member',
      onClick: () => setStatementsOpen(true),
    },
    {
      icon: 'warning',
      title: 'Arrears report',
      hint: arrears.data
        ? `${arrears.data.members_in_arrears} members · ${naira(arrears.data.total_outstanding)} outstanding`
        : 'Members behind on mandatory dues',
      tone: 'danger' as const,
      cta: 'Export CSV',
      onClick: () => download('/reports/arrears-csv/', 'arrears.csv'),
    },
  ]

  const toneCls = {
    green: 'bg-green-50 text-green',
    gold: 'bg-gold-50 text-gold-deep',
    danger: 'bg-danger-50 text-danger',
  }

  const columns: Column<AuditLog>[] = [
    { key: 'ts', header: 'Timestamp', render: (l) => <span className="font-mono text-xs">{dateTime(l.created_at)}</span> },
    { key: 'actor', header: 'Actor', render: (l) => l.actor_name ?? 'System' },
    { key: 'action', header: 'Action', render: (l) => <span className="text-ink-soft">{l.action}</span> },
    { key: 'entity', header: 'Entity', render: (l) => <Badge tone="neutral">{l.entity_type}</Badge> },
  ]

  return (
    <div>
      <PageHeader
        title="Reports & Audit"
        subtitle="Generate, export and review the immutable audit trail"
        actions={
          <Button size="sm" variant="secondary" icon="notifications_active" onClick={sendReminders} loading={reminders.isPending}>
            Remind members in arrears
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        {reports.map((r) => (
          <Card key={r.title} onClick={r.onClick} className="cursor-pointer transition hover:border-green-100 hover:shadow-float">
            <div className="flex items-start gap-3">
              <span className={`flex size-11 items-center justify-center rounded-lg ${toneCls[r.tone]}`}>
                <Icon name={r.icon} size={22} />
              </span>
              <div>
                <div className="font-display text-[15px] font-semibold text-ink">{r.title}</div>
                <p className="mt-0.5 text-[13px] text-muted">{r.hint}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-green">
              {r.cta} <Icon name="arrow_forward" size={16} />
            </div>
          </Card>
        ))}
      </div>

      <h3 className="mb-2 font-display text-[15px] font-semibold text-ink">Financial statements</h3>
      <p className="mb-3 text-[13px] text-muted">Generated live from the immutable double-entry ledger.</p>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {([
          { key: 'trial', icon: 'balance', title: 'Trial balance', hint: 'All account balances — debits must equal credits' },
          { key: 'income', icon: 'trending_up', title: 'Income statement', hint: 'Income less expenses = surplus/deficit' },
          { key: 'balance', icon: 'account_balance', title: 'Balance sheet', hint: 'Assets = liabilities + members’ equity' },
        ] as const).map((r) => (
          <Card key={r.key} onClick={() => setFinancial(r.key)} className="cursor-pointer transition hover:border-green-100 hover:shadow-float">
            <div className="flex items-start gap-3">
              <span className="flex size-11 items-center justify-center rounded-lg bg-green-50 text-green"><Icon name={r.icon} size={22} /></span>
              <div>
                <div className="font-display text-[15px] font-semibold text-ink">{r.title}</div>
                <p className="mt-0.5 text-[13px] text-muted">{r.hint}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-green">View <Icon name="arrow_forward" size={16} /></div>
          </Card>
        ))}
      </div>

      <Card padded={false}>
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <Icon name="history" size={20} className="text-muted-2" />
          <div>
            <h3 className="font-display text-[15px] font-semibold text-ink">Audit log</h3>
            <p className="text-[13px] text-muted">who · what · when · before/after — immutable</p>
          </div>
        </div>
        <QueryState isLoading={audit.isLoading} isError={audit.isError}>
          <Table columns={columns} rows={audit.data ?? []} rowKey={(l) => l.id} empty={<span className="text-sm text-muted">No audit entries.</span>} />
        </QueryState>
      </Card>

      {statementsOpen && <StatementPickerModal onClose={() => setStatementsOpen(false)} />}
      {financial && <FinancialModal kind={financial} onClose={() => setFinancial(null)} />}
    </div>
  )
}

function FinancialModal({ kind, onClose }: { kind: 'trial' | 'income' | 'balance'; onClose: () => void }) {
  const trial = useTrialBalance()
  const income = useIncomeStatement()
  const balance = useBalanceSheet()
  const toast = useToast()
  const title = kind === 'trial' ? 'Trial balance' : kind === 'income' ? 'Income statement' : 'Balance sheet'

  return (
    <Modal open onClose={onClose} width={640} title={title} subtitle="Live from the ledger">
      <div className="space-y-3">
        {kind === 'trial' && trial.data && (
          <>
            <StmtTable rows={trial.data.rows.map((r) => ({ label: `${r.code} · ${r.name}`, left: r.debit, right: r.credit }))} leftHead="Debit" rightHead="Credit" />
            <TotalRow label="Totals" left={naira(trial.data.total_debit)} right={naira(trial.data.total_credit)} ok={trial.data.balanced} />
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" icon="download" onClick={() => downloadFile('/reports/trial-balance-csv/', 'trial-balance.csv').catch(() => toast('Export failed', 'error'))}>Export CSV</Button>
            </div>
          </>
        )}
        {kind === 'income' && income.data && (
          <>
            <SectionRows title="Income" items={income.data.income} total={income.data.income_total} />
            <SectionRows title="Expenses" items={income.data.expense} total={income.data.expense_total} />
            <TotalRow label="Surplus / (deficit)" left="" right={naira(income.data.surplus)} ok />
          </>
        )}
        {kind === 'balance' && balance.data && (
          <>
            <SectionRows title="Assets" items={balance.data.assets} total={balance.data.assets_total} />
            <SectionRows title="Liabilities" items={balance.data.liabilities} total={balance.data.liabilities_total} />
            <SectionRows title="Members’ equity" items={[...balance.data.equity, { code: '', name: 'Retained surplus', amount: balance.data.retained_surplus }]} total={String(Number(balance.data.total_equity_and_liabilities) - Number(balance.data.liabilities_total))} />
            <TotalRow label="Assets vs Liabilities + Equity" left={naira(balance.data.assets_total)} right={naira(balance.data.total_equity_and_liabilities)} ok={balance.data.balanced} />
          </>
        )}
      </div>
    </Modal>
  )
}

function StmtTable({ rows, leftHead, rightHead }: { rows: { label: string; left: string; right: string }[]; leftHead: string; rightHead: string }) {
  return (
    <table className="w-full text-[13px]">
      <thead><tr className="border-b border-line text-[11px] uppercase text-muted-2">
        <th className="py-1.5 text-left">Account</th><th className="py-1.5 text-right">{leftHead}</th><th className="py-1.5 text-right">{rightHead}</th>
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-line/60">
            <td className="py-1.5 text-ink-soft">{r.label}</td>
            <td className="py-1.5 text-right font-mono tnum">{Number(r.left) ? naira(r.left) : '—'}</td>
            <td className="py-1.5 text-right font-mono tnum">{Number(r.right) ? naira(r.right) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SectionRows({ title, items, total }: { title: string; items: { code: string; name: string; amount: string }[]; total: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-2">{title}</div>
      {items.map((it, i) => (
        <div key={i} className="flex justify-between py-1 text-[13px]">
          <span className="text-ink-soft">{it.code ? `${it.code} · ` : ''}{it.name}</span>
          <span className="font-mono tnum">{naira(it.amount)}</span>
        </div>
      ))}
      <div className="flex justify-between border-t border-line py-1.5 text-[13px] font-semibold">
        <span>Total {title.toLowerCase()}</span><span className="font-mono tnum">{naira(total)}</span>
      </div>
    </div>
  )
}

function TotalRow({ label, left, right, ok }: { label: string; left: string; right: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 text-[13px] font-semibold text-ink">
      <span className="flex items-center gap-1.5">{ok && <Icon name="check_circle" size={15} className="text-green-bright" fill />}{label}</span>
      <span className="flex gap-4 font-mono tnum">{left && <span>{left}</span>}<span>{right}</span></span>
    </div>
  )
}

function StatementPickerModal({ onClose }: { onClose: () => void }) {
  const { data: members = [] } = useMembers()
  const toast = useToast()
  const [q, setQ] = useState('')
  const filtered = members.filter(
    (m) => m.full_name.toLowerCase().includes(q.toLowerCase()) || m.member_no.toLowerCase().includes(q.toLowerCase()),
  )

  async function grab(id: number, memberNo: string) {
    try {
      await downloadFile('/reports/statement-pdf/', `statement-${memberNo}.pdf`, { membership: id })
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not generate statement'), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title="Member statements" subtitle="Download a member's dated PDF statement">
      <div className="space-y-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="Search name or member no…" />
        <div className="max-h-80 space-y-1.5 overflow-auto">
          {filtered.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-paper px-3 py-2">
              <Avatar name={m.full_name} size={30} />
              <div className="flex-1">
                <div className="text-sm font-medium text-ink">{m.full_name}</div>
                <div className="font-mono text-xs text-muted-2">{m.member_no}</div>
              </div>
              <Button size="sm" variant="secondary" icon="download" onClick={() => grab(m.id, m.member_no)}>PDF</Button>
            </div>
          ))}
          {filtered.length === 0 && <p className="py-4 text-center text-sm text-muted">No members match.</p>}
        </div>
      </div>
    </Modal>
  )
}
