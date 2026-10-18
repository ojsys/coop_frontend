import { useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { CooperativesModal, useSwitchCooperative } from '@/auth/CooperativesModal'
import { Icon } from '@/ui/Icon'

// The society selector in the header. Lists every society this account
// belongs to: one where you hold office opens here in the console; one where
// you're a member opens in the member app. Joining another starts here too.
export function CoopSwitcher() {
  const { user, activeMembership } = useAuth()
  const switchTo = useSwitchCooperative()
  const [open, setOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const memberships = user?.memberships ?? []

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md bg-[#093f2f] px-3 py-1.5 text-paper transition hover:bg-[#0a4636]"
      >
        <Icon name="storefront" size={18} className="text-green-200" />
        <span className="max-w-[180px] truncate text-[13px] font-medium">
          {activeMembership?.cooperative_name ?? 'Select society'}
        </span>
        <Icon name="expand_more" size={18} className="text-green-200" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-20 w-72 rounded-lg border border-line bg-card p-1.5 text-ink shadow-float">
            {memberships.map((m) => (
              <button
                key={m.cooperative_id}
                onClick={() => {
                  if (m.cooperative_id !== activeMembership?.cooperative_id) switchTo(m.cooperative_id)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-sand"
              >
                <span className="min-w-0">
                  <span className="block truncate text-ink-soft">{m.cooperative_name}</span>
                  <span className="block text-[11px] text-muted-2">
                    {m.is_officer ? m.role_name ?? 'Officer' : 'Member · opens the member app'}
                  </span>
                </span>
                {m.cooperative_id === activeMembership?.cooperative_id && (
                  <Icon name="check" size={16} className="shrink-0 text-green" />
                )}
              </button>
            ))}
            <div className="my-1 h-px bg-line" />
            <button
              onClick={() => { setOpen(false); setJoinOpen(true) }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-green transition hover:bg-sand"
            >
              <Icon name="add" size={18} /> Join another cooperative
            </button>
          </div>
        </>
      )}
      <CooperativesModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  )
}
