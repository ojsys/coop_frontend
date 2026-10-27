import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Badge, type Tone } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Modal } from '@/ui/Modal'
import { QueryState } from '@/ui/QueryState'
import { Table, type Column } from '@/ui/Table'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { dateTime } from '@/lib/format'
import {
  useDecideVerification,
  usePlatformVerification,
  usePlatformVerifications,
  type PlatformVerification,
} from '@/api/verification'

/**
 * Reviewing cooperatives' KYC.
 *
 * Every society is live from signup; this queue is the one human check left,
 * and it decides only whether the platform will move money for the society.
 * Approving or requesting changes is audited and emails its officers.
 */

const FILTERS = [
  { key: 'submitted', label: 'Awaiting review' },
  { key: 'changes_requested', label: 'Changes requested' },
  { key: 'not_started', label: 'Not started' },
  { key: 'verified', label: 'Verified' },
  { key: '', label: 'All' },
]

const TONE: Record<string, Tone> = {
  not_started: 'neutral',
  submitted: 'gold',
  verified: 'green',
  changes_requested: 'danger',
}

export function VerificationQueuePage() {
  const [status, setStatus] = useState('submitted')
  const { data: rows = [], isLoading, isError } = usePlatformVerifications(status)
  const [open, setOpen] = useState<number | null>(null)

  const columns: Column<PlatformVerification>[] = [
    {
      key: 'coop',
      header: 'Cooperative',
      render: (r) => <span className="font-medium text-ink">{r.cooperative_name}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge tone={TONE[r.status]} dot>{r.status_display}</Badge>,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (r) =>
        r.submitted_at ? (
          <span className="text-[13px] text-muted">
            {dateTime(r.submitted_at)}
            {r.submitted_by_name && ` · ${r.submitted_by_name}`}
          </span>
        ) : (
          <span className="text-muted-2">—</span>
        ),
    },
    {
      key: 'reviewed',
      header: 'Reviewed',
      render: (r) =>
        r.reviewed_at ? (
          <span className="text-[13px] text-muted">
            {dateTime(r.reviewed_at)}
            {r.reviewed_by_name && ` · ${r.reviewed_by_name}`}
          </span>
        ) : (
          <span className="text-muted-2">—</span>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Verification"
        subtitle="Cooperatives' KYC. Approving opens online payments and payouts for them — nothing else waits on it."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatus(f.key)}
            className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
              status === f.key ? 'bg-green text-paper' : 'bg-sand-deep text-ink-soft hover:bg-sand'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card padded={false}>
        <QueryState isLoading={isLoading} isError={isError} minHeight={200}>
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => setOpen(r.cooperative_id)}
            empty={<span className="text-sm text-muted">Nothing here.</span>}
          />
        </QueryState>
      </Card>

      {open != null && <ReviewModal cooperativeId={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function ReviewModal({ cooperativeId, onClose }: { cooperativeId: number; onClose: () => void }) {
  const { data, isLoading, isError } = usePlatformVerification(cooperativeId)
  const decide = useDecideVerification()
  const toast = useToast()
  const [note, setNote] = useState('')
  const [asking, setAsking] = useState(false)

  const docsFor = (membershipId: number) =>
    (data?.officer_documents ?? []).filter((d) => d.membership === membershipId)

  async function act(outcome: 'approve' | 'request-changes') {
    try {
      await decide.mutateAsync({ cooperativeId, outcome, note })
      toast(outcome === 'approve' ? `${data?.cooperative_name} is verified` : 'Changes requested')
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not record the decision'), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title={data?.cooperative_name ?? 'Verification'} width={640}
      subtitle={data ? `${data.status_display}${data.registration_no ? ` · Reg. no. ${data.registration_no}` : ''}` : undefined}>
      <QueryState isLoading={isLoading} isError={isError} minHeight={200}>
        {data && (
          <div className="max-h-[65vh] space-y-5 overflow-y-auto">
            <section>
              <h4 className="mb-2 text-[13px] font-semibold text-ink">Exco</h4>
              <ul className="space-y-2">
                {data.checklist.officers.map((o) => (
                  <li key={o.role_slug} className="rounded-lg border border-line px-3 py-2">
                    <div className="text-[13px] font-semibold text-ink">{o.role_name}</div>
                    {o.holders.length === 0 && <p className="text-[13px] text-danger">Vacant</p>}
                    {o.holders.map((h) => (
                      <div key={h.membership_id} className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
                        <span className="text-ink-soft">{h.full_name}</span>
                        <span className="text-muted">{h.email}</span>
                        {docsFor(h.membership_id).map((d) => (
                          <a key={d.id} href={d.file} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-green hover:underline">
                            <Icon name="description" size={15} /> {d.doc_type_display}
                          </a>
                        ))}
                        {!h.has_id && <Badge tone="gold">No ID</Badge>}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h4 className="mb-2 text-[13px] font-semibold text-ink">Cooperative papers</h4>
              {data.documents.length === 0 ? (
                <p className="text-[13px] text-muted">None uploaded.</p>
              ) : (
                <ul className="space-y-1">
                  {data.documents.map((d) => (
                    <li key={d.id}>
                      <a href={d.file} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[13px] text-green hover:underline">
                        <Icon name="description" size={15} /> {d.doc_type_display}
                      </a>
                      <span className="ml-2 text-[12px] text-muted">{dateTime(d.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {data.reviewer_note && (
              <p className="rounded-lg bg-sand/60 px-3 py-2 text-[13px] text-ink-soft">
                Last note: “{data.reviewer_note}”
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <Link to={`/platform/cooperatives/${cooperativeId}`} className="text-[13px] font-medium text-green hover:underline">
                Open the cooperative
              </Link>
              {data.status === 'submitted' && !asking && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setAsking(true)}>
                    Request changes
                  </Button>
                  <Button size="sm" icon="verified" loading={decide.isPending} onClick={() => act('approve')}>
                    Approve
                  </Button>
                </div>
              )}
            </div>

            {asking && (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  autoFocus
                  value={note}
                  maxLength={500}
                  className="input"
                  placeholder="What needs changing? The officers see this note."
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
                  <Button size="sm" loading={decide.isPending} disabled={!note.trim()}
                    onClick={() => act('request-changes')}>
                    Send to the officers
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </QueryState>
    </Modal>
  )
}
