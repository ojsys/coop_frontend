import { Icon } from './Icon'

/**
 * The verified tick beside a member's name. Earned by completing the profile
 * and uploading a means of ID, or granted by an officer — the tooltip says
 * which, so nobody reads an officer's say-so as a checked ID or vice versa.
 */
export function VerifiedBadge({
  via,
  size = 17,
  label = false,
}: {
  via: 'officer' | 'profile' | null | undefined
  size?: number
  /** Show the word "Verified" next to the tick. */
  label?: boolean
}) {
  if (!via) return null
  const title =
    via === 'officer'
      ? 'Verified by an officer of the cooperative'
      : 'Verified — profile complete with a means of ID'
  return (
    <span title={title} aria-label={title} className="inline-flex shrink-0 items-center gap-1 text-green">
      <Icon name="verified" size={size} fill />
      {label && <span className="text-[12px] font-semibold">Verified</span>}
    </span>
  )
}
