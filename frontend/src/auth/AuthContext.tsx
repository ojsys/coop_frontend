import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchMe, login as apiLogin, logout as apiLogout } from '@/api/auth'
import { session } from '@/api/session'
import type { CurrentUser, MembershipSummary } from '@/api/types'

interface AuthState {
  user: CurrentUser | null
  loading: boolean
  activeCooperativeId: number | null
  activeMembership: MembershipSummary | null
  /** `username` is the phone number or email on the account. */
  login: (username: string, password: string) => Promise<CurrentUser>
  logout: () => void
  setActiveCooperativeId: (id: number) => void
  refresh: () => Promise<void>
}

const AuthCtx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeCooperativeId, setActiveId] = useState<number | null>(
    session.getCooperativeId(),
  )

  // Pick a sensible default tenant for multi-coop users the first time.
  function ensureActiveCoop(u: CurrentUser) {
    if (u.is_platform_admin) return
    const current = session.getCooperativeId()
    const stillValid =
      current && u.memberships.some((m) => m.cooperative_id === current)
    const next = stillValid ? current : u.memberships[0]?.cooperative_id ?? null
    session.setCooperativeId(next)
    setActiveId(next)
  }

  async function loadUser() {
    const me = await fetchMe()
    setUser(me)
    session.setUser(me)
    ensureActiveCoop(me)
    return me
  }

  useEffect(() => {
    if (!session.getToken()) {
      setLoading(false)
      return
    }
    // Boot optimistically from the cached profile so the app renders offline.
    const cached = session.getUser<CurrentUser>()
    if (cached) {
      setUser(cached)
      ensureActiveCoop(cached)
    }
    loadUser()
      .catch((err: unknown) => {
        // Only sign out on a real auth rejection (server said 401). A network
        // error (offline) must NOT log the member out — keep the cached profile
        // and let the service worker serve cached reads.
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 401 || !cached) {
          session.clear()
          setUser(null)
        }
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(username: string, password: string) {
    await apiLogin(username, password)
    const me = await loadUser()
    setLoading(false)
    return me
  }

  function logout() {
    apiLogout()
    setUser(null)
    setActiveId(null)
  }

  function setActiveCooperativeId(id: number) {
    session.setCooperativeId(id)
    setActiveId(id)
  }

  const value = useMemo<AuthState>(() => {
    const activeMembership =
      user?.memberships.find((m) => m.cooperative_id === activeCooperativeId) ??
      user?.memberships[0] ??
      null
    return {
      user,
      loading,
      activeCooperativeId,
      activeMembership,
      login,
      logout,
      setActiveCooperativeId,
      refresh: async () => {
        await loadUser()
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, activeCooperativeId])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
