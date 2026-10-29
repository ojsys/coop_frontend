import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MEMBER_AUDIENCES,
  MEMBER_EMAILS_PAGE_SIZE,
  PLACEHOLDER_HINT,
  PURPOSES,
  type MemberEmail,
  type MemberEmailAudience,
  type MemberEmailPurpose,
  type MemberRecipientStatus,
  useDeleteMemberEmail,
  useMemberEmail,
  useMemberEmailRecipients,
  useMemberEmails,
  useMemberRecipientPreview,
  useRetryFailedMemberEmail,
  useSaveMemberEmail,
  useSendMemberEmail,
  useTestMemberEmail,
} from '@/api/memberEmail'
import { useMembers, useRoles } from '@/api/hooks'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Badge, type Tone } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Field, Select } from '@/ui/Field'
import { Icon } from '@/ui/Icon'
import { Modal } from '@/ui/Modal'
import { QueryState } from '@/ui/QueryState'
import { Pagination, Table, type Column } from '@/ui/Table'
import { MemberSearchSelect } from '@/ui/MemberSearchSelect'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { dateTime, num } from '@/lib/format'

/**
 * Email from the society's officers to its members: everyone, one role,
 * borrowers or those behind on a repayment, or people picked by hand. Each
 * member's own figures fill the placeholders, members who opted out of email
 * are left out, and every send keeps a per-recipient record of what went.
 */

const STATUS_TONE: Record<MemberEmail['status'], Tone> = {
  draft: 'neutral',
  sending: 'gold',
  sent: 'green',
}

const RECIPIENT_TONE: Record<MemberRecipientStatus, Tone> = {
  pending: 'gold',
  sent: 'green',
  failed: 'danger',
}

const PLACEHOLDERS = ['first_name', 'name', 'member_no', 'loan_balance', 'amount_overdue', 'next_due_date', 'cooperative']

type Composing = null | { draftId?: number; memberId?: number }

export function EmailPage() {
  const { activeMembership } = useAuth()
  const canSend = activeMembership?.is_privileged ?? false
  const [params, setParams] = useSearchParams()
  const linkedMember = Number(params.get('member')) || undefined
  const [page, setPage] = useState(1)
  const { data, isLoading, isError } = useMemberEmails(page)
  const rows = data?.results ?? []
  const [composing, setComposing] = useState<Composing>(linkedMember ? { memberId: linkedMember } : null)
  const [viewing, setViewing] = useState<number | null>(null)

  function closeComposer() {
    setComposing(null)
    if (params.has('member')) setParams({}, { replace: true })
  }

  if (!canSend) {
    return (
      <div>
        <PageHeader title="Email" subtitle="Write to your members." />
        <Card>
          <p className="text-sm text-muted">Emailing members is for officers who can manage members.</p>
        </Card>
      </div>
    )
  }

  const columns: Column<MemberEmail>[] = [
    {
      key: 'subject',
      header: 'Subject',
      render: (e) => (
        <div>
          <div className="font-medium text-ink">{e.subject || <span className="text-muted-2">(no subject)</span>}</div>
          <div className="text-[12px] text-muted">
            {e.purpose_display} ·{' '}
            {e.audience === 'role' && e.audience_role_name
              ? e.audience_role_name
              : e.audience === 'selected'
                ? `${num(e.members.length)} selected`
                : e.audience_display}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => <Badge tone={STATUS_TONE[e.status]} dot>{e.status_display}</Badge>,
    },
    {
      key: 'reach',
      header: 'Recipients',
      render: (e) =>
        e.status === 'draft' ? (
          <span className="text-muted-2">—</span>
        ) : (
          <span className="text-[13px]">
            {num(e.sent_count)} of {num(e.recipient_count)} sent
            {e.failed_count > 0 && <span className="ml-1.5 text-danger">· {num(e.failed_count)} failed</span>}
          </span>
        ),
    },
    {
      key: 'when',
      header: 'When',
      render: (e) => (
        <span className="text-[13px] text-muted">
          {e.sent_at ? `Sent ${dateTime(e.sent_at)}` : `Saved ${dateTime(e.updated_at)}`}
          {(e.sent_by_name || e.created_by_name) && ` · ${e.sent_by_name || e.created_by_name}`}
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Email"
        subtitle="Write to your members — announcements, reminders, or a nudge to borrowers behind on a repayment."
        actions={<Button icon="edit" onClick={() => setComposing({})}>New email</Button>}
      />

      <Card padded={false}>
        <QueryState isLoading={isLoading} isError={isError} minHeight={200}>
          <Table
            columns={columns}
            rows={rows}
            rowKey={(e) => e.id}
            onRowClick={(e) => (e.status === 'draft' ? setComposing({ draftId: e.id }) : setViewing(e.id))}
            empty={<span className="text-sm text-muted">No emails yet. Start with “New email”.</span>}
          />
          {(data?.count ?? 0) > 0 && (
            <div className="border-t border-line px-4 py-3">
              <Pagination page={page} pageSize={MEMBER_EMAILS_PAGE_SIZE} total={data?.count ?? 0} onPage={setPage} />
            </div>
          )}
        </QueryState>
      </Card>

      {composing && composing.draftId == null && (
        <Composer memberId={composing.memberId} onClose={closeComposer} onSent={setViewing} />
      )}
      {composing?.draftId != null && (
        <DraftLoader id={composing.draftId} onClose={closeComposer} onSent={setViewing} />
      )}
      {viewing != null && <EmailDetail id={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function DraftLoader({ id, onClose, onSent }: { id: number; onClose: () => void; onSent: (id: number) => void }) {
  const { data, isLoading, isError } = useMemberEmail(id)
  if (!data) {
    return (
      <Modal open onClose={onClose} title="Email">
        <QueryState isLoading={isLoading} isError={isError} minHeight={160}>{null}</QueryState>
      </Modal>
    )
  }
  return <Composer draft={data} onClose={onClose} onSent={onSent} />
}

// ── Compose ─────────────────────────────────────────────────────────────────
function Composer({
  draft,
  memberId,
  onClose,
  onSent,
}: {
  draft?: MemberEmail
  memberId?: number
  onClose: () => void
  onSent: (id: number) => void
}) {
  const toast = useToast()
  const save = useSaveMemberEmail()
  const remove = useDeleteMemberEmail()
  const test = useTestMemberEmail()
  const send = useSendMemberEmail()
  const { data: members = [] } = useMembers()
  const { data: roles = [] } = useRoles()
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const starter = PURPOSES[0]
  const [id, setId] = useState<number | undefined>(draft?.id)
  const [purpose, setPurpose] = useState<MemberEmailPurpose>(draft?.purpose ?? 'announcement')
  const [subject, setSubject] = useState(draft?.subject ?? starter.subject)
  const [body, setBody] = useState(draft?.body ?? starter.body)
  // Whether the officer has written anything of their own: until then,
  // switching purpose swaps in that purpose's starting text.
  const [touched, setTouched] = useState(draft != null)
  const [audience, setAudience] = useState<MemberEmailAudience>(
    draft?.audience ?? (memberId ? 'selected' : 'all'),
  )
  const [roleId, setRoleId] = useState<number | null>(draft?.audience_role ?? null)
  const [memberIds, setMemberIds] = useState<number[]>(draft?.members ?? (memberId ? [memberId] : []))
  const [confirming, setConfirming] = useState(false)
  const [progress, setProgress] = useState<MemberEmail | null>(null)

  const ready =
    audience === 'selected' ? memberIds.length > 0 : audience === 'role' ? roleId != null : true
  const preview = useMemberRecipientPreview(
    {
      audience,
      audience_role: audience === 'role' ? roleId : null,
      members: audience === 'selected' ? memberIds : [],
    },
    ready,
  )
  const count = ready ? (preview.data?.count ?? 0) : 0

  function choosePurpose(value: MemberEmailPurpose) {
    setPurpose(value)
    const p = PURPOSES.find((x) => x.value === value)!
    if (!touched) {
      setSubject(p.subject)
      setBody(p.body)
    }
    // Recovery goes to borrowers behind on a repayment unless the officer has
    // already chosen particular people.
    if (p.audience && audience !== 'selected') setAudience(p.audience)
  }

  function insert(tag: string) {
    const token = `{{${tag}}}`
    const el = bodyRef.current
    const start = el?.selectionStart ?? body.length
    const end = el?.selectionEnd ?? body.length
    setBody(body.slice(0, start) + token + body.slice(end))
    setTouched(true)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  function input() {
    return {
      purpose,
      subject,
      body,
      audience,
      audience_role: audience === 'role' ? roleId : null,
      members: audience === 'selected' ? memberIds : [],
    }
  }

  async function persist() {
    const saved = await save.mutateAsync({ id, ...input() })
    setId(saved.id)
    return saved
  }

  async function onSave() {
    try {
      await persist()
      toast('Draft saved')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not save the draft'), 'error')
    }
  }

  async function onTest() {
    try {
      const saved = await persist()
      const res = await test.mutateAsync(saved.id)
      toast(res.detail)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not send the test'), 'error')
    }
  }

  async function onSend() {
    try {
      const saved = await persist()
      const done = await send.mutateAsync({ id: saved.id, onProgress: setProgress })
      toast(
        done.failed_count
          ? `Sent to ${done.sent_count} — ${done.failed_count} failed`
          : `Sent to ${done.sent_count} member${done.sent_count === 1 ? '' : 's'}`,
        done.failed_count ? 'error' : undefined,
      )
      onClose()
      onSent(saved.id)
    } catch (err) {
      setConfirming(false)
      setProgress(null)
      toast(apiErrorMessage(err, 'Could not send'), 'error')
    }
  }

  async function onDelete() {
    if (!id) return onClose()
    try {
      await remove.mutateAsync(id)
      toast('Draft deleted')
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not delete the draft'), 'error')
    }
  }

  const canSend = subject.trim() && body.trim() && count > 0
  const busy = save.isPending || send.isPending

  if (send.isPending) {
    const total = progress?.recipient_count ?? count
    const done = (progress?.sent_count ?? 0) + (progress?.failed_count ?? 0)
    return (
      <Modal open onClose={() => {}} title="Sending…" subtitle={subject}>
        <div className="space-y-3 py-2">
          <div className="h-2 overflow-hidden rounded-full bg-sand-deep">
            <div
              className="h-full rounded-full bg-green transition-all"
              style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
            />
          </div>
          <p className="text-[13px] text-muted">
            {num(done)} of {num(total)} done. Keep this window open — if it closes, the rest is
            finished by the scheduled job.
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title={id ? 'Edit draft' : 'New email'} width={760}>
      <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
        <Field label="Purpose" interactive>
          <div className="flex flex-wrap gap-2">
            {PURPOSES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => choosePurpose(p.value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
                  purpose === p.value ? 'border-green bg-green-50 text-green' : 'border-line bg-paper text-ink-soft hover:bg-sand/60'
                }`}
              >
                <Icon name={p.icon} size={16} />
                {p.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="To" interactive>
          <div className="grid gap-2 sm:grid-cols-2">
            {MEMBER_AUDIENCES.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => setAudience(a.value)}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  audience === a.value ? 'border-green bg-green-50' : 'border-line bg-paper hover:bg-sand/60'
                }`}
              >
                <div className="text-[13px] font-semibold text-ink">{a.label}</div>
                <div className="text-[12px] text-muted">{a.hint}</div>
              </button>
            ))}
          </div>
        </Field>

        {audience === 'role' && (
          <Field label="Role">
            <Select
              value={roleId == null ? '' : String(roleId)}
              onChange={(e) => setRoleId(e.target.value ? Number(e.target.value) : null)}
              options={[{ value: '', label: 'Choose a role…' }, ...roles.map((r) => ({ value: String(r.id), label: r.name }))]}
            />
          </Field>
        )}

        {audience === 'selected' && (
          <Field label="Members" interactive>
            <div className="space-y-2">
              {memberIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {memberIds.map((mid) => {
                    const m = members.find((x) => x.id === mid)
                    return (
                      <span key={mid} className="inline-flex items-center gap-1 rounded-full bg-sand-deep px-2.5 py-1 text-[12px] text-ink-soft">
                        {m ? m.full_name : `#${mid}`}
                        {m && <span className="font-mono text-muted-2">{m.member_no}</span>}
                        <button
                          type="button"
                          className="text-muted-2 hover:text-ink"
                          onClick={() => setMemberIds(memberIds.filter((x) => x !== mid))}
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
              <MemberSearchSelect
                members={members.filter((m) => !memberIds.includes(m.id))}
                value=""
                placeholder="Add a member by name, member no., phone or email…"
                onChange={(v) => {
                  const mid = Number(v)
                  if (mid && !memberIds.includes(mid)) setMemberIds([...memberIds, mid])
                }}
              />
            </div>
          </Field>
        )}

        <RecipientsBox
          ready={ready}
          loading={preview.isLoading && ready}
          count={count}
          optedOut={ready ? (preview.data?.opted_out ?? 0) : 0}
          noEmail={ready ? (preview.data?.no_email ?? 0) : 0}
          recipients={ready ? (preview.data?.recipients ?? []) : []}
          hint={audience === 'role' ? 'Choose a role to see who will receive this.' : 'Add a member to see who will receive this.'}
        />

        <Field label="Subject">
          <input
            value={subject}
            maxLength={200}
            onChange={(e) => {
              setSubject(e.target.value)
              setTouched(true)
            }}
            className="input"
          />
        </Field>
        <Field
          label="Message"
          interactive
          hint={`Plain text. A blank line starts a paragraph, “- ” a bullet, **bold**, [text](https://…) a link. Filled in for each member: ${PLACEHOLDER_HINT}.`}
        >
          <div className="space-y-2">
            <textarea
              ref={bodyRef}
              rows={10}
              value={body}
              onChange={(e) => {
                setBody(e.target.value)
                setTouched(true)
              }}
              className="input"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-muted">Insert:</span>
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => insert(p)}
                  className="rounded-md bg-sand-deep px-2 py-0.5 font-mono text-[11px] text-ink-soft transition hover:bg-sand"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" icon="delete" onClick={onDelete} loading={remove.isPending}>
          {id ? 'Delete draft' : 'Discard'}
        </Button>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-ink-soft">
              Send to {num(count)} member{count === 1 ? '' : 's'}? This cannot be undone.
            </span>
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>Back</Button>
            <Button size="sm" icon="send" loading={busy} onClick={onSend}>Send now</Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onSave} loading={save.isPending}>Save draft</Button>
            <Button
              variant="secondary"
              size="sm"
              icon="outgoing_mail"
              disabled={!subject.trim() || !body.trim()}
              loading={test.isPending}
              onClick={onTest}
            >
              Send me a test
            </Button>
            <Button size="sm" icon="send" disabled={!canSend} onClick={() => setConfirming(true)}>
              Send…
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

function RecipientsBox({
  ready,
  loading,
  count,
  optedOut,
  noEmail,
  recipients,
  hint,
}: {
  ready: boolean
  loading: boolean
  count: number
  optedOut: number
  noEmail: number
  recipients: { address: string; name: string; member_no: string; role_name: string }[]
  hint: string
}) {
  const [open, setOpen] = useState(false)

  if (!ready) {
    return <p className="rounded-lg bg-sand/60 px-3 py-2 text-[13px] text-muted">{hint}</p>
  }

  const left = [
    optedOut > 0 && `${num(optedOut)} opted out of email`,
    noEmail > 0 && `${num(noEmail)} with no email address`,
  ].filter(Boolean)

  return (
    <div className="rounded-lg border border-line">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-[13px] text-ink-soft">
          {loading ? (
            'Working out recipients…'
          ) : (
            <>
              <span className="font-semibold text-ink">{num(count)}</span> member{count === 1 ? '' : 's'} will receive this
              {left.length > 0 && <span className="text-muted"> · left out: {left.join(', ')}</span>}
            </>
          )}
        </span>
        {recipients.length > 0 && (
          <button type="button" className="shrink-0 text-[13px] font-medium text-green hover:underline" onClick={() => setOpen(!open)}>
            {open ? 'Hide list' : 'Show list'}
          </button>
        )}
      </div>
      {open && recipients.length > 0 && (
        <ul className="max-h-56 divide-y divide-line/60 overflow-y-auto border-t border-line">
          {recipients.slice(0, 200).map((r) => (
            <li key={r.address} className="flex items-center gap-2.5 px-3 py-1.5 text-[13px]">
              <span className="min-w-0 flex-1 truncate text-ink">
                {r.name || r.address}
                {r.name && <span className="ml-1.5 text-muted">{r.address}</span>}
              </span>
              <span className="shrink-0 font-mono text-[12px] text-muted">{r.member_no}</span>
            </li>
          ))}
        </ul>
      )}
      {open && recipients.length > 200 && (
        <p className="border-t border-line px-3 py-1.5 text-[12px] text-muted">Showing the first 200.</p>
      )}
    </div>
  )
}

// ── A sent email ────────────────────────────────────────────────────────────
function EmailDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const toast = useToast()
  const { data: email, isLoading, isError } = useMemberEmail(id)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const rows = useMemberEmailRecipients(id, status, page)
  const retry = useRetryFailedMemberEmail()
  const send = useSendMemberEmail()

  async function resume() {
    try {
      const done = await send.mutateAsync({ id })
      toast(done.failed_count ? `${done.failed_count} failed` : 'All sent', done.failed_count ? 'error' : undefined)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not send'), 'error')
    }
  }

  async function onRetry() {
    try {
      await retry.mutateAsync(id)
      await resume()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not retry'), 'error')
    }
  }

  const columns: Column<NonNullable<typeof rows.data>['results'][number]>[] = [
    {
      key: 'who',
      header: 'Member',
      render: (r) => (
        <div>
          <div className="text-ink">{r.name || r.address}</div>
          {r.name && <div className="text-[12px] text-muted">{r.address}</div>}
        </div>
      ),
    },
    {
      key: 'no',
      header: 'Member no.',
      render: (r) => <span className="font-mono text-[12px] text-muted">{r.member_no || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge tone={RECIPIENT_TONE[r.status]} dot>{r.status_display}</Badge>,
    },
  ]

  return (
    <Modal
      open
      onClose={onClose}
      title={email?.subject ?? 'Email'}
      width={760}
      subtitle={
        email
          ? `${email.purpose_display} · ${email.audience_role_name ?? email.audience_display}${email.sent_at ? ` · sent ${dateTime(email.sent_at)}` : ''}${email.sent_by_name ? ` by ${email.sent_by_name}` : ''}`
          : undefined
      }
    >
      <QueryState isLoading={isLoading} isError={isError} minHeight={200}>
        {email && (
          <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Sent', value: email.sent_count, tone: 'text-green' },
                { label: 'Failed', value: email.failed_count, tone: email.failed_count ? 'text-danger' : 'text-ink' },
                { label: 'Pending', value: email.pending_count, tone: 'text-ink' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-line px-3 py-2">
                  <div className={`font-display text-xl font-semibold ${s.tone}`}>{num(s.value)}</div>
                  <div className="text-[12px] text-muted">{s.label}</div>
                </div>
              ))}
            </div>

            {(email.pending_count > 0 || email.failed_count > 0) && (
              <div className="flex flex-wrap justify-end gap-2">
                {email.pending_count > 0 && (
                  <Button size="sm" icon="send" loading={send.isPending} onClick={resume}>
                    Finish sending
                  </Button>
                )}
                {email.failed_count > 0 && email.pending_count === 0 && (
                  <Button size="sm" variant="secondary" icon="refresh" loading={retry.isPending || send.isPending} onClick={onRetry}>
                    Retry {num(email.failed_count)} failed
                  </Button>
                )}
              </div>
            )}

            <div className="whitespace-pre-line rounded-lg bg-sand/50 px-3.5 py-3 text-[13px] text-ink-soft">
              {email.body}
            </div>

            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                {[
                  { key: '', label: 'All' },
                  { key: 'sent', label: 'Sent' },
                  { key: 'failed', label: 'Failed' },
                  { key: 'pending', label: 'Pending' },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => {
                      setStatus(f.key)
                      setPage(1)
                    }}
                    className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                      status === f.key ? 'bg-green text-paper' : 'bg-sand-deep text-ink-soft hover:bg-sand'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="rounded-lg border border-line">
                <Table
                  columns={columns}
                  rows={rows.data?.results ?? []}
                  rowKey={(r) => r.id}
                  empty={<span className="text-sm text-muted">Nobody here.</span>}
                />
                {(rows.data?.count ?? 0) > MEMBER_EMAILS_PAGE_SIZE && (
                  <div className="border-t border-line px-4 py-3">
                    <Pagination page={page} pageSize={MEMBER_EMAILS_PAGE_SIZE} total={rows.data?.count ?? 0} onPage={setPage} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </QueryState>
    </Modal>
  )
}
