import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCooperatives } from '@/api/hooks'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Avatar } from '@/ui/Avatar'
import { StatusPill, Badge } from '@/ui/Badge'
import { Table, type Column } from '@/ui/Table'
import { QueryState } from '@/ui/QueryState'
import { num } from '@/lib/format'
import type { Cooperative } from '@/api/types'

const TIER_LABEL: Record<string, string> = { small: 'Small', medium: 'Medium', large: 'Large' }

export function CooperativesPage() {
  const navigate = useNavigate()
  const { data = [], isLoading, isError } = useCooperatives()
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    if (!search) return data
    const q = search.toLowerCase()
    return data.filter(
      (c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q) || c.registration_no.toLowerCase().includes(q),
    )
  }, [data, search])

  const columns: Column<Cooperative>[] = [
    {
      key: 'coop',
      header: 'Cooperative',
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar name={c.name} size={34} />
          <div>
            <div className="font-medium text-ink">{c.name}</div>
            <div className="font-mono text-xs text-muted-2">{c.registration_no || c.slug}</div>
          </div>
        </div>
      ),
    },
    { key: 'state', header: 'State', render: (c) => c.state || '—' },
    { key: 'cap', header: 'Member cap', align: 'right', render: (c) => <span className="font-mono tnum">{num(c.member_cap)}</span> },
    { key: 'plan', header: 'Plan', render: (c) => <Badge tone="neutral">{TIER_LABEL[c.tier] ?? c.tier}</Badge> },
    { key: 'status', header: 'Status', render: (c) => <StatusPill status={c.status} /> },
    { key: 'chev', header: '', align: 'right', render: () => <Icon name="chevron_right" size={20} className="text-faint" /> },
  ]

  return (
    <div>
      <PageHeader
        title="Cooperatives"
        subtitle={`${data.length} tenants · each fully isolated · row-level scoped`}
        actions={
          <Button size="sm" icon="add_business" onClick={() => navigate('/platform/provision')}>
            Provision cooperative
          </Button>
        }
      />

      <Card padded={false}>
        <div className="flex items-center gap-2 border-b border-line p-3">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-line bg-paper px-3 py-2">
            <Icon name="search" size={18} className="text-muted-2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cooperative, state, reg. number…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-2"
            />
          </div>
        </div>
        <QueryState isLoading={isLoading} isError={isError}>
          <Table
            columns={columns}
            rows={rows}
            rowKey={(c) => c.id}
            onRowClick={(c) => navigate(`/platform/cooperatives/${c.id}`)}
          />
        </QueryState>
      </Card>
    </div>
  )
}
