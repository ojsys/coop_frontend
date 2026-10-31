import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VerifiedBadge } from '@/ui/VerifiedBadge'
import { useMembers } from '@/api/hooks'
import { useAuth } from '@/auth/AuthContext'
import { useCreateMember, useBulkImportMembers, type ImportResult } from '@/api/mutations'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Avatar } from '@/ui/Avatar'
import { Badge, StatusPill } from '@/ui/Badge'
import { Table, Pagination, type Column } from '@/ui/Table'
import { QueryState } from '@/ui/QueryState'
import { Modal } from '@/ui/Modal'
import { Field } from '@/ui/Field'
import { memberMatches } from '@/lib/members'
import { MemberEditModal } from '../MemberEditModal'
import { naira } from '@/lib/format'
import type { Member } from '@/api/types'

const PAGE_SIZE = 10
const FILTERS = ['all', 'active', 'arrears', 'suspended', 'non-members', 'to verify'] as const
type Filter = (typeof FILTERS)[number]

export function MembersPage() {
  const navigate = useNavigate()
  const { activeMembership } = useAuth()
  // Reads stay open to every office-holder; writing a member (role included)
  // is privileged-only on the server, so don't offer controls that 403.
  const canManage = activeMembership?.is_privileged ?? false
  const { data: members = [], isLoading, isError } = useMembers()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)

  const awaitingCount = members.filter((m) => m.verification_status === 'awaiting').length

  const filtered = useMemo(() => {
    let rows = members
    if (filter === 'active') rows = rows.filter((m) => m.status === 'active')
    if (filter === 'suspended') rows = rows.filter((m) => m.status === 'suspended')
    if (filter === 'non-members') rows = rows.filter((m) => m.kind === 'non_member')
    if (filter === 'to verify') rows = rows.filter((m) => m.verification_status === 'awaiting')
    if (search) rows = rows.filter((m) => memberMatches(m, search))
    return rows
  }, [members, filter, search])

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const columns: Column<Member>[] = [
    {
      key: 'member',
      header: 'Member',
      render: (m) => (
        <div className="flex items-center gap-3">
          <Avatar name={m.full_name} size={34} />
          <div>
            <div className="flex items-center gap-2 font-medium text-ink">
              {m.full_name}
              <VerifiedBadge via={m.verified_via} size={16} />
              {m.verification_status === 'awaiting' && <Badge tone="gold">To verify</Badge>}
              {m.kind === 'non_member' && <Badge tone="blue">Non-member</Badge>}
            </div>
            <div className="font-mono text-xs text-muted-2">{m.member_no}</div>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (m) => m.role_name ?? '—' },
    { key: 'status', header: 'Status', render: (m) => <StatusPill status={m.status} /> },
    {
      key: 'share',
      header: 'Share capital',
      align: 'right',
      render: (m) => <span className="font-mono tnum">{naira(m.share_capital)}</span>,
    },
    {
      key: 'bal',
      header: 'Balance',
      align: 'right',
      render: (m) => <span className="font-mono tnum">{naira(m.savings_balance)}</span>,
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (m: Member) => (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditing(m)
                }}
                className="rounded-md p-1.5 text-muted-2 transition hover:bg-sand hover:text-ink"
                title="Edit member"
              >
                <Icon name="edit" size={18} />
              </button>
            ),
          },
        ]
      : []),
  ]

  const counts = {
    total: members.length,
    active: members.filter((m) => m.status === 'active').length,
    suspended: members.filter((m) => m.status === 'suspended').length,
    nonMembers: members.filter((m) => m.kind === 'non_member').length,
  }

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle={`${counts.total} total · ${counts.active} active · ${counts.suspended} suspended${counts.nonMembers ? ` · ${counts.nonMembers} non-member${counts.nonMembers === 1 ? '' : 's'}` : ''}`}
        actions={
          canManage ? (
            <>
              <Button variant="secondary" icon="upload_file" size="sm" onClick={() => setImportOpen(true)}>
                Import CSV
              </Button>
              <Button icon="person_add" size="sm" onClick={() => setAddOpen(true)}>
                Add person
              </Button>
            </>
          ) : undefined
        }
      />

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-line bg-paper px-3 py-2">
            <Icon name="search" size={18} className="text-muted-2" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search name, member no., phone or email…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-2"
            />
          </div>
          <div className="flex items-center gap-1 rounded-md bg-sand-deep p-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f)
                  setPage(1)
                }}
                className={`rounded px-3 py-1 text-[13px] font-medium capitalize transition ${
                  filter === f ? 'bg-card text-ink shadow-soft' : 'text-muted hover:text-ink'
                }`}
              >
                {f}
                {f === 'to verify' && awaitingCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-gold px-1.5 text-[11px] font-semibold text-paper">{awaitingCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <QueryState isLoading={isLoading} isError={isError}>
          <Table
            columns={columns}
            rows={paged}
            rowKey={(m) => m.id}
            onRowClick={(m) => navigate(`/console/members/${m.id}`)}
            empty={<span className="text-sm text-muted">No members match.</span>}
          />
          <div className="border-t border-line">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onPage={setPage}
            />
          </div>
        </QueryState>
      </Card>

      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} />
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
      <MemberEditModal member={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const importer = useBulkImportMembers()
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  // member_no is optional: left blank, the next number is assigned. Fill it
  // only to keep the numbers on an existing register.
  const TEMPLATE = 'full_name,email,phone,share_capital,role_slug,member_no\nAda Nwosu,ada@example.com,08030000000,50000,member,\n'

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'members-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { toast('Choose a CSV file', 'error'); return }
    try {
      const res = await importer.mutateAsync(file)
      setResult(res)
      toast(`Imported ${res.created} of ${res.total} members`)
    } catch (err) {
      toast(apiErrorMessage(err, 'Import failed'), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} width={560} title="Import members" subtitle="Bulk-add members from a CSV file">
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[13px]">
          <span className="text-muted">
            Columns: full_name, email, phone, share_capital, role_slug. Member numbers are assigned
            automatically; add a member_no column only to keep numbers from an existing register.
          </span>
          <button onClick={downloadTemplate} className="flex items-center gap-1 font-medium text-green hover:underline"><Icon name="download" size={15} /> Template</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input required type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null) }} className="text-sm" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Close</Button>
            <Button type="submit" size="sm" icon="upload" loading={importer.isPending}>Import</Button>
          </div>
        </form>

        {result && (
          <div className="rounded-lg border border-line p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <Icon name="check_circle" size={18} className="text-green-bright" fill />
              {result.created} created · {result.errors.length} skipped
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2 max-h-40 space-y-1 overflow-auto">
                {result.errors.map((er, i) => (
                  <div key={i} className="flex gap-2 text-xs text-danger">
                    <span className="font-mono">row {er.row}</span>
                    <span className="text-muted">{er.error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}


function AddMemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateMember()
  const toast = useToast()
  const [form, setForm] = useState({
    kind: 'member' as 'member' | 'non_member',
    full_name: '',
    email: '',
    phone: '',
    share_capital: '0',
  })
  const nonMember = form.kind === 'non_member'

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      // A non-member holds no shares, whatever is left in the field.
      await create.mutateAsync({ ...form, share_capital: nonMember ? '0' : form.share_capital, status: 'active' })
      toast(nonMember ? 'Non-member added' : 'Member added')
      onClose()
      setForm({ kind: 'member', full_name: '', email: '', phone: '', share_capital: '0' })
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not add member'), 'error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add person" subtitle="Register someone your society serves">
      <form onSubmit={submit} className="space-y-3.5">
        <div role="tablist" className="inline-flex rounded-full border border-line bg-paper p-1">
          {([['member', 'Member'], ['non_member', 'Non-member']] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={form.kind === k}
              onClick={() => set('kind', k)}
              className={`rounded-full px-3.5 py-1 text-sm font-semibold transition ${form.kind === k ? 'bg-green text-paper' : 'text-muted hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {nonMember && (
          <p className="rounded-lg bg-sand-deep px-3 py-2 text-xs text-muted">
            Someone your society serves who has not joined. They can borrow on
            loan products open to non-members, save, use the app and receive
            announcements — but hold no shares, cannot vote or hold office, and
            receive no dividends. You can convert them to a member later.
          </p>
        )}
        {!nonMember && (
          <Field label="Share capital (₦)">
            <input value={form.share_capital} onChange={(e) => set('share_capital', e.target.value)} className="input" inputMode="decimal" />
          </Field>
        )}
        <Field label="Full name">
          <input required value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className="input" placeholder="Ada Nwosu" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="input" placeholder="ada@email.com" />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="input" placeholder="0803…" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={create.isPending}>
            {nonMember ? 'Add non-member' : 'Add member'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
