import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

/**
 * A person's own data: download a copy of all of it, or ask for the account
 * to be deleted. Plus the public, email-confirmed route to the same request
 * (the one Google Play links to) and the officers' queue that completes it.
 */

export interface DeletionBlocker {
  cooperative: string | null
  message: string
}

export interface MyDeletionRequest {
  id: number
  status: 'pending' | 'completed' | 'cancelled'
  source: 'app' | 'web'
  reason: string
  created_at: string
}

export interface MyDeletionState {
  request: MyDeletionRequest | null
  /** What must be settled before an officer can complete it. */
  blockers: DeletionBlocker[]
}

// ── The signed-in person ────────────────────────────────────────────────────
export function useMyDeletionState(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['my-deletion'],
    queryFn: async () => (await api.get<MyDeletionState>('/me/deletion-request/')).data,
  })
}

export function useRequestDeletion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (reason: string) =>
      (await api.post<MyDeletionState>('/me/deletion-request/', { reason })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-deletion'] }),
  })
}

export function useCancelDeletion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => { await api.delete('/me/deletion-request/') },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-deletion'] }),
  })
}

/** Fetch the zip with the session's credentials and hand it to the browser. */
export async function downloadMyData() {
  const { data } = await api.get<Blob>('/me/data-export/', { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = `my-data-${new Date().toISOString().slice(0, 10)}.zip`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Anyone, by email ────────────────────────────────────────────────────────
export function useRequestDeletionByEmail() {
  return useMutation({
    mutationFn: async (email: string) =>
      (await api.post<{ detail: string }>('/public/account-deletion/', { email })).data,
  })
}

export function useConfirmDeletion() {
  return useMutation({
    mutationFn: async ({ token, reason }: { token: string; reason: string }) =>
      (await api.post<{ detail: string; blockers: DeletionBlocker[] }>(
        '/public/account-deletion/confirm/', { token, reason },
      )).data,
  })
}

// ── Officers ────────────────────────────────────────────────────────────────
export interface DeletionRequest {
  id: number
  full_name: string
  email: string
  member_no: string | null
  membership_id: number | null
  status: 'pending' | 'completed' | 'cancelled'
  source: 'app' | 'web'
  reason: string
  blockers: DeletionBlocker[]
  created_at: string
  completed_at: string | null
  completed_by_name: string | null
}

export function useDeletionRequests(status: DeletionRequest['status']) {
  return useQuery({
    queryKey: ['deletion-requests', status],
    queryFn: async () =>
      (await api.get<{ results: DeletionRequest[] }>('/deletion-requests/', { params: { status } }))
        .data.results,
  })
}

export function usePendingDeletionCount(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['deletion-requests', 'pending', 'count'],
    queryFn: async () =>
      (await api.get<{ count: number }>('/deletion-requests/', { params: { status: 'pending' } }))
        .data.count,
  })
}

export function useCompleteDeletion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<DeletionRequest>(`/deletion-requests/${id}/complete/`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deletion-requests'] })
      qc.invalidateQueries({ queryKey: ['members'] })
    },
  })
}
