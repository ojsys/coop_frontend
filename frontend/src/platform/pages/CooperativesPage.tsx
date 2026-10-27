import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCooperatives, usePlatformMemberSearch } from '@/api/hooks'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Avatar } from '@/ui/Avatar'
import { StatusPill, Badge } from '@/ui/Badge'
import { Table, type Column } from '@/ui/Table'
import { QueryState } from '@/ui/QueryState'
import { memberCap } from '@/lib/format'
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
    { key: 'cap', header: 'Member cap', align: 'right', render: (c) => <span className="font-mono tnum">{memberCap(c.member_cap)}</span> },
    { key: 'plan', header: 'Plan', render: (c) => <Badge tone="neutral">{c.plan_name ?? TIER_LABEL[c.tier] ?? c.tier}</Badge> },
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

      <PersonSearch />

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

/**
 * Find a person in any cooperative — for KYC and support checks — and open
 * their profile in their own society, where viewing it is audited.
 */
function PersonSearch() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQuery(text), 300)
    return () => clearTimeout(t)
  }, [text])
  const { data: hits = [], isFetching } = usePlatformMemberSearch(query)
  const searching = query.trim().length >= 2

  return (
    <Card padded={false} className="mb-4">
      <div className="p-3">
        <div className="flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2">
          <Icon name="person_search" size={18} className="text-muted-2" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Find a person in any cooperative — name, member no., phone or email…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-2"
          />
          {isFetching && <span className="text-xs text-muted-2">Searching…</span>}
        </div>
      </div>
      {searching && !isFetching && hits.length === 0 && (
        <p className="border-t border-line px-5 py-3 text-sm text-muted">No one matches “{query.trim()}”.</p>
      )}
      {hits.length > 0 && (
        <div className="max-h-80 divide-y divide-line overflow-auto border-t border-line">
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => navigate(`/platform/cooperatives/${h.cooperative_id}?member=${h.id}`)}
              className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-sand"
            >
              <Avatar name={h.full_name} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  {h.full_name}
                  {h.kind === 'non_member' && <Badge tone="blue">Non-member</Badge>}
                </div>
                <div className="truncate text-xs text-muted-2">{h.email || h.phone || '—'}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-ink-soft">{h.cooperative_name}</div>
                <div className="font-mono text-xs text-muted-2">{h.member_no}</div>
              </div>
              <Icon name="chevron_right" size={18} className="text-muted-2" />
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}
