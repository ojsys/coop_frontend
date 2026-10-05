import { useAuth } from '@/auth/AuthContext'
import { useResolutions } from '@/api/hooks'
import { useResolutionAction } from '@/api/mutations'
import { outbox } from '@/api/outbox'
import { useToast } from '@/ui/toast'
import { MemberHeader } from '../MemberShell'
import { Icon } from '@/ui/Icon'
import { Badge } from '@/ui/Badge'
import type { Resolution } from '@/api/types'

export function VotePage() {
  const { data: resolutions = [] } = useResolutions()

  return (
    <div>
      <MemberHeader title="Vote" subtitle="One member, one vote" />
      <div className="space-y-3 px-5">
        {resolutions.map((r) => (
          <ResolutionCard key={r.id} r={r} />
        ))}
        {resolutions.length === 0 && (
          <p className="rounded-2xl border border-line bg-card px-4 py-10 text-center text-sm text-muted">
            No resolutions to vote on right now.
          </p>
        )}
      </div>
    </div>
  )
}

function ResolutionCard({ r }: { r: Resolution }) {
  const { activeMembership } = useAuth()
  const action = useResolutionAction()
  const toast = useToast()
  const open = r.status === 'open'
  const res = r.results ?? { for: 0, against: 0, abstain: 0 }
  const total = res.for + res.against + res.abstain
  const forPct = total ? Math.round((res.for / total) * 100) : 0

  function queueVote(choice: string) {
    // Queue the ballot; it replays idempotently on reconnect (the unique-ballot
    // constraint means a duplicate replay is a no-op).
    outbox.enqueue({
      kind: 'vote',
      label: `Vote "${choice}" on ${r.title}`,
      url: `/resolutions/${r.id}/vote/`,
      body: { choice, membership: activeMembership?.id },
      cooperativeId: activeMembership?.cooperative_id ?? null,
    })
    toast("Vote saved — will sync when you're back online")
  }

  async function vote(choice: 'for' | 'against' | 'abstain') {
    if (!navigator.onLine) {
      queueVote(choice)
      return
    }
    try {
      await action.mutateAsync({
        id: r.id,
        action: 'vote',
        body: { choice, membership: activeMembership?.id },
      })
      toast(`Vote recorded: ${choice}`)
    } catch (e) {
      const resp = (e as { response?: { data?: { detail?: string } } }).response
      if (!resp) queueVote(choice) // connection dropped mid-request
      else toast(resp.data?.detail ?? 'Could not record vote', 'error')
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">
          Resolution
        </span>
        <Badge tone={open ? 'gold' : 'neutral'} dot>
          {open ? 'Needs your vote' : r.status}
        </Badge>
      </div>
      <h3 className="mt-1.5 font-display text-[15px] font-semibold leading-snug text-ink">
        {r.title}
      </h3>
      {r.description && <p className="mt-1 text-[13px] text-muted">{r.description}</p>}

      {open && r.my_vote ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 px-3.5 py-2.5 text-[13px] font-medium text-ink">
          <Icon name="check_circle" size={18} className="text-green-bright" fill />
          You voted: {r.my_vote.charAt(0).toUpperCase() + r.my_vote.slice(1)}
        </div>
      ) : open ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <VoteBtn icon="thumb_up" label="For" tone="green" onClick={() => vote('for')} busy={action.isPending} />
          <VoteBtn icon="thumb_down" label="Against" tone="danger" onClick={() => vote('against')} busy={action.isPending} />
          <VoteBtn icon="remove" label="Abstain" tone="neutral" onClick={() => vote('abstain')} busy={action.isPending} />
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-green-bright">{res.for} for ({forPct}%)</span>
            <span className="text-muted">{res.against} against</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand-deep">
            <div className="h-full rounded-full bg-green-bright" style={{ width: `${forPct}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

function VoteBtn({
  icon,
  label,
  tone,
  onClick,
  busy,
}: {
  icon: string
  label: string
  tone: 'green' | 'danger' | 'neutral'
  onClick: () => void
  busy: boolean
}) {
  const cls = {
    green: 'border-green-100 bg-green-50 text-green',
    danger: 'border-danger-50 bg-danger-50 text-danger',
    neutral: 'border-line bg-sand text-muted',
  }[tone]
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[12px] font-semibold transition active:scale-95 disabled:opacity-60 ${cls}`}
    >
      <Icon name={icon} size={20} />
      {label}
    </button>
  )
}
