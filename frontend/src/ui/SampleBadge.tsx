import { Icon } from './Icon'

// Marks a panel whose data is illustrative (no backing endpoint yet — Phase 3).
export function SampleBadge() {
  return (
    <span
      title="Illustrative data — this metric has no backend endpoint yet (Phase 3)."
      className="inline-flex items-center gap-1 rounded-full border border-gold-50 bg-gold-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-deep"
    >
      <Icon name="science" size={12} />
      Sample
    </span>
  )
}
