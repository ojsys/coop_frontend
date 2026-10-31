import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Icon } from './Icon'
import { LogoMark } from './Logo'
import { useAuth } from '@/auth/AuthContext'
import { initials, phone } from '@/lib/format'

export interface NavItem {
  to: string
  label: string
  icon: string
  end?: boolean
  /** A count worth interrupting for (work waiting). Zero renders nothing — a
   *  "0" badge is noise that trains people to ignore the real thing. */
  badge?: number
}

export function SidebarShell({
  brandSubtitle,
  sectionLabel,
  nav,
  headerRight,
  bottom,
  children,
  logoUrl,
  brandName,
}: {
  brandSubtitle: string
  sectionLabel: string
  nav: NavItem[]
  headerRight?: ReactNode
  bottom?: ReactNode
  children: ReactNode
  /** The society's uploaded logo; falls back to the CooperativeOS mark. */
  logoUrl?: string | null
  /** The society's name, so a white-labelled surface wears its own brand. */
  brandName?: string | null
}) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-paper">
      {/* Green top header */}
      <header className="flex items-center gap-4 bg-green px-4 py-2.5 text-paper">
        <div className="flex min-w-[210px] items-center gap-2.5">
          <div className="flex size-9 items-center justify-center overflow-hidden rounded-lg bg-gold">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="size-full object-contain" />
            ) : (
              <LogoMark size={26} />
            )}
          </div>
          <div className="leading-tight">
            <div className="truncate font-display text-[15px] font-semibold">
              {brandName || 'CooperativeOS'}
            </div>
            <div className="text-[11px] text-green-200">{brandSubtitle}</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          {headerRight}
          <button className="flex size-9 items-center justify-center rounded-full bg-[#093f2f] text-paper transition hover:bg-[#0a4636]">
            <Icon name="notifications" size={19} />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex size-9 items-center justify-center rounded-full bg-gold font-display text-sm font-semibold text-green"
            >
              {initials(user?.full_name)}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-11 z-20 w-56 rounded-lg border border-line bg-card p-1.5 text-ink shadow-float">
                  <div className="px-2.5 py-2">
                    <div className="text-sm font-semibold text-ink">{user?.full_name}</div>
                    <div className="text-xs text-muted">{user?.email || phone(user?.phone)}</div>
                  </div>
                  <div className="my-1 border-t border-line" />
                  {/* The way back out to the public site. Being signed in
                      should never mean being stuck inside the app. */}
                  <Link
                    to="/"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-ink-soft transition hover:bg-sand-deep"
                  >
                    <Icon name="language" size={18} /> View website
                  </Link>
                  <div className="my-1 border-t border-line" />
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-danger transition hover:bg-danger-50"
                  >
                    <Icon name="logout" size={18} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Body: light sidebar + scrollable content */}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[236px] shrink-0 flex-col border-r border-line-soft bg-card px-3.5 py-4">
          <div className="px-3.5 pb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-2">
            {sectionLabel}
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3.5 py-2 text-[14px] font-medium transition ${
                    isActive
                      ? 'bg-green-50 text-green'
                      : 'text-ink-soft hover:bg-sand-deep'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon name={item.icon} size={20} fill={isActive} />
                    {item.label}
                    {item.badge ? (
                      <span
                        className="ml-auto min-w-5 rounded-full bg-gold px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold leading-none text-ink"
                        title={`${item.badge} waiting`}
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    ) : null}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          {bottom && <div className="pt-3">{bottom}</div>}
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto px-8 py-7">{children}</main>
      </div>
    </div>
  )
}
