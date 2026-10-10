import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Icon } from '@/ui/Icon'
import { LogoMark } from '@/ui/Logo'
import { useAuth } from '@/auth/AuthContext'
import { initials } from '@/lib/format'
import { SyncBanner } from './SyncBanner'

interface Tab {
  to: string
  label: string
  icon: string
  end?: boolean
  center?: boolean
}

const TABS: Tab[] = [
  { to: '/app', label: 'Home', icon: 'home', end: true },
  { to: '/app/savings', label: 'Savings', icon: 'savings' },
  { to: '/app/contribute', label: 'Pay', icon: 'add_circle', center: true },
  { to: '/app/vote', label: 'Vote', icon: 'how_to_vote' },
  { to: '/app/profile', label: 'Profile', icon: 'person' },
]

// The member experience is mobile-first but designed to scale up gracefully:
//   • phones  — full-screen with a bottom tab bar
//   • tablets & desktops — a left sidebar + a centred, comfortably-sized content
//     column on the paper canvas (a proper responsive web app, not a toy phone).
export function MemberShell({ children }: { children: ReactNode }) {
  const { user, activeMembership, logout } = useAuth()
  // Non-members have no vote; the tab would only lead to a refusal.
  const tabs = activeMembership?.kind === 'non_member'
    ? TABS.filter((t) => t.to !== '/app/vote')
    : TABS

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Sidebar — tablet & desktop only */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line-soft bg-card px-4 py-5 md:flex">
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex size-9 items-center justify-center overflow-hidden rounded-lg bg-gold">
            {activeMembership?.cooperative_logo ? (
              <img
                src={activeMembership.cooperative_logo}
                alt=""
                className="size-full object-contain"
              />
            ) : (
              <LogoMark size={26} />
            )}
          </div>
          <div className="leading-tight">
            <div className="truncate font-display text-[15px] font-semibold text-ink">
              {activeMembership?.cooperative_name || 'CooperativeOS'}
            </div>
            <div className="text-[11px] text-muted-2">Member portal</div>
          </div>
        </div>

        <nav className="mt-6 flex-1 space-y-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3.5 py-2.5 text-[14px] font-medium transition ${
                  isActive ? 'bg-green-50 text-green' : 'text-ink-soft hover:bg-sand-deep'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={t.center ? 'add_circle' : t.icon} size={21} fill={isActive} />
                  {t.label === 'Pay' ? 'Contribute' : t.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-2 border-t border-line pt-3">
          {/* The way back out to the public site. On phones the bottom bar is
              full, so the same link lives on the Profile page instead. */}
          <Link
            to="/"
            className="mb-1 flex items-center gap-3 rounded-md px-3.5 py-2 text-[14px] font-medium text-ink-soft transition hover:bg-sand-deep"
          >
            <Icon name="language" size={21} /> View website
          </Link>
          <div className="flex items-center gap-3 px-2 py-1.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-gold font-display text-sm font-semibold text-green">
              {initials(user?.full_name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{user?.full_name}</div>
              <div className="truncate text-xs text-muted-2">{activeMembership?.member_no}</div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-danger-50 hover:text-danger"
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col">
        <main className="flex-1 overflow-y-auto pb-24 md:pb-10">
          <div className="mx-auto w-full max-w-2xl md:px-6 md:pt-4">
            <SyncBanner />
            {children}
          </div>
        </main>

        {/* Bottom tab bar — phones only */}
        <nav className="fixed inset-x-0 bottom-0 flex items-center justify-around border-t border-line bg-card/95 px-2 pb-5 pt-2 backdrop-blur md:hidden">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 ${t.center ? '-mt-6' : ''} ${
                  isActive ? 'text-green' : 'text-muted-2'
                }`
              }
            >
              {({ isActive }) =>
                t.center ? (
                  <span className="flex size-14 items-center justify-center rounded-full bg-green text-paper shadow-float">
                    <Icon name={t.icon} size={30} fill />
                  </span>
                ) : (
                  <>
                    <Icon name={t.icon} size={24} fill={isActive} />
                    <span className="text-[10px] font-medium">{t.label}</span>
                  </>
                )
              }
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

export function MemberHeader({
  title,
  subtitle,
  back,
}: {
  title: string
  subtitle?: string
  back?: ReactNode
}) {
  return (
    <div className="px-5 pb-2 pt-6 md:px-0">
      {back}
      <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
    </div>
  )
}
