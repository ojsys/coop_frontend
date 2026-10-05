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
                    <div className="font-display text-[15px] font-semibold text-ink">
                      {r.full_name}
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
  const [memberNo, setMemberNo] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!request) return
    setError(null)
    try {
      await approve.mutateAsync({ id: request.id, member_no: memberNo.trim() })
      toast(`${request.full_name} has been admitted`)
      setMemberNo('')
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
          This creates their account and emails them a link to set their own
          password. We never send a password itself.
        </p>

        <Field label="Member number" hint="Must be unique within your society.">
          <input required autoFocus value={memberNo} className={inputClass}
            onChange={(e) => setMemberNo(e.target.value)} placeholder="IMC-0848" />
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
