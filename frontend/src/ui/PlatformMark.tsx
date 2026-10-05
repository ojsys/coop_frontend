import { usePublicBranding } from '@/api/public'
import { LogoMark } from './Logo'

/**
 * The platform's own mark, for unauthenticated surfaces.
 *
 * Falls back to the built-in CooperativeOS mark until a logo is uploaded under
 * Platform Settings. Callers own the surrounding container — a gold tile on the
 * marketing page, bare on the auth pages — so this renders only the mark.
 *
 * Always the *platform* brand, never a society's: an anonymous visitor has no
 * tenant context, and showing one society's logo to another's visitors would
 * be wrong.
 */
export function PlatformMark({
  size = 40,
  className = '',
}: {
  size?: number
  className?: string
}) {
  const { data } = usePublicBranding()

  if (data?.logo) {
    return (
      <img
        src={data.logo}
        alt=""
        className={`object-contain ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }
  return <LogoMark size={size} />
}
