import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { landingSurface, type Surface } from '@/api/auth'
import { FullscreenSpinner } from '@/ui/Spinner'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullscreenSpinner />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

// Gate a whole surface. If the user is authenticated but doesn't belong on this
// surface, send them to the one they do belong on (no dead-ends).
export function RequireSurface({
  surface,
  children,
}: {
  surface: Surface
  children: ReactNode
}) {
  const { user, loading } = useAuth()
  if (loading) return <FullscreenSpinner />
  if (!user) return <Navigate to="/login" replace />

  const allowed =
    surface === 'platform'
      ? user.is_platform_admin
      : surface === 'console'
        // `is_officer` is computed by the backend from the role's permissions,
        // so a society that adds a role of its own is judged the same way here
        // as by the API. Inferring it from `role_slug !== 'member'` diverged the
        // moment such a role existed.
        ? user.memberships.some((m) => m.is_officer)
        : true // every authenticated user may see the member app

  if (!allowed) return <Navigate to={`/${landingSurface(user)}`} replace />
  return <>{children}</>
}
