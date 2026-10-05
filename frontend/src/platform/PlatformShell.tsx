import type { ReactNode } from 'react'
import { SidebarShell, type NavItem } from '@/ui/SidebarShell'
import { GreenCard } from '@/ui/GreenCard'
import { usePlatformOverview } from '@/api/hooks'
import { usePublicBranding } from '@/api/public'
import { naira } from '@/lib/format'

const NAV: NavItem[] = [
  { to: '/platform', label: 'Command Center', icon: 'dashboard', end: true },
  { to: '/platform/cooperatives', label: 'Cooperatives', icon: 'apartment' },
  { to: '/platform/onboarding', label: 'Onboarding', icon: 'conveyor_belt' },
  { to: '/platform/billing', label: 'Billing', icon: 'receipt_long' },
  { to: '/platform/white-label', label: 'White-label', icon: 'palette' },
  { to: '/platform/analytics', label: 'B2B Analytics', icon: 'insights' },
  // Top-level path, deliberately: site activity is its own page, not a tab of
  // the revenue analytics it sits next to.
  { to: '/analytics', label: 'Site Activity', icon: 'timeline' },
  { to: '/platform/health', label: 'System Health', icon: 'monitor_heart' },
  { to: '/platform/settings', label: 'Platform Settings', icon: 'settings' },
  { to: '/platform/guide', label: 'Staff Guide', icon: 'menu_book' },
]

function MrrChip({ mrr }: { mrr?: string }) {
  return (
    <div className="rounded-md bg-[#093f2f] px-3 py-1.5 text-right">
      <div className="text-[10px] uppercase tracking-wide text-green-200">Platform MRR</div>
      <div className="font-mono text-[13px] font-semibold text-paper">
        {naira(mrr ?? 0, { compact: true })}
      </div>
    </div>
  )
}

export function PlatformShell({ children }: { children: ReactNode }) {
  const { data } = usePlatformOverview()
  // The platform's own brand, uploaded under Platform Settings → Branding.
  // This surface is Startup Ripple's, so it never wears a society's logo.
  const { data: branding } = usePublicBranding()
  return (
    <SidebarShell
      logoUrl={branding?.logo}
      brandName={branding?.name}
      brandSubtitle="Startup Ripple · Platform"
      sectionLabel="Platform"
      nav={NAV}
      headerRight={<MrrChip mrr={data?.mrr} />}
      bottom={
        <GreenCard>
          <div className="text-[11px] font-semibold text-green-200">STARTUP RIPPLE</div>
          <div className="mt-1 text-[13px] text-paper">
            {data ? `${data.cooperatives_live} cooperatives live` : 'Loading…'}
          </div>
          <div className="mt-0.5 text-[11px] text-green-200">
            {data ? `${data.members_total} members on platform` : ''}
          </div>
        </GreenCard>
      }
    >
      {children}
    </SidebarShell>
  )
}
