import type { ReactNode } from 'react'
import { SidebarShell, type NavItem } from '@/ui/SidebarShell'
import { GreenCard } from '@/ui/GreenCard'
import { CoopSwitcher } from './CoopSwitcher'
import { useAuth } from '@/auth/AuthContext'
import { useCooperative, useDashboard } from '@/api/hooks'
import { usePendingJoinRequestCount } from '@/api/signup'
import { num } from '@/lib/format'

const NAV: NavItem[] = [
  { to: '/console', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/console/members', label: 'Members', icon: 'group' },
  { to: '/console/join-requests', label: 'Join requests', icon: 'person_add' },
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
  { to: '/console/settings', label: 'Settings', icon: 'settings' },
  { to: '/console/guide', label: 'Guide', icon: 'menu_book' },
]

function PlanCard() {
  const { activeCooperativeId } = useAuth()
  // These were hardcoded to the demo seed's figures (1,240 of 5,000), so every
  // real cooperative was shown a membership count it did not have. The count is
  // computed server-side; the cap and tier are the cooperative's own plan.
  const { data: coop } = useCooperative(activeCooperativeId ?? undefined)
  const { data: dash } = useDashboard()

  const used = dash?.total_members
  const cap = coop?.member_cap
  const known = used != null && cap != null && cap > 0

  return (
    <GreenCard>
      <div className="text-[11px] font-semibold text-green-200">
        {coop?.tier ? `PLAN · ${coop.tier.toUpperCase()}` : 'PLAN'}
      </div>
      <div className="mt-1 text-[13px] text-paper">
        {known ? `${num(used)} / ${num(cap)} members used` : 'Loading…'}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#093f2f]">
        <div
          className="h-full rounded-full bg-gold"
          style={{ width: known ? `${Math.min(100, (used / cap) * 100)}%` : '0%' }}
        />
      </div>
    </GreenCard>
  )
}

export function ConsoleShell({ children }: { children: ReactNode }) {
  const { activeMembership } = useAuth()
  // Listing join requests is privileged-only, and the console is open to any
  // office-holder — so asking for the count as a Chairperson would be a 403 on
  // every page of the console rather than a missing badge.
  const canSeeRequests = activeMembership?.is_privileged ?? false
  const { data: pending = 0 } = usePendingJoinRequestCount(canSeeRequests)

  // People waiting to be admitted are the one queue worth interrupting the nav
  // for: nothing else in here degrades by being left alone for a week.
  const nav = NAV.map((item) =>
    item.to === '/console/join-requests' && pending > 0
      ? { ...item, badge: pending }
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
