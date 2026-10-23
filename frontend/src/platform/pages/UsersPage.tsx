import { useEffect, useState } from 'react'
import {
  PLATFORM_USERS_PAGE_SIZE,
  type PlatformUser,
  usePlatformUserActivity,
  usePlatformUsers,
  useSendPlatformUserResetLink,
  useSetPlatformUserPassword,
  useUpdatePlatformUser,
} from '@/api/platformUsers'
import type { AuditLog } from '@/api/types'
import { PageHeader } from '@/ui/PageHeader'
import { Card, CardHeader } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Avatar } from '@/ui/Avatar'
import { Badge } from '@/ui/Badge'
import { Field } from '@/ui/Field'
import { Modal } from '@/ui/Modal'
import { Pagination, Table, type Column } from '@/ui/Table'
import { QueryState } from '@/ui/QueryState'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { dateTime, timeAgo } from '@/lib/format'

/**
 * Every account on the platform, for helping people who cannot help
 * themselves — a misspelt name, a wrong email address, a forgotten password
 * with no way into the inbox the reset link goes to. Each change is recorded
 * in the audit log against the staff member who made it.
 */
export function UsersPage() {
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<PlatformUser | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(text.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [text])

  const { data, isLoading, isError, isFetching } = usePlatformUsers(search, page)
  const rows = data?.results ?? []

  const columns: Column<PlatformUser>[] = [
    {
      key: 'person',
      header: 'Person',
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.full_name} size={32} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-medium text-ink">
              {u.full_name}
              {u.is_platform_admin && <Badge tone="gold">Platform staff</Badge>}
              {!u.is_active && <Badge tone="danger">Inactive</Badge>}
            </div>
            <div className="truncate text-xs text-muted-2">{u.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (u) => <span className="font-mono text-xs">{u.phone || '—'}</span> },
    {
      key: 'coops',
      header: 'Cooperatives',
      render: (u) =>
        u.memberships.length === 0 ? (
          <span className="text-muted-2">—</span>
        ) : (
          <span className="text-ink-soft">
            {u.memberships[0].cooperative_name}
            {u.memberships.length > 1 && <span className="text-muted-2"> +{u.memberships.length - 1}</span>}
          </span>
        ),
    },
    { key: 'login', header: 'Last sign-in', render: (u) => (u.last_login ? timeAgo(u.last_login) : 'Never') },
    { key: 'chev', header: '', align: 'right', render: () => <Icon name="chevron_right" size={20} className="text-faint" /> },
  ]

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Correct a person's name or contact details, or reset their password for them. Every change is logged."
      />

      <Card padded={false} className="mb-6">
        <div className="flex items-center gap-2 border-b border-line p-3">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-line bg-paper px-3 py-2">
            <Icon name="search" size={18} className="text-muted-2" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Search name, email, phone or member no.…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-2"
            />
            {isFetching && <span className="text-xs text-muted-2">Searching…</span>}
          </div>
        </div>
        <QueryState isLoading={isLoading} isError={isError}>
          <Table
            columns={columns}
            rows={rows}
            rowKey={(u) => u.id}
            onRowClick={setSelected}
            empty={<span className="text-sm text-muted">{search ? `No one matches “${search}”.` : 'No accounts yet.'}</span>}
          />
          {(data?.count ?? 0) > PLATFORM_USERS_PAGE_SIZE && (
            <div className="border-t border-line">
              <Pagination page={page} pageSize={PLATFORM_USERS_PAGE_SIZE} total={data?.count ?? 0} onPage={setPage} />
            </div>
          )}
        </QueryState>
      </Card>

      <RecentChanges />

      {selected && <UserModal key={selected.id} user={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

const ACTION_LABEL: Record<string, string> = {
  'platform.user_updated': 'Details changed by staff',
  'platform.user_password_set': 'Password set by staff',
  'platform.user_reset_link_sent': 'Reset link sent by staff',
  'account.password_changed': 'Changed own password',
  'account.password_reset': 'Reset own password by email',
}

const FIELD_LABEL: Record<string, string> = { full_name: 'Name', email: 'Email', phone: 'Phone' }

function describeChange(e: AuditLog): string | null {
  if (e.action !== 'platform.user_updated') return null
  const before = (e.before ?? {}) as Record<string, string>
  const after = (e.after ?? {}) as Record<string, string>
  return Object.keys(after)
    .map((f) => `${FIELD_LABEL[f] ?? f}: “${before[f] || '—'}” → “${after[f] || '—'}”`)
    .join(' · ')
}

function ActivityList({ entries, showSubject }: { entries: AuditLog[]; showSubject?: boolean }) {
  if (entries.length === 0) return <p className="py-2 text-sm text-muted">Nothing recorded yet.</p>
  return (
    <ul className="divide-y divide-line">
      {entries.map((e) => {
        const detail = describeChange(e)
        return (
          <li key={e.id} className="flex items-start justify-between gap-4 py-2.5">
            <div className="min-w-0">
              <div className="text-sm text-ink">
                {ACTION_LABEL[e.action] ?? e.action}
                {showSubject && <span className="text-muted"> · {e.entity_repr}</span>}
              </div>
              {detail && <div className="mt-0.5 break-words text-xs text-muted">{detail}</div>}
              <div className="mt-0.5 text-xs text-muted-2">by {e.actor_name || 'System'}</div>
            </div>
            <span className="shrink-0 text-xs text-muted-2" title={dateTime(e.created_at)}>
              {timeAgo(e.created_at)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function RecentChanges() {
  const { data = [], isLoading, isError } = usePlatformUserActivity()
  return (
    <Card>
      <CardHeader title="Account changes by staff" subtitle="Every edit and password reset made from this page, newest first." />
      <QueryState isLoading={isLoading} isError={isError}>
        <ActivityList entries={data} showSubject />
      </QueryState>
    </Card>
  )
}

function UserModal({ user, onClose }: { user: PlatformUser; onClose: () => void }) {
  const toast = useToast()
  const update = useUpdatePlatformUser()
  const setPassword = useSetPlatformUserPassword()
  const sendLink = useSendPlatformUserResetLink()
  const history = usePlatformUserActivity(user.id)

  const [saved, setSaved] = useState({ full_name: user.full_name, email: user.email, phone: user.phone })
  const [form, setForm] = useState(saved)
  const [password, setPw] = useState('')
  const [showPw, setShowPw] = useState(false)

  const dirty = form.full_name !== saved.full_name || form.email !== saved.email || form.phone !== saved.phone

  async function save() {
    try {
      const res = await update.mutateAsync({ id: user.id, ...form })
      const next = { full_name: res.full_name, email: res.email, phone: res.phone }
      setSaved(next)
      setForm(next)
      toast('Details saved')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not save these details'), 'error')
    }
  }

  async function applyPassword() {
    try {
      const res = await setPassword.mutateAsync({ id: user.id, password })
      setPw('')
      toast(res.detail)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not set the password'), 'error')
    }
  }

  async function emailLink() {
    try {
      const res = await sendLink.mutateAsync(user.id)
      toast(res.detail)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not send the reset link'), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title={user.full_name} subtitle={user.email} width={620}>
      <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
        {user.memberships.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {user.memberships.map((m) => (
              <Badge key={m.cooperative_id} tone="neutral">
                {m.cooperative_name}
                {m.member_no && ` · ${m.member_no}`}
                {m.role && ` · ${m.role}`}
              </Badge>
            ))}
          </div>
        )}

        {user.is_superuser && (
          <p className="rounded-md bg-gold-50 px-3 py-2 text-sm text-gold-deep">
            This is a superuser account. Only another superuser can change it.
          </p>
        )}

        <section>
          <h4 className="mb-3 font-display text-[15px] font-semibold text-ink">Details</h4>
          <div className="space-y-3">
            <Field label="Full name">
              <input className="input" value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="Email" hint="This is the address they sign in with.">
              <input className="input" type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className="input" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <div className="flex justify-end">
              <Button size="sm" icon="save" onClick={save} loading={update.isPending} disabled={!dirty}>
                Save details
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t border-line pt-5">
          <h4 className="font-display text-[15px] font-semibold text-ink">Password</h4>
          <p className="mb-3 mt-0.5 text-[13px] text-muted">
            If they can reach their inbox, email them a reset link. Otherwise set a password here and pass it to
            them yourself — they are signed out on every device.
          </p>
          <div className="mb-4">
            <Button size="sm" variant="secondary" icon="forward_to_inbox" onClick={emailLink}
              loading={sendLink.isPending}>
              Email a reset link
            </Button>
          </div>
          <Field label="Set a new password" hint="At least 8 characters, not all numbers, and not too common.">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input className="input pr-10" type={showPw ? 'text' : 'password'} value={password}
                  autoComplete="new-password" onChange={(e) => setPw(e.target.value)} />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-2 flex items-center text-muted-2 hover:text-ink"
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  <Icon name={showPw ? 'visibility_off' : 'visibility'} size={18} />
                </button>
              </div>
              <Button size="sm" variant="danger" icon="lock_reset" onClick={applyPassword}
                loading={setPassword.isPending} disabled={password.length < 8}>
                Set password
              </Button>
            </div>
          </Field>
        </section>

        <section className="border-t border-line pt-5">
          <h4 className="mb-1 font-display text-[15px] font-semibold text-ink">History</h4>
          <QueryState isLoading={history.isLoading} isError={history.isError}>
            <ActivityList entries={history.data ?? []} />
          </QueryState>
        </section>
      </div>
    </Modal>
  )
}
