import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

/**
 * Signup: a society applying to the platform, a person applying to a society,
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

export function useApplyForCooperative() {
  return useMutation({
    mutationFn: async (input: CooperativeApplication) => {
      const { data } = await api.post<{ detail: string; society: string }>(
        '/public/apply/',
        input,
      )
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
 * for this as a Chairperson is a guaranteed 403 on every page.
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
