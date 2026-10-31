import { useState } from 'react'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Modal } from '@/ui/Modal'
import { Field } from '@/ui/Field'
import { QueryState } from '@/ui/QueryState'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { dateTime } from '@/lib/format'
import { useAuth } from '@/auth/AuthContext'
import { useCooperative } from '@/api/hooks'
import { useUpdateCooperative } from '@/api/mutations'
import {
  useJoinRequests,
  useJoinRequestDecision,
  type JoinRequest,
  type JoinRequestStatus,
} from '@/api/signup'

const TABS: { key: JoinRequestStatus; label: string }[] = [
  { key: 'pending', label: 'Awaiting decision' },
  { key: 'approved', label: 'Admitted' },
  { key: 'rejected', label: 'Declined' },
]

const inputClass =
  'w-full rounded-md border border-line bg-card px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-green focus:ring-2 focus:ring-green/15'

export function JoinRequestsPage() {
  const [tab, setTab] = useState<JoinRequestStatus>('pending')
  const { data = [], isLoading, isError } = useJoinRequests(tab)
  const [approving, setApproving] = useState<JoinRequest | null>(null)
  const [declining, setDeclining] = useState<JoinRequest | null>(null)

  return (
    <div>
      <PageHeader
        title="Join requests"
        subtitle="People asking to be admitted to your society"
      />

      <InviteLinkCard />

      <div className="mb-4 flex flex-wrap items-center gap-1 rounded-lg border border-line bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key ? 'bg-green-50 text-green' : 'text-muted hover:bg-sand-deep'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <QueryState isLoading={isLoading} isError={isError}>
        {data.length === 0 ? (
          <Card>
            <p className="py-6 text-center text-sm text-muted">
              {tab === 'pending'
                ? 'No requests waiting. New ones arrive from the public join form and are emailed to you.'
                : 'Nothing here yet.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.map((r) => (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-display text-[15px] font-semibold text-ink">
                      {r.full_name}
                      {r.status === 'pending' && r.has_account && (
                        <span title="Already on CooperativeOS — a member of another society. Admitting them adds yours to their account."
                          className="rounded-full bg-green-50 px-2 py-0.5 font-sans text-[11px] font-medium text-green">
                          Has an account
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted">
                      {r.email}
                      {r.phone && <span className="text-muted-2"> · {r.phone}</span>}
                    </div>
                    {r.message && (
                      <p className="mt-2 rounded-md bg-sand px-3 py-2 text-[13px] leading-relaxed text-ink-soft">
                        {r.message}
                      </p>
                    )}
                    <div className="mt-2 text-xs text-muted-2">
                      Requested {dateTime(r.created_at)}
                      {r.status !== 'pending' && r.decided_by_name && (
                        <> · {r.status === 'approved' ? 'admitted' : 'declined'} by{' '}
                          {r.decided_by_name}</>
                      )}
                      {r.member_no && <> · member {r.member_no}</>}
                    </div>
                    {r.decision_note && (
                      <div className="mt-1 text-xs text-muted-2">
                        Note: {r.decision_note}
                      </div>
                    )}
                  </div>

                  {r.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" icon="close"
                        onClick={() => setDeclining(r)}>
                        Decline
                      </Button>
                      <Button size="sm" icon="how_to_reg"
                        onClick={() => setApproving(r)}>
                        Admit
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </QueryState>

      <ApproveModal request={approving} onClose={() => setApproving(null)} />
      <DeclineModal request={declining} onClose={() => setDeclining(null)} />
    </div>
  )
}

function ApproveModal({
  request,
  onClose,
}: {
  request: JoinRequest | null
  onClose: () => void
}) {
  const { approve } = useJoinRequestDecision()
  const toast = useToast()
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!request) return
    setError(null)
    try {
      await approve.mutateAsync({ id: request.id })
      toast(`${request.full_name} has been admitted`)
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not admit this member.'))
    }
  }

  return (
    <Modal
      open={Boolean(request)}
      onClose={onClose}
      title="Admit member"
      subtitle={request?.full_name}
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          {request?.has_account
            ? 'They already have a CooperativeOS account. Admitting them adds your society to it, and we email them to say they can switch to it.'
            : 'This creates their account and emails them a link to set their own password. We never send a password itself.'}
        </p>

        <p className="text-sm leading-relaxed text-muted">
          Their member number is assigned automatically, next in your society’s sequence.
        </p>

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-sm text-danger">
            <Icon name="error" size={18} /> <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={approve.isPending}>
            Admit member
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function DeclineModal({
  request,
  onClose,
}: {
  request: JoinRequest | null
  onClose: () => void
}) {
  const { reject } = useJoinRequestDecision()
  const toast = useToast()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!request) return
    setError(null)
    try {
      await reject.mutateAsync({ id: request.id, note: note.trim() })
      toast('Request declined')
      setNote('')
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not decline this request.'))
    }
  }

  return (
    <Modal
      open={Boolean(request)}
      onClose={onClose}
      title="Decline request"
      subtitle={request?.full_name}
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          No account is created. They can apply again later.
        </p>

        <Field label="Reason" hint="Optional — kept for your own records.">
          <textarea rows={3} value={note} className={inputClass}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Not a member of this society" />
        </Field>

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-sm text-danger">
            <Icon name="error" size={18} /> <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" variant="danger" loading={reject.isPending}>
            Decline
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Turns whatever an officer types into something that works in a link:
 *  "Ìmọ̀lè Farmers!" → "imole-farmers". The server validates the same rule. */
function toJoinCode(raw: string) {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 50)
}

function joinUrl(code: string) {
  return `${window.location.origin}/join/${code}`
}

/** The society's invite link: the members it is sent to land on the join form
 *  with the society already chosen, instead of having to search for it. */
function InviteLinkCard() {
  const { activeCooperativeId } = useAuth()
  const { data: coop } = useCooperative(activeCooperativeId ?? undefined)
  const update = useUpdateCooperative()
  const toast = useToast()
  const [editing, setEditing] = useState(false)

  if (!coop?.join_code) return null
  const url = joinUrl(coop.join_code)
  const enabled = coop.join_link_enabled ?? true
  const shareText = `Join ${coop.name} on our members' app: ${url}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast('Invite link copied')
    } catch {
      toast('Could not copy — select the link and copy it instead', 'error')
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `Join ${coop!.name}`, text: shareText })
    } catch {
      // Dismissing the share sheet rejects too; nothing to report.
    }
  }

  async function toggle() {
    try {
      await update.mutateAsync({ id: coop!.id, join_link_enabled: !enabled })
      toast(enabled ? 'Invite link switched off' : 'Invite link switched on')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not update the invite link.'), 'error')
    }
  }

  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
            <Icon name="link" size={19} className="text-green" />
            Invite link
            {!enabled && (
              <span className="rounded-full bg-sand-deep px-2 py-0.5 text-[11px] font-medium text-muted">
                Off
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {enabled
              ? 'Share this with your members. It opens the join form with your society already chosen — their request still comes here for you to admit.'
              : 'Switched off — the link shows as inactive and members have to search for your society instead.'}
          </p>
        </div>
        <Button size="sm" variant="ghost" loading={update.isPending} onClick={toggle}>
          {enabled ? 'Switch off' : 'Switch on'}
        </Button>
      </div>

      {enabled && (
        <>
          <div className="mt-4 flex items-center gap-2 rounded-md border border-line bg-sand px-3.5 py-2.5">
            <code className="min-w-0 flex-1 select-all truncate font-mono text-[13px] text-ink">
              {url}
            </code>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" icon="content_copy" onClick={copy}>
              Copy link
            </Button>
            {'share' in navigator && (
              <Button size="sm" variant="secondary" icon="share" onClick={share}>
                Share
              </Button>
            )}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-3 py-1.5 text-sm font-semibold text-ink-soft transition hover:bg-sand"
            >
              <Icon name="chat" size={17} /> WhatsApp
            </a>
            <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(true)}>
              Customise
            </Button>
          </div>
        </>
      )}

      <CustomiseLinkModal
        open={editing}
        onClose={() => setEditing(false)}
        cooperativeId={coop.id}
        current={coop.join_code}
      />
    </Card>
  )
}

function CustomiseLinkModal({
  open,
  onClose,
  cooperativeId,
  current,
}: {
  open: boolean
  onClose: () => void
  cooperativeId: number
  current: string
}) {
  const update = useUpdateCooperative()
  const toast = useToast()
  const [code, setCode] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const cleaned = code.replace(/-+$/, '')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await update.mutateAsync({ id: cooperativeId, join_code: cleaned })
      toast('Invite link updated')
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save that link.'))
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Customise invite link">
      <form onSubmit={submit} className="space-y-4">
        <Field
          label="Link ending"
          hint="Letters, numbers and hyphens — something easy to say at a meeting."
        >
          <input
            required
            autoFocus
            minLength={3}
            value={code}
            className={inputClass}
            onChange={(e) => setCode(toJoinCode(e.target.value))}
            placeholder="imole-farmers"
          />
        </Field>

        <div className="rounded-md bg-sand px-3.5 py-2.5 font-mono text-[13px] text-ink-soft">
          {joinUrl(cleaned || '…')}
        </div>

        {cleaned !== current && (
          <p className="text-[13px] leading-relaxed text-muted">
            The old link stops working as soon as you save. Anyone you already
            sent it to will need the new one.
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-sm text-danger">
            <Icon name="error" size={18} /> <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={update.isPending}
            disabled={cleaned.length < 3 || cleaned === current}
          >
            Save link
          </Button>
        </div>
      </form>
    </Modal>
  )
}
