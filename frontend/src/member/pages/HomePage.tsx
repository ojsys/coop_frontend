import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useMemberStatement, useResolutions } from '@/api/hooks'
import { Icon } from '@/ui/Icon'
import { Avatar } from '@/ui/Avatar'
import { Modal } from '@/ui/Modal'
import { naira, shortDate, lineAmount, signedNaira } from '@/lib/format'

export function HomePage() {
  const { user, activeMembership } = useAuth()
  const mid = activeMembership?.id
  const { data: statement } = useMemberStatement(mid)
  const { data: resolutions = [] } = useResolutions()
  const [shareInfo, setShareInfo] = useState(false)

  // Someone the society serves who has not joined: no vote, no shares, no
  // dividends — so none of those are offered.
  const isMember = activeMembership?.kind !== 'non_member'
  const openVotes = isMember ? resolutions.filter((r) => r.status === 'open').length : 0
  const recent = statement?.lines?.slice(0, 4) ?? []

  return (
    <div>
      {/* Green header with savings hero */}
      <div className="bg-green px-5 pb-8 pt-7 text-paper md:rounded-2xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-green-200">Good afternoon,</div>
            <div className="font-display text-xl font-semibold">{user?.full_name}</div>
          </div>
          <Avatar name={user?.full_name ?? '?'} size={44} />
        </div>

        <div className="mt-5 rounded-2xl bg-[#093f2f] p-4">
          <div className="text-[13px] text-green-200">
            Total savings · {activeMembership?.cooperative_name}
          </div>
          <div className="mt-1 font-display text-4xl font-semibold tracking-tight tnum">
            {naira(statement?.savings_balance ?? 0)}
          </div>
          <div className="mt-1 font-mono text-[11px] text-green-200">
            {activeMembership?.member_no} · {isMember ? (activeMembership?.role_name ?? 'Member') : 'Non-member'}
          </div>

          {isMember && (
          <button
            onClick={() => setShareInfo(true)}
            className="mt-3 flex w-full items-center gap-2 rounded-xl bg-[#0b4f3a] px-3 py-2 text-left transition active:scale-[0.99]"
          >
            <div className="flex-1">
              <div className="flex items-center gap-1 text-[11px] text-green-200">
                Share capital
                <Icon name="info" size={13} className="text-green-200" />
              </div>
              <div className="mt-0.5 font-mono text-sm font-semibold tnum">
                {naira(activeMembership?.share_capital ?? 0)}
              </div>
            </div>
            <span className="text-[11px] text-green-200">What's this?</span>
          </button>
          )}
        </div>
      </div>

      <Modal open={shareInfo} onClose={() => setShareInfo(false)} title="Share capital">
        <div className="space-y-3 text-sm text-muted">
          <p>
            Your <span className="font-medium text-ink">share capital</span> is your ownership stake in the
            cooperative — it's what makes you a part-owner. Your share of any year-end
            <span className="font-medium text-ink"> dividend</span> is worked out from it, so a larger stake
            earns a larger share.
          </p>
          <p>
            It's separate from your <span className="font-medium text-ink">savings</span>, which the society
            simply holds for you and you can withdraw. Share capital is usually returned only when you leave
            the cooperative.
          </p>
        </div>
      </Modal>

      {/* Quick actions */}
      <div className="-mt-5 px-5">
        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-line bg-card p-3 shadow-soft">
          <Action to="/app/contribute" icon="add_circle" label="Contribute" />
          <Action to="/app/savings" icon="receipt_long" label="Statement" />
          {isMember
            ? <Action to="/app/vote" icon="how_to_vote" label="Vote" />
            : <Action to="/app/loans" icon="request_quote" label="Loans" />}
        </div>
      </div>

      {/* My Finance */}
      <div className="px-5 pt-6">
        <h2 className="mb-2 font-display text-[15px] font-semibold text-ink">My Finance</h2>
        <div className="grid grid-cols-3 gap-3">
          <FinanceCard to="/app/loans" icon="request_quote" label="Loans" />
          <FinanceCard to="/app/savings-goals" icon="flag" label="Savings goals" />
          {isMember && <FinanceCard to="/app/dividends" icon="savings" label="Dividends" />}
        </div>
      </div>

      {openVotes > 0 && (
        <Link to="/app/vote" className="mx-5 mt-4 flex items-center gap-3 rounded-xl border border-gold-50 bg-gold-50 px-4 py-3">
          <Icon name="how_to_vote" size={22} className="text-gold-deep" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-ink">
              {openVotes} resolution{openVotes > 1 ? 's' : ''} need{openVotes > 1 ? '' : 's'} your vote
            </div>
            <div className="text-xs text-muted">Tap to cast your ballot</div>
          </div>
          <Icon name="chevron_right" size={20} className="text-gold-deep" />
        </Link>
      )}

      {/* Recent activity */}
      <div className="px-5 pt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-[15px] font-semibold text-ink">Recent activity</h2>
          <Link to="/app/savings" className="text-[13px] font-medium text-green">
            See all
          </Link>
        </div>
        <div className="space-y-2">
          {recent.map((l, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-green-50 text-green-bright">
                <Icon name="arrow_downward" size={18} />
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium text-ink">{l.description}</div>
                <div className="text-xs text-muted-2">{shortDate(l.date)}</div>
              </div>
              <div className="font-mono text-sm font-semibold text-green-bright tnum">
                {signedNaira(lineAmount(l))}
              </div>
            </div>
          ))}
          {recent.length === 0 && (
            <p className="rounded-xl border border-line bg-card px-4 py-6 text-center text-sm text-muted">
              No activity yet.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Action({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-1.5 rounded-xl py-2 transition hover:bg-sand">
      <span className="flex size-11 items-center justify-center rounded-full bg-green-50 text-green">
        <Icon name={icon} size={22} />
      </span>
      <span className="text-[12px] font-medium text-ink-soft">{label}</span>
    </Link>
  )
}

function FinanceCard({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-1.5 rounded-2xl border border-green-100 bg-green-50 px-2 py-4 text-center transition hover:shadow-soft">
      <Icon name={icon} size={22} className="text-green" />
      <span className="text-[11.5px] font-semibold leading-tight text-green">{label}</span>
    </Link>
  )
}
