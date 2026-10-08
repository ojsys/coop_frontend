// Formatting helpers. Amounts arrive from DRF as decimal strings.
//
// `naira` is for a society's own books, which are kept in one currency and
// are overwhelmingly Nigerian today. Anything that renders an amount whose
// currency travels with it — platform plans, cross-border figures — must use
// `money` instead, or a USD plan will be shown to its customer in Naira.

export function naira(value: string | number | null | undefined, opts?: { compact?: boolean }): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0)
  if (Number.isNaN(n)) return '₦0'
  if (opts?.compact && Math.abs(n) >= 1000) {
    const fmt = new Intl.NumberFormat('en-NG', {
      notation: 'compact',
      maximumFractionDigits: 1,
    })
    return `₦${fmt.format(n)}`
  }
  return `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(n)}`
}

/** Naira to the kobo — for a checkout total, which must match what is charged. */
export function nairaKobo(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0)
  return `₦${(Number.isNaN(n) ? 0 : n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Format an amount in the currency it is actually denominated in.
 *
 * Uses the viewer's own locale for grouping and symbol placement, so a
 * Kenyan visitor reading a KES plan sees it written the way they expect.
 * Falls back to "CODE 1,234" rather than throwing: Intl raises a RangeError
 * on an unrecognised currency code, and a bad row in the plans table should
 * not take the pricing section down with it.
 */
export function money(
  value: string | number | null | undefined,
  currency: string | null | undefined,
  opts?: { compact?: boolean },
): string {
  const parsed = typeof value === 'string' ? Number(value) : (value ?? 0)
  const n = Number.isNaN(parsed) ? 0 : parsed
  const code = (currency || 'NGN').toUpperCase()
  const compact = opts?.compact && Math.abs(n) >= 1000

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      ...(compact
        ? { notation: 'compact' as const, maximumFractionDigits: 1 }
        : { maximumFractionDigits: 0 }),
    }).format(n)
  } catch {
    return `${code} ${num(n)}`
  }
}

export function num(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0)
  return new Intl.NumberFormat('en-NG').format(Number.isNaN(n) ? 0 : n)
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })
}

export function longDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-NG', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// A statement line's signed movement: credit (money in) minus debit.
export function lineAmount(line: { credit: string; debit: string }): number {
  return Number(line.credit) - Number(line.debit)
}

export function signedNaira(n: number): string {
  return `${n >= 0 ? '+' : '−'}${naira(Math.abs(n))}`
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const secs = Math.floor((Date.now() - d.getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`
  return longDate(iso)
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
