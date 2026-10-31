import { api } from './client'
import { session } from './session'
import type { CurrentUser } from './types'

/** `username` is the phone number or the email on the account; either signs
 *  in, however the phone is written. */
export async function login(username: string, password: string): Promise<string> {
  const { data } = await api.post<{ token: string }>('/auth/token/', {
    username,
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

/** Ask for a reset link, by phone or email. The reply is deliberately
 *  identical whether or not the account exists, so it must not be treated as
 *  confirmation. Someone with no email is told to ask for an access code. */
export async function requestPasswordReset(username: string): Promise<string> {
  const { data } = await api.post<{ detail: string }>(
    '/auth/password-reset/',
    { username },
  )
  return data.detail
}

/** Choose a password with the one-time code an officer of the society gave
 *  a member who has no email. */
export async function redeemAccessCode(input: {
  username: string
  code: string
  password: string
}): Promise<string> {
  const { data } = await api.post<{ detail: string }>(
    '/auth/access-code/',
    input,
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
