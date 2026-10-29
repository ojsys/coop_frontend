import { useState } from 'react'
import {
  AUDIENCES,
  EMAILS_PAGE_SIZE,
  type EmailAudience,
  type PlatformEmail,
  type RecipientStatus,
  useDeletePlatformEmail,
  useEmailRecipients,
  usePlatformEmail,
  usePlatformEmails,
  useRecipientPreview,
  useRetryFailedEmail,
  useSavePlatformEmail,
  useSendPlatformEmail,
  useTestPlatformEmail,
} from '@/api/platformEmail'
import { useCooperatives } from '@/api/hooks'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Badge, type Tone } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Icon } from '@/ui/Icon'
import { Modal } from '@/ui/Modal'
import { QueryState } from '@/ui/QueryState'
import { Pagination, Table, type Column } from '@/ui/Table'
import { CooperativeSearchSelect } from '@/ui/CooperativeSearchSelect'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { dateTime, num } from '@/lib/format'

/**
 * Email from the platform team to cooperatives' officers: one cooperative's
 * exco, a hand-picked list, or everyone at once. A message goes to each
 * cooperative's current privileged officers (and its contact address unless
 * particular officers were picked), and every send keeps a per-recipient
 * record of what went and what failed.
 */

const STATUS_TONE: Record<PlatformEmail['status'], Tone> = {
  draft: 'neutral',
  sending: 'gold',
  sent: 'green',
}

const RECIPIENT_TONE: Record<RecipientStatus, Tone> = {
  pending: 'gold',
  sent: 'green',
  failed: 'danger',
}

export function EmailPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError } = usePlatformEmails(page)
  const rows = data?.results ?? []
  // null: closed; 'new': a blank draft; a number: that draft.
  const [composing, setComposing] = useState<'new' | number | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)

  const columns: Column<PlatformEmail>[] = [
    {
      key: 'subject',
      header: 'Subject',
      render: (e) => (
        <div>
          <div className="font-medium text-ink">{e.subject || <span className="text-muted-2">(no subject)</span>}</div>
          <div className="text-[12px] text-muted">
            {e.audience === 'selected' && e.cooperative_names.length
              ? e.cooperative_names.slice(0, 2).join(', ') +
                (e.cooperative_names.length > 2 ? ` +${e.cooperative_names.length - 2}` : '')
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
        subtitle="Write to cooperatives' officers — one society's exco, a chosen few, or every cooperative at once."
        actions={<Button icon="edit" onClick={() => setComposing('new')}>New email</Button>}
      />

      <Card padded={false}>
        <QueryState isLoading={isLoading} isError={isError} minHeight={200}>
          <Table
            columns={columns}
            rows={rows}
            rowKey={(e) => e.id}
            onRowClick={(e) => (e.status === 'draft' ? setComposing(e.id) : setViewing(e.id))}
            empty={<span className="text-sm text-muted">No emails yet. Start with “New email”.</span>}
          />
          {(data?.count ?? 0) > 0 && (
            <div className="border-t border-line px-4 py-3">
              <Pagination page={page} pageSize={EMAILS_PAGE_SIZE} total={data?.count ?? 0} onPage={setPage} />
            </div>
          )}
        </QueryState>
      </Card>

      {composing === 'new' && <Composer onClose={() => setComposing(null)} onSent={setViewing} />}
      {typeof composing === 'number' && (
        <DraftLoader id={composing} onClose={() => setComposing(null)} onSent={setViewing} />
      )}
      {viewing != null && <EmailDetail id={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function DraftLoader({ id, onClose, onSent }: { id: number; onClose: () => void; onSent: (id: number) => void }) {
  const { data, isLoading, isError } = usePlatformEmail(id)
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
  onClose,
  onSent,
}: {
  draft?: PlatformEmail
  onClose: () => void
  onSent: (id: number) => void
}) {
  const toast = useToast()
  const save = useSavePlatformEmail()
  const remove = useDeletePlatformEmail()
  const test = useTestPlatformEmail()
  const send = useSendPlatformEmail()
  const { data: allCoops = [] } = useCooperatives()

  const [id, setId] = useState<number | undefined>(draft?.id)
  const [subject, setSubject] = useState(draft?.subject ?? '')
  const [body, setBody] = useState(draft?.body ?? '')
  const [audience, setAudience] = useState<EmailAudience>(draft?.audience ?? 'selected')
  const [coopIds, setCoopIds] = useState<number[]>(draft?.cooperatives ?? [])
  // null: every officer of the chosen cooperatives. A set: only these people.
  const [picked, setPicked] = useState<Set<number> | null>(
    draft?.only_users.length ? new Set(draft.only_users) : null,
  )
  const [includeContact, setIncludeContact] = useState(draft?.include_contact_email ?? true)
  const [confirming, setConfirming] = useState(false)
  const [progress, setProgress] = useState<PlatformEmail | null>(null)

  const selected = audience === 'selected'
  const preview = useRecipientPreview(
    { audience, cooperatives: coopIds, only_users: [], include_contact_email: includeContact },
    !selected || coopIds.length > 0,
  )
  const recipients = preview.data?.recipients ?? []
  const officerIds = recipients.filter((r) => r.user_id != null).map((r) => r.user_id as number)
  const narrowed = selected && picked != null && officerIds.some((uid) => !picked.has(uid))
  const finalCount = narrowed
    ? officerIds.filter((uid) => picked!.has(uid)).length
    : (preview.data?.count ?? 0)

  function input() {
    const onlyUsers = narrowed ? officerIds.filter((uid) => picked!.has(uid)) : []
    return {
      subject,
      body,
      audience,
      cooperatives: selected ? coopIds : [],
      only_users: onlyUsers,
      include_contact_email: includeContact,
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
          : `Sent to ${done.sent_count} recipient${done.sent_count === 1 ? '' : 's'}`,
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

  function toggleOfficer(uid: number) {
    const next = new Set(picked ?? officerIds)
    if (next.has(uid)) next.delete(uid)
    else next.add(uid)
    setPicked(next)
  }

  const canSend = subject.trim() && body.trim() && finalCount > 0
  const busy = save.isPending || send.isPending

  if (send.isPending) {
    const total = progress?.recipient_count ?? finalCount
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
        <Field label="To">
          <div className="grid gap-2 sm:grid-cols-2">
            {AUDIENCES.map((a) => (
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

        {selected && (
          <Field label="Cooperatives">
            <div className="space-y-2">
              {coopIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {coopIds.map((cid) => (
                    <span key={cid} className="inline-flex items-center gap-1 rounded-full bg-sand-deep px-2.5 py-1 text-[12px] text-ink-soft">
                      {allCoops.find((c) => c.id === cid)?.name ?? `#${cid}`}
                      <button
                        type="button"
                        className="text-muted-2 hover:text-ink"
                        onClick={() => {
                          setCoopIds(coopIds.filter((x) => x !== cid))
                          setPicked(null)
                        }}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <CooperativeSearchSelect
                value={null}
                placeholder="Add a cooperative…"
                onChange={(cid) => {
                  if (cid != null && !coopIds.includes(cid)) {
                    setCoopIds([...coopIds, cid])
                    setPicked(null)
                  }
                }}
              />
            </div>
          </Field>
        )}

        <label className="flex items-start gap-2 text-[13px] text-ink-soft">
          <input
            type="checkbox"
            checked={includeContact}
            onChange={(e) => setIncludeContact(e.target.checked)}
            className="mt-0.5 accent-green"
          />
          <span>
            Also write to each cooperative's contact address
            {narrowed && <span className="block text-muted">Not when particular officers are picked.</span>}
          </span>
        </label>

        <RecipientsBox
          loading={preview.isLoading && (!selected || coopIds.length > 0)}
          empty={selected && coopIds.length === 0}
          count={finalCount}
          coopCount={preview.data?.cooperative_count ?? 0}
          recipients={recipients}
          pickable={selected}
          isPicked={(uid) => picked == null || picked.has(uid)}
          onToggle={toggleOfficer}
          narrowed={narrowed}
        />

        <Field label="Subject">
          <input value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} className="input" />
        </Field>
        <Field
          label="Message"
          hint="Plain text. A blank line starts a paragraph, “- ” a bullet, **bold**, [text](https://…) a link. {{name}} and {{cooperative}} are filled in for each person."
        >
          <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} className="input" />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" icon="delete" onClick={onDelete} loading={remove.isPending}>
          {id ? 'Delete draft' : 'Discard'}
        </Button>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-ink-soft">
              Send to {num(finalCount)} recipient{finalCount === 1 ? '' : 's'}? This cannot be undone.
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
  loading,
  empty,
  count,
  coopCount,
  recipients,
  pickable,
  isPicked,
  onToggle,
  narrowed,
}: {
  loading: boolean
  empty: boolean
  count: number
  coopCount: number
  recipients: { address: string; name: string; capacity: string; cooperative_name: string; user_id: number | null }[]
  pickable: boolean
  isPicked: (uid: number) => boolean
  onToggle: (uid: number) => void
  narrowed: boolean
}) {
  const [open, setOpen] = useState(false)
  const shown = pickable ? recipients : open ? recipients.slice(0, 200) : []

  if (empty) {
    return <p className="rounded-lg bg-sand/60 px-3 py-2 text-[13px] text-muted">Add a cooperative to see who will receive this.</p>
  }

  return (
    <div className="rounded-lg border border-line">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-[13px] text-ink-soft">
          {loading ? (
            'Working out recipients…'
          ) : (
            <>
              <span className="font-semibold text-ink">{num(count)}</span> recipient{count === 1 ? '' : 's'}
              {!narrowed && coopCount > 0 && <> across {num(coopCount)} cooperative{coopCount === 1 ? '' : 's'}</>}
            </>
          )}
        </span>
        {!pickable && recipients.length > 0 && (
          <button type="button" className="text-[13px] font-medium text-green hover:underline" onClick={() => setOpen(!open)}>
            {open ? 'Hide list' : 'Show list'}
          </button>
        )}
      </div>
      {shown.length > 0 && (
        <ul className="max-h-56 divide-y divide-line/60 overflow-y-auto border-t border-line">
          {shown.map((r) => (
            <li key={r.address} className="flex items-center gap-2.5 px-3 py-1.5 text-[13px]">
              {pickable &&
                (r.user_id != null ? (
                  <input
                    type="checkbox"
                    checked={isPicked(r.user_id)}
                    onChange={() => onToggle(r.user_id as number)}
                    className="accent-green"
                  />
                ) : (
                  <span className="w-[13px]" />
                ))}
              <span className={`min-w-0 flex-1 truncate ${pickable && narrowed && r.user_id == null ? 'text-muted-2 line-through' : 'text-ink'}`}>
                {r.name || r.address}
                {r.name && <span className="ml-1.5 text-muted">{r.address}</span>}
              </span>
              <span className="shrink-0 text-[12px] text-muted">
                {r.capacity} · {r.cooperative_name}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!pickable && open && recipients.length > 200 && (
        <p className="border-t border-line px-3 py-1.5 text-[12px] text-muted">
          Showing the first 200.
        </p>
      )}
    </div>
  )
}

// ── A sent email ────────────────────────────────────────────────────────────
function EmailDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const toast = useToast()
  const { data: email, isLoading, isError } = usePlatformEmail(id)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const rows = useEmailRecipients(id, status, page)
  const retry = useRetryFailedEmail()
  const send = useSendPlatformEmail()

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
      header: 'Recipient',
      render: (r) => (
        <div>
          <div className="text-ink">{r.name || r.address}</div>
          {r.name && <div className="text-[12px] text-muted">{r.address}</div>}
        </div>
      ),
    },
    {
      key: 'coop',
      header: 'Cooperative',
      render: (r) => (
        <span className="text-[13px]">
          {r.cooperative_name ?? '—'}
          {r.capacity && <span className="block text-[12px] text-muted">{r.capacity}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge tone={RECIPIENT_TONE[r.status]} dot>{r.status_display}</Badge>,
    },
  ]

  return (
    <Modal open onClose={onClose} title={email?.subject ?? 'Email'} width={760}
      subtitle={email ? `${email.audience_display}${email.sent_at ? ` · sent ${dateTime(email.sent_at)}` : ''}${email.sent_by_name ? ` by ${email.sent_by_name}` : ''}` : undefined}>
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
                {(rows.data?.count ?? 0) > EMAILS_PAGE_SIZE && (
                  <div className="border-t border-line px-4 py-3">
                    <Pagination page={page} pageSize={EMAILS_PAGE_SIZE} total={rows.data?.count ?? 0} onPage={setPage} />
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
