import type { ReactNode } from 'react'

export type Tone = 'green' | 'gold' | 'danger' | 'neutral' | 'blue'

const TONES: Record<Tone, string> = {
  green: 'bg-green-50 text-green',
  gold: 'bg-gold-50 text-gold-deep',
  danger: 'bg-danger-50 text-danger',
  neutral: 'bg-sand-deep text-muted',
  blue: 'bg-[#e6eef5] text-[#2c5f8a]',
}

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className = '',
}: {
  children: ReactNode
  tone?: Tone
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${TONES[tone]} ${className}`}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

// Map a domain status string to a tone + label.
const STATUS_TONES: Record<string, Tone> = {
  active: 'green',
  matched: 'green',
  paid: 'green',
  posted: 'green',
  connected: 'green',
  passed: 'green',
  open: 'gold',
  pending: 'gold',
  partial: 'gold',
  prospective: 'gold',
  onboarding: 'gold',
  suspended: 'danger',
  overdue: 'danger',
  unmatched: 'danger',
  failed: 'danger',
  exited: 'neutral',
  closed: 'neutral',
  ignored: 'neutral',
  duplicate: 'neutral',
}

export function StatusPill({ status }: { status: string }) {
  const key = status?.toLowerCase()
  return (
    <Badge tone={STATUS_TONES[key] ?? 'neutral'} dot>
      {status ? status[0].toUpperCase() + status.slice(1) : '—'}
    </Badge>
  )
}
