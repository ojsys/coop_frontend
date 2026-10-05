// Tiny persisted session store shared between the axios interceptors and the
// AuthContext. Kept outside React so the request interceptor can read the token
// and active cooperative synchronously without prop-drilling.

const TOKEN_KEY = 'coop.token'
const COOP_KEY = 'coop.activeCooperativeId'
const USER_KEY = 'coop.user'
// While a platform admin is impersonating a cooperative official, their own
// session is stashed here so they can return to the platform afterwards.
const IMPERSONATOR_KEY = 'coop.impersonator'

interface ImpersonatorSnapshot {
  token: string
  cooperativeId: number | null
  label: string // who is impersonating whom, for the banner
}

export const session = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  },
  setToken(token: string | null) {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  },
  getCooperativeId(): number | null {
    const v = localStorage.getItem(COOP_KEY)
    return v ? Number(v) : null
  },
  setCooperativeId(id: number | null) {
    if (id) localStorage.setItem(COOP_KEY, String(id))
    else localStorage.removeItem(COOP_KEY)
  },
  // Last-known profile — lets the app boot (and stay authenticated) offline
  // while the SW serves cached API reads.
  getUser<T>(): T | null {
    const v = localStorage.getItem(USER_KEY)
    return v ? (JSON.parse(v) as T) : null
  },
  setUser(user: unknown | null) {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(COOP_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(IMPERSONATOR_KEY)
  },

  // ── Impersonation ─────────────────────────────────────────────────────────
  /** Snapshot the current (admin) session, then switch to the impersonated
   *  user's token + cooperative. A full page load re-boots AuthContext as them. */
  startImpersonation(next: { token: string; cooperativeId: number | null; label: string }) {
    const snapshot: ImpersonatorSnapshot = {
      token: this.getToken() ?? '',
      cooperativeId: this.getCooperativeId(),
      label: next.label,
    }
    localStorage.setItem(IMPERSONATOR_KEY, JSON.stringify(snapshot))
    this.setToken(next.token)
    this.setCooperativeId(next.cooperativeId)
    this.setUser(null) // force AuthContext to refetch /me/ as the new user
  },
  /** Restore the stashed admin session. Returns true if one was active. */
  stopImpersonation(): boolean {
    const raw = localStorage.getItem(IMPERSONATOR_KEY)
    if (!raw) return false
    const snap = JSON.parse(raw) as ImpersonatorSnapshot
    this.setToken(snap.token || null)
    this.setCooperativeId(snap.cooperativeId)
    this.setUser(null)
    localStorage.removeItem(IMPERSONATOR_KEY)
    return true
  },
  impersonation(): ImpersonatorSnapshot | null {
    const raw = localStorage.getItem(IMPERSONATOR_KEY)
    return raw ? (JSON.parse(raw) as ImpersonatorSnapshot) : null
  },
}
