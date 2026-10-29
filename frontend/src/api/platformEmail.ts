import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Paginated } from './types'

/**
 * The platform team writing to cooperatives' officers — /platform-emails/
 * (platform_admin/mailing.py). Recipients are each cooperative's current
 * privileged officers plus, optionally, its contact address. Sending is done
 * in slices: `useSendPlatformEmail` calls /send/ until nothing is pending.
 */

export type EmailAudience = 'all' | 'trial' | 'unverified' | 'selected'
export type EmailStatus = 'draft' | 'sending' | 'sent'
export type RecipientStatus = 'pending' | 'sent' | 'failed'

export const AUDIENCES: { value: EmailAudience; label: string; hint: string }[] = [
  { value: 'selected', label: 'Selected cooperatives', hint: 'Choose cooperatives — and, if you like, particular officers.' },
  { value: 'all', label: 'Every live cooperative', hint: 'All active cooperatives on the platform.' },
  { value: 'trial', label: 'On their free trial', hint: 'Active cooperatives whose subscription is still a trial.' },
  { value: 'unverified', label: 'Not yet verified', hint: 'Active cooperatives whose KYC is not approved.' },
]

export interface PlatformEmail {
  id: number
  subject: string
  body: string
  audience: EmailAudience
  audience_display: string
  cooperatives: number[]
  cooperative_names: string[]
  only_users: number[]
  include_contact_email: boolean
  status: EmailStatus
  status_display: string
  created_by_name: string | null
  sent_by_name: string | null
  sent_at: string | null
  finished_at: string | null
  recipient_count: number
  sent_count: number
  failed_count: number
  pending_count: number
  created_at: string
  updated_at: string
}

export interface PlatformEmailInput {
  subject: string
  body: string
  audience: EmailAudience
  cooperatives: number[]
  only_users: number[]
  include_contact_email: boolean
}

export interface PreviewRecipient {
  address: string
  name: string
  capacity: string
  cooperative_id: number | null
  cooperative_name: string
  user_id: number | null
}

export interface RecipientPreview {
  count: number
  cooperative_count: number
  recipients: PreviewRecipient[]
}

export interface EmailRecipientRow {
  id: number
  address: string
  name: string
  capacity: string
  cooperative: number | null
  cooperative_name: string | null
  status: RecipientStatus
  status_display: string
  sent_at: string | null
}

export const EMAILS_PAGE_SIZE = 25

export function usePlatformEmails(page: number) {
  return useQuery({
    queryKey: ['platform-emails', page],
    queryFn: async () => {
      const { data } = await api.get<Paginated<PlatformEmail>>('/platform-emails/', {
        params: { page, page_size: EMAILS_PAGE_SIZE },
      })
      return data
    },
    placeholderData: keepPreviousData,
  })
}

export function usePlatformEmail(id: number | null) {
  return useQuery({
    queryKey: ['platform-email', id],
    enabled: id != null,
    queryFn: async () => {
      const { data } = await api.get<PlatformEmail>(`/platform-emails/${id}/`)
      return data
    },
  })
}

export function useEmailRecipients(id: number | null, status: string, page: number) {
  return useQuery({
    queryKey: ['platform-email-recipients', id, status, page],
    enabled: id != null,
    queryFn: async () => {
      const { data } = await api.get<Paginated<EmailRecipientRow>>(
        `/platform-emails/${id}/recipients/`,
        { params: { status: status || undefined, page, page_size: EMAILS_PAGE_SIZE } },
      )
      return data
    },
    placeholderData: keepPreviousData,
  })
}

/** Who a message with these settings would reach — asked for as the form changes. */
export function useRecipientPreview(input: Omit<PlatformEmailInput, 'subject' | 'body'>, enabled: boolean) {
  return useQuery({
    queryKey: ['platform-email-preview', input],
    enabled,
    queryFn: async () => {
      const { data } = await api.post<RecipientPreview>('/platform-emails/preview/', input)
      return data
    },
    placeholderData: keepPreviousData,
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['platform-emails'] })
    qc.invalidateQueries({ queryKey: ['platform-email'] })
    qc.invalidateQueries({ queryKey: ['platform-email-recipients'] })
  }
}

/** Create a draft, or save over an existing one. */
export function useSavePlatformEmail() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, ...input }: PlatformEmailInput & { id?: number }) => {
      const { data } = id
        ? await api.patch<PlatformEmail>(`/platform-emails/${id}/`, input)
        : await api.post<PlatformEmail>('/platform-emails/', input)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useDeletePlatformEmail() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/platform-emails/${id}/`)
    },
    onSuccess: invalidate,
  })
}

export function useTestPlatformEmail() {
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<{ detail: string }>(`/platform-emails/${id}/test/`)
      return data
    },
  })
}

/**
 * Send, slice by slice: each /send/ call delivers for a few seconds on the
 * server, so a large send never outlives one request. `onProgress` sees the
 * counts after every slice.
 */
export function useSendPlatformEmail() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, onProgress }: { id: number; onProgress?: (e: PlatformEmail) => void }) => {
      let email: PlatformEmail
      do {
        const { data } = await api.post<PlatformEmail>(`/platform-emails/${id}/send/`)
        email = data
        onProgress?.(email)
      } while (email.status === 'sending' && email.pending_count > 0)
      return email
    },
    onSettled: invalidate,
  })
}

export function useRetryFailedEmail() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<PlatformEmail>(`/platform-emails/${id}/retry-failed/`)
      return data
    },
    onSuccess: invalidate,
  })
}
