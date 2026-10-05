import axios from 'axios'
import { session } from './session'

// Same-origin in dev thanks to the Vite proxy (/api -> :8000). In prod this is
// still same-origin (Django serves the built SPA) or overridden via env.
// NOTE: do not set a default `Content-Type: application/json` here.
// axios's transformRequest converts a FormData body to JSON whenever the
// content type is already application/json:
//
//     if (isFormData) return hasJSONContentType
//       ? JSON.stringify(formDataToJSON(data)) : data
//
// which silently turns every file upload into a string and makes DRF answer
// "The submitted data was not a file. Check the encoding type on the form."
// axios sets application/json by itself for plain-object payloads, and leaves
// FormData alone so the browser can add the multipart boundary.
export const api = axios.create({
  baseURL: '/api/v1',
})

// Attach DRF token auth + the active-cooperative tenant header on every request.
api.interceptors.request.use((config) => {
  const token = session.getToken()
  if (token) config.headers.Authorization = `Token ${token}`

  // Don't clobber an explicitly-set tenant (e.g. an outbox item replaying a
  // write under the cooperative it was originally made in).
  const coopId = session.getCooperativeId()
  if (coopId && !config.headers['X-Cooperative-Id']) {
    config.headers['X-Cooperative-Id'] = String(coopId)
  }

  return config
})

/**
 * Pages a signed-out visitor is entitled to be on.
 *
 * A 401 while you are here means "that request needed auth", not "you are on
 * the wrong page". Bouncing a visitor off the signup form because a stale
 * token in localStorage failed /me/ on boot is its own bug — they never asked
 * to sign in.
 */
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
]

function onPublicPage(): boolean {
  const path = window.location.pathname
  return PUBLIC_PATHS.some(
    (p) => path === p || (p !== '/' && path.startsWith(`${p}/`)),
  )
}

// On 401 the session is always cleared — a token the server rejects is dead
// either way — but we only navigate when the page actually required auth.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      session.clear()
      if (!onPublicPage()) {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)
