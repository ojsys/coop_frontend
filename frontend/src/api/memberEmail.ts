import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Paginated } from './types'
import { useAuth } from '@/auth/AuthContext'

/**
 * A society's officers writing to its members — /member-emails/
 * (communications/member_mailing.py). Members who opted out of email are left
 * out and counted. Sending is done in slices: `useSendMemberEmail` calls
 * /send/ until nothing is pending.
 */

export type MemberEmailPurpose = 'announcement' | 'reminder' | 'recovery' | 'general'
export type MemberEmailAudience = 'all' | 'role' | 'borrowers' | 'overdue' | 'selected'
export type MemberEmailStatus = 'draft' | 'sending' | 'sent'
export type MemberRecipientStatus = 'pending' | 'sent' | 'failed'

export const MEMBER_AUDIENCES: { value: MemberEmailAudience; label: string; hint: string }[] = [
  { value: 'all', label: 'All active members', hint: 'Everyone active on the register, non-members included.' },
  { value: 'selected', label: 'Selected members', hint: 'Pick particular people by name or member number.' },
  { value: 'role', label: 'Holders of a role', hint: 'Active members holding one role — the exco, say.' },
  { value: 'borrowers', label: 'Repaying a loan', hint: 'Everyone with a loan disbursed and not yet repaid.' },
  { value: 'overdue', label: 'Behind on a repayment', hint: 'Borrowers with an instalment past its due date.' },
]

/**
 * Starting points for each purpose. Picking one fills an empty draft; it
 * never overwrites what an officer has already written.
 */
export const PURPOSES: {
  value: MemberEmailPurpose
  label: string
  icon: string
  audience?: MemberEmailAudience
  subject: string
  body: string
}[] = [
  {
    value: 'announcement',
    label: 'Announcement',
    icon: 'campaign',
    subject: '',
    body: 'Dear {{first_name}},\n\n',
  },
  {
    value: 'reminder',
    label: 'Reminder',
    icon: 'notifications_active',
    subject: 'A reminder from {{cooperative}}',
    body:
      'Dear {{first_name}},\n\nThis is a friendly reminder that …\n\nThank you for being part of {{cooperative}}.',
  },
  {
    value: 'recovery',
    label: 'Loan recovery',
    icon: 'request_quote',
    audience: 'overdue',
    subject: 'Your loan repayment is overdue',
    body:
      'Dear {{first_name}},\n\nOur records show **{{amount_overdue}}** overdue on your loan with {{cooperative}}. ' +
      'Your outstanding balance is {{loan_balance}}.\n\n' +
      'Please pay as soon as you can from the member app, or speak to the Treasurer if you need to agree a plan.\n\n' +
      'Member no. {{member_no}}',
  },
  { value: 'general', label: 'General', icon: 'mail', subject: '', body: '' },
]

export const PLACEHOLDER_HINT =
  '{{name}}, {{first_name}}, {{member_no}}, {{cooperative}}, {{loan_balance}}, {{amount_overdue}}, {{next_due_date}}'

export interface MemberEmail {
  id: number
  purpose: MemberEmailPurpose
  purpose_display: string
  subject: string
  body: string
  audience: MemberEmailAudience
  audience_display: string
  audience_role: number | null
  audience_role_name: string | null
  members: number[]
  status: MemberEmailStatus
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

export interface MemberEmailInput {
  purpose: MemberEmailPurpose
  subject: string
  body: string
  audience: MemberEmailAudience
  audience_role: number | null
  members: number[]
}

export interface MemberPreviewRecipient {
  address: string
  name: string
  member_no: string
  membership_id: number
  role_name: string
  status: string
}

export interface MemberRecipientPreview {
  count: number
  opted_out: number
  no_email: number
  recipients: MemberPreviewRecipient[]
}

export interface MemberEmailRecipientRow {
  id: number
  address: string
  name: string
  member_no: string
  membership: number | null
  status: MemberRecipientStatus
  status_display: string
  sent_at: string | null
}

export const MEMBER_EMAILS_PAGE_SIZE = 25

function useCoopKey() {
  const { activeCooperativeId } = useAuth()
  return activeCooperativeId ?? 'none'
}

export function useMemberEmails(page: number) {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['member-emails', coop, page],
    queryFn: async () => {
      const { data } = await api.get<Paginated<MemberEmail>>('/member-emails/', {
        params: { page, page_size: MEMBER_EMAILS_PAGE_SIZE },
      })
      return data
    },
    placeholderData: keepPreviousData,
  })
}

export function useMemberEmail(id: number | null) {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['member-email', coop, id],
    enabled: id != null,
    queryFn: async () => {
      const { data } = await api.get<MemberEmail>(`/member-emails/${id}/`)
      return data
    },
  })
}

export function useMemberEmailRecipients(id: number | null, status: string, page: number) {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['member-email-recipients', coop, id, status, page],
    enabled: id != null,
    queryFn: async () => {
      const { data } = await api.get<Paginated<MemberEmailRecipientRow>>(
        `/member-emails/${id}/recipients/`,
        { params: { status: status || undefined, page, page_size: MEMBER_EMAILS_PAGE_SIZE } },
      )
      return data
    },
    placeholderData: keepPreviousData,
  })
}

/** Who a message with these settings would reach — asked for as the form changes. */
export function useMemberRecipientPreview(
  input: Pick<MemberEmailInput, 'audience' | 'audience_role' | 'members'>,
  enabled: boolean,
) {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['member-email-preview', coop, input],
    enabled,
    queryFn: async () => {
      const { data } = await api.post<MemberRecipientPreview>('/member-emails/preview/', input)
      return data
    },
    placeholderData: keepPreviousData,
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['member-emails'] })
    qc.invalidateQueries({ queryKey: ['member-email'] })
    qc.invalidateQueries({ queryKey: ['member-email-recipients'] })
  }
}

/** Create a draft, or save over an existing one. */
export function useSaveMemberEmail() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, ...input }: MemberEmailInput & { id?: number }) => {
      const { data } = id
        ? await api.patch<MemberEmail>(`/member-emails/${id}/`, input)
        : await api.post<MemberEmail>('/member-emails/', input)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useDeleteMemberEmail() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/member-emails/${id}/`)
    },
    onSuccess: invalidate,
  })
}

export function useTestMemberEmail() {
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<{ detail: string }>(`/member-emails/${id}/test/`)
      return data
    },
  })
}

/**
 * Send, slice by slice: each /send/ call delivers for a few seconds on the
 * server, so a large send never outlives one request. `onProgress` sees the
 * counts after every slice.
 */
export function useSendMemberEmail() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, onProgress }: { id: number; onProgress?: (e: MemberEmail) => void }) => {
      let email: MemberEmail
      do {
        const { data } = await api.post<MemberEmail>(`/member-emails/${id}/send/`)
        email = data
        onProgress?.(email)
      } while (email.status === 'sending' && email.pending_count > 0)
      return email
    },
    onSettled: invalidate,
  })
}

export function useRetryFailedMemberEmail() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<MemberEmail>(`/member-emails/${id}/retry-failed/`)
      return data
    },
    onSuccess: invalidate,
  })
}
