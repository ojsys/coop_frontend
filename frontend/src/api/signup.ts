import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

/**
 * Signup: a society joining the platform, a person applying to a society,
 * and the officer-side queue that decides the latter.
 *
 * The first three calls are public — they work with no token, because the
 * people making them have no account yet.
 */

// ── Public ──────────────────────────────────────────────────────────────────
export interface PublicSociety {
  id: number
  name: string
  slug: string
  country: string
  state: string
  lga: string
}

export interface CooperativeApplication {
  society_name: string
  applicant_name: string
  applicant_email: string
  password: string
  applicant_phone?: string
  country?: string
  state?: string
  lga?: string
  coop_type?: string
  estimated_members?: number
  message?: string
}

export interface JoinRequestInput {
  cooperative: number
  full_name: string
  email: string
  phone?: string
  message?: string
}

/** Search is deliberately the only way to reach a society: the platform's
 *  customer list is not handed out in bulk. Below two characters the API
 *  returns nothing, so don't bother asking. */
export function useSocietySearch(query: string) {
  const q = query.trim()
  return useQuery({
    queryKey: ['public-societies', q],
    queryFn: async () => {
      const { data } = await api.get<PublicSociety[]>('/public/societies/', {
        params: { q },
      })
      return data
    },
    enabled: q.length >= 2,
    staleTime: 60_000,
  })
}

/** The society behind an invite link (/join/<code>). 404 — an unknown code, a
 *  link the officers switched off or a society that isn't live — is not
 *  retried: it won't start resolving on the second attempt. */
export interface JoinLinkSociety extends PublicSociety {
  logo: string | null
  brand_color: string
}

export function useJoinLink(code: string | undefined) {
  return useQuery({
    queryKey: ['public-join-link', code],
    queryFn: async () => {
      const { data } = await api.get<JoinLinkSociety>(
        `/public/join/${encodeURIComponent(code!)}/`,
      )
      return data
    },
    enabled: Boolean(code),
    retry: false,
    staleTime: 5 * 60_000,
  })
}

export function useApplyForCooperative() {
  return useMutation({
    mutationFn: async (input: CooperativeApplication) => {
      const { data } = await api.post<{
        detail: string
        society: string
        cooperative_id: number
      }>('/public/apply/', input)
      return data
    },
  })
}

export function useRequestToJoin() {
  return useMutation({
    mutationFn: async (input: JoinRequestInput) => {
      const { data } = await api.post<{ detail: string }>('/public/join/', input)
      return data
    },
  })
}

// ── Officers ────────────────────────────────────────────────────────────────
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected'

export interface JoinRequest {
  id: number
  full_name: string
  email: string
  phone: string
  message: string
  status: JoinRequestStatus
  decision_note: string
  decided_by_name: string | null
  decided_at: string | null
  /** Set once approved — the member number they were admitted under. */
  member_no: string | null
  /** Already on CooperativeOS (a member elsewhere): signs in as they are. */
  has_account?: boolean
  created_at: string
}

export function useJoinRequests(status?: JoinRequestStatus) {
  return useQuery({
    queryKey: ['join-requests', status ?? 'all'],
    queryFn: async () => {
      const { data } = await api.get<{ results: JoinRequest[] }>(
        '/join-requests/',
        { params: status ? { status } : undefined },
      )
      return data.results
    },
  })
}

/** Approve and reject share invalidation: deciding one changes the queue, and
 *  approving also creates a member, so the member list is stale too. */
export function useJoinRequestDecision() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['join-requests'] })
    queryClient.invalidateQueries({ queryKey: ['members'] })
  }

  const approve = useMutation({
    mutationFn: async ({ id, member_no }: { id: number; member_no: string }) => {
      const { data } = await api.post<{ detail: string; membership: number }>(
        `/join-requests/${id}/approve/`,
        { member_no },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const reject = useMutation({
    mutationFn: async ({ id, note }: { id: number; note: string }) => {
      const { data } = await api.post<{ detail: string }>(
        `/join-requests/${id}/reject/`,
        { note },
      )
      return data
    },
    onSuccess: invalidate,
  })

  return { approve, reject }
}

/**
 * How many requests are waiting, for the console's nav badge.
 *
 * Reads `count` from the paginated envelope rather than `results.length`:
 * /join-requests/ is paginated at PAGE_SIZE, so a length would cap at 25 and a
 * cooperative with forty people waiting would be shown twenty-five.
 *
 * `enabled` exists because listing join requests is privileged-only
 * (IsPrivilegedMember). The console is open to any office-holder, so asking
 * for this as a read-only officer is a guaranteed 403 on every page.
 *
 * The key is nested under 'join-requests' on purpose, so deciding a request
 * invalidates this badge along with the queue.
 */
export function usePendingJoinRequestCount(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['join-requests', 'pending', 'count'],
    queryFn: async () => {
      const { data } = await api.get<{ count: number }>('/join-requests/', {
        params: { status: 'pending' },
      })
      return data.count
    },
  })
}


// ── The signed-in person: joining another society ───────────────────────────
export interface MyJoinRequest {
  id: number
  cooperative_id: number
  cooperative_name: string
  cooperative_logo: string | null
  status: JoinRequestStatus
  decision_note: string
  message: string
  created_at: string
  decided_at: string | null
}

/** Requests I've made that are still waiting, or were declined. */
export function useMyJoinRequests(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['my-join-requests'],
    queryFn: async () => (await api.get<MyJoinRequest[]>('/me/join-requests/')).data,
  })
}

/** Ask another society to admit me, with the account I already have. The
 *  society is the one picked from the search, or an invite code or link. */
export function useJoinAnother() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { cooperative?: number; code?: string; message?: string }) =>
      (await api.post<MyJoinRequest>('/me/join-requests/', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-join-requests'] }),
  })
}

export function useWithdrawJoinRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/me/join-requests/${id}/`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-join-requests'] }),
  })
}
