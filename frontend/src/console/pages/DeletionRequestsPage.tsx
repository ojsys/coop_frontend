import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Modal } from '@/ui/Modal'
import { Badge } from '@/ui/Badge'
import { QueryState } from '@/ui/QueryState'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { dateTime, longDate } from '@/lib/format'
import {
  useCompleteDeletion,
  useDeletionRequests,
  type DeletionRequest,
} from '@/api/dataRights'

const TABS: { key: DeletionRequest['status']; label: string }[] = [
  { key: 'pending', label: 'Waiting' },
  { key: 'completed', label: 'Deleted' },
  { key: 'cancelled', label: 'Cancelled' },
]

/** 30 days from the request — what the privacy notice promises. */
function dueBy(createdAt: string) {
  const d = new Date(createdAt)
  d.setDate(d.getDate() + 30)
  return d
}

export function DeletionRequestsPage() {
  const [tab, setTab] = useState<DeletionRequest['status']>('pending')
  const { data = [], isLoading, isError } = useDeletionRequests(tab)
  const [confirming, setConfirming] = useState<DeletionRequest | null>(null)

  return (
    <div>
      <PageHeader
        title="Deletion requests"
        subtitle="Members asking for their account and personal data to be deleted — due within 30 days"
      />

      <div className="mb-4 rounded-lg border border-green-100 bg-green-50 p-3.5 text-[13px] text-ink-soft">
        <Icon name="info" size={16} className="mr-1 inline text-green" />
        Settle anything listed first — pay out savings, return share capital, close loans, hand over an
        office. Deleting erases their sign-in, contact, personal and bank details, photo and documents. Your
        ledger, contribution and loan history stay, under their member number.
      </div>

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
          <Card><p className="py-6 text-center text-sm text-muted">Nothing here.</p></Card>
        ) : (
          <div className="space-y-3">
            {data.map((r) => {
              const overdue = r.status === 'pending' && dueBy(r.created_at) < new Date()
              return (
                <Card key={r.id}>
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
                        {r.membership_id ? (
                          <Link to={`/console/members/${r.membership_id}`} className="hover:underline">{r.full_name}</Link>
                        ) : r.full_name}
                        {r.member_no && <span className="font-mono text-xs font-normal text-muted-2">{r.member_no}</span>}
                        {overdue && <Badge tone="danger">Overdue</Badge>}
                      </div>
                      <div className="mt-0.5 text-[13px] text-muted">{r.email}</div>
                      {r.reason && (
                        <p className="mt-2 rounded-md bg-sand px-3 py-2 text-[13px] text-ink-soft">{r.reason}</p>
                      )}
                      <div className="mt-2 text-xs text-muted-2">
                        Requested {dateTime(r.created_at)} {r.source === 'web' ? 'on the website' : 'in the app'}
                        {r.status === 'pending' && ` · due by ${longDate(dueBy(r.created_at).toISOString())}`}
                        {r.completed_at && ` · deleted ${dateTime(r.completed_at)} by ${r.completed_by_name ?? '—'}`}
                      </div>
                      {r.blockers.length > 0 && (
                        <ul className="mt-2.5 space-y-1 text-[13px] text-ink-soft">
                          {r.blockers.map((b, i) => (
                            <li key={i} className="flex gap-2">
                              <Icon name="schedule" size={16} className="mt-0.5 shrink-0 text-gold-deep" />
                              <span>{b.cooperative && <strong>{b.cooperative}: </strong>}{b.message}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {r.status === 'pending' && (
                      <Button size="sm" variant="danger" icon="person_remove" disabled={r.blockers.length > 0}
                        onClick={() => setConfirming(r)}>
                        {r.blockers.length > 0 ? 'Settle first' : 'Delete account'}
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </QueryState>

      <ConfirmModal request={confirming} onClose={() => setConfirming(null)} />
    </div>
  )
}

function ConfirmModal({ request, onClose }: { request: DeletionRequest | null; onClose: () => void }) {
  const complete = useCompleteDeletion()
  const toast = useToast()

  async function go() {
    if (!request) return
    try {
      await complete.mutateAsync(request.id)
      toast(`${request.full_name}'s account has been deleted`)
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not delete the account'), 'error')
    }
  }

  return (
    <Modal open={Boolean(request)} onClose={onClose} title="Delete this account?" subtitle={request?.full_name}>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          This can't be undone. Their sign-in, contact details, personal and bank details, photo and documents
          are erased in every cooperative they belong to, and they're emailed to say it's done. Financial
          records stay under member number <strong className="text-ink-soft">{request?.member_no}</strong>.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="danger" loading={complete.isPending} onClick={go}>Delete account</Button>
        </div>
      </div>
    </Modal>
  )
}
