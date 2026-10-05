// The CooperativeOS mark from the prototype: a gold rounded tile with a friendly
// face (two members + a shared smile — a cooperative).
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect x="14" y="26" width="72" height="54" rx="16" fill="var(--color-gold)" />
      <circle cx="36" cy="46" r="8" fill="var(--color-green)" />
      <circle cx="64" cy="46" r="8" fill="var(--color-green)" />
      <rect x="34" y="58" width="32" height="12" rx="6" fill="var(--color-green)" />
    </svg>
  )
}

export function Wordmark({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="leading-tight">
      <div className="font-display text-[17px] font-semibold text-ink">
        CooperativeOS
      </div>
      {subtitle && (
        <div className="text-[11px] tracking-wide text-muted-2">
          by Startup Ripple
        </div>
      )}
    </div>
  )
}
