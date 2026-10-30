import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { useAuth } from '@/auth/AuthContext'
import type { CooperativeVerificationStatus, MemberDocument } from './types'

/**
 * A cooperative's KYC (tenants/verification.py).
 *
 * A society is live from signup; verification is what opens online payments,
 * the disbursement wallet and electronic loan payouts. The console reads the
 * checklist and submits it; the platform reviews it.
 */

export interface VerificationHolder {
  membership_id: number
  user_id: number
  full_name: string
  email: string
  member_no: string
  has_id: boolean
}

export interface VerificationOffice {
  role_slug: 'chairperson' | 'secretary' | 'treasurer'
  role_name: string
  /** Only the Chairperson is required; Secretary and Treasurer are optional. */
  required: boolean
  holders: VerificationHolder[]
  done: boolean
}

export interface VerificationDocumentSlot {
  doc_type: CooperativeDocType
  label: string
  required: boolean
  done: boolean
}

export interface VerificationChecklist {
  status: CooperativeVerificationStatus
  status_display: string
  submitted_at: string | null
  reviewed_at: string | null
  reviewer_note: string
  officers: VerificationOffice[]
  documents: VerificationDocumentSlot[]
  /** Plain sentences, in the order they should be done. */
  missing: string[]
  ready: boolean
}

export type CooperativeDocType =
  | 'registration_certificate'
  | 'bye_laws'
  | 'election_minutes'
  | 'other'

export interface CooperativeDocument {
  id: number
  doc_type: CooperativeDocType
  doc_type_display: string
  label: string
  /** A signed, expiring URL. */
  file: string
  created_at: string
}

function useCoopKey() {
  const { activeCooperativeId } = useAuth()
  return activeCooperativeId ?? 'none'
}

// ── Console ─────────────────────────────────────────────────────────────────
export function useVerification(enabled = true) {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['verification', coop],
    queryFn: async () => {
      const { data } = await api.get<VerificationChecklist>('/verification/')
      return data
    },
    enabled,
  })
}

export function useCooperativeDocuments() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['cooperative-documents', coop],
    queryFn: async () => {
      const { data } = await api.get<
        CooperativeDocument[] | { results: CooperativeDocument[] }
      >('/cooperative-documents/', { params: { page_size: 100 } })
      return Array.isArray(data) ? data : data.results
    },
  })
}

export function useSubmitVerification() {
  const qc = useQueryClient()
  const { refresh } = useAuth()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<VerificationChecklist>(
        '/verification/submit/',
      )
      return data
    },
    onSuccess: async () => {
      await qc.invalidateQueries()
      // The status rides on /me too (the banner reads it from there).
      await refresh()
    },
  })
}

export function useUploadCooperativeDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ doc_type, file }: { doc_type: CooperativeDocType; file: File }) => {
      const fd = new FormData()
      fd.append('doc_type', doc_type)
      fd.append('file', file)
      const { data } = await api.post<CooperativeDocument>('/cooperative-documents/', fd)
      return data
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}

export function useDeleteCooperativeDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/cooperative-documents/${id}/`)
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}

export function useResendEmailVerification() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ detail: string }>('/me/verify-email/')
      return data
    },
  })
}

/** Public — the link in the email, opened possibly while signed out. */
export function useConfirmEmail() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { data } = await api.post<{ detail: string; email: string }>(
        '/auth/verify-email/',
        { token },
      )
      return data
    },
  })
}

// ── Platform ────────────────────────────────────────────────────────────────
export interface PlatformVerification {
  id: number
  cooperative_id: number
  cooperative_name: string
  status: CooperativeVerificationStatus
  status_display: string
  submitted_at: string | null
  submitted_by_name: string | null
  reviewed_at: string | null
  reviewed_by_name: string | null
  reviewer_note: string
  created_at: string
}

export interface PlatformVerificationDetail extends PlatformVerification {
  checklist: VerificationChecklist
  documents: CooperativeDocument[]
  officer_documents: MemberDocument[]
  registration_no: string
}

export function usePlatformVerifications(status: string) {
  return useQuery({
    queryKey: ['platform-verifications', status],
    queryFn: async () => {
      const { data } = await api.get<
        PlatformVerification[] | { results: PlatformVerification[] }
      >('/platform-verifications/', {
        params: { status: status || undefined, page_size: 200 },
      })
      return Array.isArray(data) ? data : data.results
    },
  })
}

export function usePlatformVerification(cooperativeId: number | null) {
  return useQuery({
    queryKey: ['platform-verification', cooperativeId],
    enabled: cooperativeId != null,
    queryFn: async () => {
      const { data } = await api.get<PlatformVerificationDetail>(
        `/platform-verifications/${cooperativeId}/`,
      )
      return data
    },
  })
}

export function useDecideVerification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cooperativeId,
      outcome,
      note,
    }: {
      cooperativeId: number
      outcome: 'approve' | 'request-changes'
      note?: string
    }) => {
      const { data } = await api.post<PlatformVerification>(
        `/platform-verifications/${cooperativeId}/${outcome}/`,
        note ? { note } : {},
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}
