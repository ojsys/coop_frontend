import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthContext'
import { Icon } from '@/ui/Icon'

// The society selector in the header. Single-coop users see a static label;
// multi-coop users get a dropdown that swaps the active X-Cooperative-Id.
export function CoopSwitcher() {
  const { user, activeMembership, setActiveCooperativeId } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const memberships = user?.memberships ?? []
  const multi = memberships.length > 1

  return (
    <div className="relative">
      <button
        onClick={() => multi && setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md bg-[#093f2f] px-3 py-1.5 text-paper transition hover:bg-[#0a4636]"
      >
        <Icon name="storefront" size={18} className="text-green-200" />
        <span className="max-w-[180px] truncate text-[13px] font-medium">
          {activeMembership?.cooperative_name ?? 'Select society'}
        </span>
        {multi && <Icon name="expand_more" size={18} className="text-green-200" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-20 w-64 rounded-lg border border-line bg-card p-1.5 text-ink shadow-float">
            {memberships.map((m) => (
              <button
                key={m.cooperative_id}
                onClick={() => {
                  setActiveCooperativeId(m.cooperative_id)
                  qc.clear()
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-sand"
              >
                <span className="truncate text-ink-soft">{m.cooperative_name}</span>
                {m.cooperative_id === activeMembership?.cooperative_id && (
                  <Icon name="check" size={16} className="text-green" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
