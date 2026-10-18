import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import { Modal } from '@/ui/Modal'
import { Icon } from '@/ui/Icon'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'
import { Field } from '@/ui/Field'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import {
  useJoinAnother,
  useMyJoinRequests,
  useSocietySearch,
  useWithdrawJoinRequest,
  type PublicSociety,
} from '@/api/signup'

/**
 * Every cooperative this account belongs to, one tap to switch, and asking to
 * join another with the same account. Shared by the member app and the console.
 */

/** Make another of your societies the active one, and land somewhere that
 *  makes sense for it: in the console only if you hold office there. */
export function useSwitchCooperative() {
  const { user, setActiveCooperativeId } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (id: number) => {
    const m = user?.memberships.find((x) => x.cooperative_id === id)
    setActiveCooperativeId(id)
    // Every cached read belongs to the society it was fetched for.
    qc.clear()
    navigate(pathname.startsWith('/console') && m?.is_officer ? '/console' : '/app')
  }
}

function CoopMark({ logo, name, color }: { logo?: string | null; name: string; color?: string }) {
  return logo ? (
    <img src={logo} alt="" className="size-10 shrink-0 rounded-lg border border-line bg-card object-contain" />
  ) : (
    <span
      className="flex size-10 shrink-0 items-center justify-center rounded-lg font-display text-sm font-semibold text-paper"
      style={{ backgroundColor: color || '#0B4F3A' }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

export function CooperativesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, activeMembership, refresh } = useAuth()
  const switchTo = useSwitchCooperative()
  const requests = useMyJoinRequests(open)
  const withdraw = useWithdrawJoinRequest()
  const toast = useToast()
  const [joining, setJoining] = useState(false)

  // A society that admitted you since you signed in should be here to pick.
  useEffect(() => {
    if (open) refresh().catch(() => {})
    else setJoining(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const memberships = user?.memberships ?? []
  const waiting = (requests.data ?? []).filter((r) => r.status === 'pending')
  const declined = (requests.data ?? []).filter((r) => r.status === 'rejected').slice(0, 3)

  if (joining) {
    return (
      <Modal open={open} onClose={onClose} title="Join another cooperative"
        subtitle="With the account you already have — nothing new to sign up for">
        <JoinAnother
          exclude={[...memberships.map((m) => m.cooperative_id), ...waiting.map((r) => r.cooperative_id)]}
          onBack={() => setJoining(false)}
        />
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Your cooperatives"
      subtitle={memberships.length > 1 ? 'Tap one to switch to it' : undefined}>
      <div className="space-y-1.5">
        {memberships.map((m) => {
          const current = m.cooperative_id === activeMembership?.cooperative_id
          return (
            <button
              key={m.cooperative_id}
              onClick={() => { if (!current) switchTo(m.cooperative_id); onClose() }}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                current ? 'border-green bg-green-50' : 'border-line hover:border-green hover:bg-sand'
              }`}
            >
              <CoopMark logo={m.cooperative_logo} name={m.cooperative_name} color={m.cooperative_brand_color} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{m.cooperative_name}</div>
                <div className="truncate text-xs text-muted">
                  {m.member_no} · {m.kind === 'non_member' ? 'Non-member' : m.role_name ?? 'Member'}
                </div>
              </div>
              {current
                ? <Icon name="check_circle" size={20} fill className="shrink-0 text-green" />
                : <Icon name="chevron_right" size={20} className="shrink-0 text-muted-2" />}
            </button>
          )
        })}
      </div>

      {(waiting.length > 0 || declined.length > 0) && (
        <div className="mt-4">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-2">Your requests</div>
          <div className="space-y-1.5">
            {waiting.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-dashed border-line px-3 py-2.5">
                <CoopMark logo={r.cooperative_logo} name={r.cooperative_name} color="#8A8478" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{r.cooperative_name}</div>
                  <div className="text-xs text-muted">Waiting for an officer to admit you</div>
                </div>
                <button
                  className="shrink-0 text-xs font-medium text-muted hover:text-danger"
                  disabled={withdraw.isPending}
                  onClick={async () => {
                    try { await withdraw.mutateAsync(r.id); toast('Request withdrawn') }
                    catch (err) { toast(apiErrorMessage(err, 'Could not withdraw it'), 'error') }
                  }}
                >
                  Withdraw
                </button>
              </div>
            ))}
            {declined.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                <CoopMark logo={r.cooperative_logo} name={r.cooperative_name} color="#8A8478" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{r.cooperative_name}</div>
                  <div className="truncate text-xs text-muted">{r.decision_note || 'Not admitted'}</div>
                </div>
                <Badge tone="neutral">Declined</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button variant="secondary" icon="add" className="mt-4 w-full" onClick={() => setJoining(true)}>
        Join another cooperative
      </Button>
    </Modal>
  )
}

function JoinAnother({ exclude, onBack }: { exclude: number[]; onBack: () => void }) {
  const join = useJoinAnother()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [code, setCode] = useState('')
  const [picked, setPicked] = useState<PublicSociety | null>(null)
  const [message, setMessage] = useState('')
  const results = useSocietySearch(picked ? '' : query)
  const found = (results.data ?? []).filter((s) => !exclude.includes(s.id))

  async function send(e: React.FormEvent) {
    e.preventDefault()
    try {
      const r = await join.mutateAsync(picked ? { cooperative: picked.id, message } : { code, message })
      toast(`Request sent to ${r.cooperative_name}`)
      onBack()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not send your request'), 'error')
    }
  }

  return (
    <form onSubmit={send} className="space-y-3.5">
      {picked ? (
        <div className="flex items-center gap-3 rounded-xl border border-green bg-green-50 px-3 py-2.5">
          <Icon name="check_circle" size={20} className="shrink-0 text-green" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">{picked.name}</div>
            <div className="truncate text-xs text-muted">{[picked.lga, picked.state].filter(Boolean).join(', ')}</div>
          </div>
          <button type="button" onClick={() => setPicked(null)} className="text-sm font-medium text-green hover:underline">Change</button>
        </div>
      ) : (
        <>
          <Field label="Find the cooperative" interactive htmlFor="join-search">
            <div className="relative">
              <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
              <input id="join-search" autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setCode('') }}
                className="input pl-10" placeholder="Search by name" />
            </div>
            {query.trim().length >= 2 && (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-line bg-card">
                {results.isLoading && <p className="px-3.5 py-2.5 text-sm text-muted">Searching…</p>}
                {results.data && found.length === 0 && (
                  <p className="px-3.5 py-2.5 text-sm text-muted">
                    No live cooperative you can join matches that name. Ask an officer for its invite link.
                  </p>
                )}
                {found.map((s) => (
                  <button key={s.id} type="button" onClick={() => setPicked(s)}
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition hover:bg-sand">
                    <span className="truncate text-ink">{s.name}</span>
                    <span className="shrink-0 text-xs text-muted-2">{[s.lga, s.state].filter(Boolean).join(', ')}</span>
                  </button>
                ))}
              </div>
            )}
          </Field>
          <div className="flex items-center gap-3 text-xs text-muted-2">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <Field label="Paste an invite link">
            <input value={code} onChange={(e) => { setCode(e.target.value); setQuery('') }}
              className="input" placeholder="mycooperativeos.com/join/…" />
          </Field>
        </>
      )}

      <Field label="Anything the officers should know?" hint="Optional — who introduced you, your number on their paper register.">
        <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} className="input" />
      </Field>
      <p className="text-xs text-muted-2">
        They'll see your name, email and phone from this account. Once an officer admits you, the
        cooperative appears in this list and you can switch to it with one tap.
      </p>
      <div className="flex justify-between gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>Back</Button>
        <Button type="submit" size="sm" loading={join.isPending} disabled={!picked && !code.trim()}>
          Send request
        </Button>
      </div>
    </form>
  )
}
