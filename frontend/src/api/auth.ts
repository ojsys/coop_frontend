import { api } from './client'
import { session } from './session'
import type { CurrentUser } from './types'

export async function login(email: string, password: string): Promise<string> {
  // DRF obtain_auth_token expects `username` — our USERNAME_FIELD is email.
  const { data } = await api.post<{ token: string }>('/auth/token/', {
    username: email,
    password,
  })
  session.setToken(data.token)
  return data.token
}

export async function fetchMe(): Promise<CurrentUser> {
  const { data } = await api.get<CurrentUser>('/me/')
  return data
}

export function logout() {
  session.clear()
}

/** Ask for a reset link. The reply is deliberately identical whether or not
 *  the address is registered, so it must not be treated as confirmation. */
export async function requestPasswordReset(email: string): Promise<string> {
  const { data } = await api.post<{ detail: string }>(
    '/auth/password-reset/',
    { email },
  )
  return data.detail
}

export async function confirmPasswordReset(input: {
  uid: string
  token: string
  password: string
}): Promise<string> {
  const { data } = await api.post<{ detail: string }>(
    '/auth/password-reset/confirm/',
    input,
  )
  return data.detail
}

// Which surface does this user land on?
//   platform admin        -> /platform
//   holds an official role -> /console
//   plain member           -> /app
export type Surface = 'platform' | 'console' | 'app' | 'refer'

export function landingSurface(user: CurrentUser): Surface {
  if (user.is_platform_admin) return 'platform'
  // Same rule the backend enforces (Role.is_officer), asked for rather than
  // guessed from the slug.
  const official = user.memberships.some((m) => m.is_officer)
  if (official) return 'console'
  // Someone who signed up only to refer belongs to no cooperative: the
  // member app has nothing to show them.
  if (!user.memberships.length && user.is_referrer) return 'refer'
  return 'app'
}
