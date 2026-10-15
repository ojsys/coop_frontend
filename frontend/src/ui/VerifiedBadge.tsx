import { Icon } from './Icon'

/**
 * The verified tick beside a member's name. Only an officer gives it, after
 * checking the member's details and ID — completing the profile only puts
 * them in the queue for that check.
 */
export function VerifiedBadge({
  via,
  size = 17,
  label = false,
}: {
  via: 'officer' | null | undefined
  size?: number
  /** Show the word "Verified" next to the tick. */
  label?: boolean
}) {
  if (!via) return null
  const title = 'Verified by an officer of the cooperative'
  return (
    <span title={title} aria-label={title} className="inline-flex shrink-0 items-center gap-1 text-green">
      <Icon name="verified" size={size} fill />
      {label && <span className="text-[12px] font-semibold">Verified</span>}
    </span>
  )
}
