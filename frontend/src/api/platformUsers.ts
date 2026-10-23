import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { AuditLog, Paginated } from './types'

/** Platform staff managing anyone's account — /platform-users/. Every change
 *  made through these is written to the audit log server-side. */

export interface PlatformUser {
  id: number
  full_name: string
  email: string
  phone: string
  is_active: boolean
  is_platform_admin: boolean
  is_superuser: boolean
  last_login: string | null
  created_at: string
  memberships: {
    cooperative_id: number
    cooperative_name: string
    member_no: string
    role: string | null
    status: string
  }[]
}

export const PLATFORM_USERS_PAGE_SIZE = 25

export function usePlatformUsers(search: string, page: number) {
  return useQuery({
    queryKey: ['platform-users', search, page],
    queryFn: async () => {
      const { data } = await api.get<Paginated<PlatformUser>>('/platform-users/', {
        params: { search: search || undefined, page, page_size: PLATFORM_USERS_PAGE_SIZE },
      })
      return data
    },
    placeholderData: keepPreviousData,
  })
}

/** Account-change history: one person's when `userId` is given, otherwise
 *  every change platform staff have made. */
export function usePlatformUserActivity(userId?: number) {
  return useQuery({
    queryKey: ['platform-user-activity', userId ?? 'all'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<AuditLog>>('/platform-users/activity/', {
        params: { user: userId, page_size: 50 },
      })
      return data.results
    },
  })
}

function useInvalidateUsers() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['platform-users'] })
    qc.invalidateQueries({ queryKey: ['platform-user-activity'] })
  }
}

export function useUpdatePlatformUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: number; full_name: string; email: string; phone: string }) => {
      const { data } = await api.patch<PlatformUser>(`/platform-users/${id}/`, body)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useSetPlatformUserPassword() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const { data } = await api.post<{ detail: string }>(`/platform-users/${id}/set-password/`, { password })
      return data
    },
    onSuccess: invalidate,
  })
}

export function useSendPlatformUserResetLink() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<{ detail: string }>(`/platform-users/${id}/send-reset-link/`)
      return data
    },
    onSuccess: invalidate,
  })
}
