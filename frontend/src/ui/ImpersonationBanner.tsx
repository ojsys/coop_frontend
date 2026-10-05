import { session } from '@/api/session'
import { Icon } from './Icon'

/** Fixed banner shown while a platform admin is impersonating a coop official. */
export function ImpersonationBanner() {
  const active = session.impersonation()
  if (!active) return null

  function exit() {
    session.stopImpersonation()
    // Full reload so AuthContext re-boots as the platform admin.
    window.location.assign('/platform')
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[200] flex items-center justify-center gap-3 bg-gold-deep px-4 py-2 text-sm font-medium text-white shadow-float">
      <Icon name="admin_panel_settings" size={18} />
      <span>{active.label}</span>
      <button
        onClick={exit}
        className="ml-2 rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold transition hover:bg-white/30"
      >
        Exit impersonation
      </button>
    </div>
  )
}
