import { useMemo, useState } from 'react'
import type { Member } from '@/api/types'
import { Icon } from './Icon'
import { Avatar } from './Avatar'
import { Badge } from './Badge'
import { memberMatches } from '@/lib/members'

/**
 * Searchable member picker — type a name, member number, phone or email and
 * pick from the matches, instead of scrolling a dropdown of every member.
 * Emits the chosen membership id as a string ('' when cleared), so it drops
 * into forms that held a <select> value.
 *
 * Put it in a `<Field interactive>`: inside a plain label, iOS Safari sends
 * taps on the results to the input instead.
 */
export function MemberSearchSelect({
  members,
  value,
  onChange,
  required = false,
  placeholder = 'Search by name, member no., phone or email…',
}: {
  members: Member[]
  value: string
  onChange: (id: string) => void
  required?: boolean
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const selected = members.find((m) => String(m.id) === value) ?? null
  const matches = useMemo(
    () => members.filter((m) => memberMatches(m, query)).slice(0, 30),
    [members, query],
  )

  function pick(m: Member) {
    onChange(String(m.id))
    setOpen(false)
    setQuery('')
  }

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2">
        <Avatar name={selected.full_name} size={24} />
        <span className="flex-1 text-sm font-medium text-ink">{selected.full_name}</span>
        {selected.kind === 'non_member' && <Badge tone="blue">Non-member</Badge>}
        <span className="font-mono text-xs text-muted-2">{selected.member_no}</span>
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-muted-2 transition hover:text-ink"
          title="Change"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2">
        <Icon name="search" size={16} className="text-muted-2" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((i) => Math.min(i + 1, matches.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter' && open && matches[active]) {
              e.preventDefault()
              pick(matches[active])
            }
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-2"
        />
      </div>
      {/* Carries the form's "required" check, which a custom picker otherwise loses. */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => {}}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
        />
      )}
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-card shadow-float">
          {matches.length === 0 && (
            <p className="px-3 py-2.5 text-sm text-muted">No one matches “{query}”.</p>
          )}
          {matches.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(m)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${i === active ? 'bg-sand' : ''}`}
            >
              <Avatar name={m.full_name} size={26} />
              <span className="flex-1 text-sm text-ink">{m.full_name}</span>
              {m.kind === 'non_member' && <Badge tone="blue">Non-member</Badge>}
              <span className="font-mono text-xs text-muted-2">{m.member_no}</span>
            </button>
          ))}
          {matches.length === 30 && (
            <p className="border-t border-line px-3 py-2 text-xs text-muted-2">Showing the first 30 — keep typing to narrow it down.</p>
          )}
        </div>
      )}
    </div>
  )
}
