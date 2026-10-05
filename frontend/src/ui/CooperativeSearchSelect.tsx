import { useMemo, useRef, useState } from 'react'
import { useCooperatives } from '@/api/hooks'
import { Icon } from './Icon'
import { Avatar } from './Avatar'

/**
 * Searchable cooperative picker — filter by name or id, keyboard/click select.
 * Emits the chosen cooperative id (or null when cleared).
 */
export function CooperativeSearchSelect({
  value,
  onChange,
  placeholder = 'Search cooperative by name or ID…',
}: {
  value: number | null
  onChange: (id: number | null) => void
  placeholder?: string
}) {
  const { data: coops = [] } = useCooperatives()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const selected = coops.find((c) => c.id === value) ?? null

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return coops.slice(0, 8)
    return coops
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          String(c.id) === q ||
          c.slug.toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [coops, query])

  function pick(id: number) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2">
        <Avatar name={selected.name} size={24} />
        <span className="flex-1 text-sm font-medium text-ink">{selected.name}</span>
        <span className="font-mono text-xs text-muted-2">#{selected.id}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-muted-2 transition hover:text-ink"
          title="Change"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    )
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-2">
        <Icon name="search" size={16} className="text-muted-2" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-2"
        />
      </div>
      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-card shadow-float">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={() => pick(c.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-sand"
            >
              <Avatar name={c.name} size={26} />
              <span className="flex-1 text-sm text-ink">{c.name}</span>
              <span className="font-mono text-xs text-muted-2">#{c.id} · {c.state || '—'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
