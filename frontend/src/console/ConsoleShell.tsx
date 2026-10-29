import type { ReactNode } from 'react'
import { SidebarShell, type NavItem } from '@/ui/SidebarShell'
import { GreenCard } from '@/ui/GreenCard'
import { CoopSwitcher } from './CoopSwitcher'
import { useAuth } from '@/auth/AuthContext'
import { usePendingJoinRequestCount } from '@/api/signup'
import { usePendingDeletionCount } from '@/api/dataRights'
import { num, shortDate } from '@/lib/format'

const NAV: NavItem[] = [
  { to: '/console', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/console/members', label: 'Members', icon: 'group' },
  { to: '/console/join-requests', label: 'Join requests', icon: 'person_add' },
  { to: '/console/deletion-requests', label: 'Deletion requests', icon: 'person_remove' },
  { to: '/console/ledger', label: 'Ledger & Contributions', icon: 'account_balance' },
  { to: '/console/contribution-types', label: 'Contribution types', icon: 'savings' },
  { to: '/console/reconciliation', label: 'Reconciliation', icon: 'sync_alt' },
  { to: '/console/governance', label: 'Governance', icon: 'how_to_vote' },
  { to: '/console/loans', label: 'Loans & Credit', icon: 'request_quote' },
  // Beside Loans deliberately: it is the float lending draws on, and an officer
  // reaching for one usually needs the other.
  { to: '/console/wallet', label: 'Disbursement wallet', icon: 'account_balance_wallet' },
  { to: '/console/withdrawals', label: 'Withdrawals', icon: 'payments' },
  { to: '/console/payouts', label: 'Payouts', icon: 'send_money' },
  { to: '/console/approvals', label: 'Approvals', icon: 'fact_check' },
  { to: '/console/reports', label: 'Reports & Audit', icon: 'summarize' },
  { to: '/console/activity', label: 'Activity', icon: 'timeline' },
  { to: '/console/dividends', label: 'Dividends', icon: 'paid' },
  { to: '/console/announcements', label: 'Announcements', icon: 'campaign' },
  { to: '/console/email', label: 'Email', icon: 'mail' },
  { to: '/console/settings', label: 'Settings', icon: 'settings' },
  { to: '/console/verification', label: 'Verification', icon: 'verified_user' },
  { to: '/console/guide', label: 'Guide', icon: 'menu_book' },
  { to: '/refer', label: 'Refer & earn', icon: 'redeem' },
]

function PlanCard() {
  const { activeMembership } = useAuth()
  // The subscription as billing sees it: the plan, its member band, and the
  // active people counted against it (members and non-members alike). The
  // society's own "member cap" and size label used to stand in for this and
  // disagreed with what was invoiced.
  const plan = activeMembership?.plan
  const used = plan?.members_counted
  const top = plan?.max_members ?? 0
  const known = used != null
  const over = known && top > 0 && used > top

  return (
    <GreenCard>
      <div className="text-[11px] font-semibold text-green-200">
        {plan?.name ? `PLAN · ${plan.name.toUpperCase()}` : 'PLAN'}
      </div>
      {plan?.status === 'trial' && plan.renews_on && (
        <div className="mt-0.5 text-[11px] text-green-100">
          Free trial until {shortDate(plan.renews_on)}
        </div>
      )}
      {plan?.grace_until && (
        <div className="mt-0.5 text-[11px] text-green-100">
          Every feature included until {shortDate(plan.grace_until)}
        </div>
      )}
      <div className="mt-1 text-[13px] text-paper">
        {!known
          ? 'Loading…'
          : top > 0
            ? `${num(used)} / ${num(top)} members`
            : `${num(used)} members${plan?.band_label ? ` · ${plan.band_label}` : ''}`}
      </div>
      {top > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#093f2f]">
          <div
            className={`h-full rounded-full ${over ? 'bg-danger' : 'bg-gold'}`}
            style={{ width: `${Math.min(100, ((used ?? 0) / top) * 100)}%` }}
          />
        </div>
      )}
      {over && (
        <div className="mt-1.5 text-[11px] text-green-100">
          More than your plan's {plan?.band_label ?? 'band'} — contact us about the next plan.
        </div>
      )}
    </GreenCard>
  )
}

export function ConsoleShell({ children }: { children: ReactNode }) {
  const { activeMembership } = useAuth()
  // Listing join requests is privileged-only, and the console is open to any
  // office-holder — so asking for the count as a read-only officer would be a 403 on
  // every page of the console rather than a missing badge.
  const canSeeRequests = activeMembership?.is_privileged ?? false
  const { data: pending = 0 } = usePendingJoinRequestCount(canSeeRequests)
  // Also worth the badge: the privacy notice promises these within 30 days.
  const { data: deletions = 0 } = usePendingDeletionCount(canSeeRequests)

  // People waiting to be admitted are the one queue worth interrupting the nav
  // for: nothing else in here degrades by being left alone for a week.
  const nav = NAV.map((item) =>
    item.to === '/console/join-requests' && pending > 0
      ? { ...item, badge: pending }
      : item.to === '/console/deletion-requests' && deletions > 0
        ? { ...item, badge: deletions }
        : item,
  )

  return (
    <SidebarShell
      logoUrl={activeMembership?.cooperative_logo}
      brandName={activeMembership?.cooperative_name}
      brandSubtitle="Admin Console"
      sectionLabel="Admin Console"
      nav={nav}
      headerRight={<CoopSwitcher />}
      bottom={<PlanCard />}
    >
      {children}
    </SidebarShell>
  )
}
