import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { api } from './client'
import type { Paginated } from './types'

/**
 * Refer and earn (backend: referrals/). A referrer shares /signup?ref=CODE;
 * a cooperative signing up through it earns them a share of each invoice it
 * pays for a set number of months. The platform pays balances out by bank
 * transfer and marks them paid.
 */

export interface ReferralProgram {
  active: boolean
  commission_percent: string
  commission_months: number
  minimum_payout: string
  updated_at?: string
}

export interface ReferralRow {
  id: number
  cooperative: number
  cooperative_name: string
  cooperative_state: string
  subscription_status: string
  commission_percent: string
  commission_months: number
  first_paid_on: string | null
  window_ends_on: string | null
  earned: string
  source: string
  created_at: string
}

export interface CommissionRow {
  id: number
  cooperative_name: string
  invoice_number: string
  paid_at: string | null
  invoice_amount: string
  percent: string
  amount: string
  status: 'earned' | 'void'
  void_reason: string
  referrer_name: string
  created_at: string
}

export type PayoutStatus = 'requested' | 'paid' | 'rejected'

export interface PayoutRow {
  id: number
  amount: string
  bank_name: string
  bank_code: string
  account_no: string
  account_name: string
  status: PayoutStatus
  status_display: string
  reference: string
  note: string
  decided_at: string | null
  referrer_name: string
  referrer_email: string
  created_at: string
}

export interface ReferrerTotals {
  earned: string
  paid: string
  requested: string
  available: string
}

export interface BankDetails {
  bank_name: string
  bank_code: string
  account_no: string
  account_name: string
}

export interface ReferrerDashboard {
  code: string
  link: string
  status: 'active' | 'suspended'
  program: ReferralProgram
  totals: ReferrerTotals
  bank: BankDetails
  has_bank_details: boolean
  referrals: ReferralRow[]
  commissions: CommissionRow[]
  payouts: PayoutRow[]
}

/** Where a visitor's referral code is kept between landing and signing up. */
const REF_KEY = 'coop.ref'

export function rememberReferralCode(code: string | null) {
  if (!code) return
  try {
    localStorage.setItem(REF_KEY, code.trim().toUpperCase())
  } catch {
    /* private mode: the code just isn't remembered */
  }
}

export function rememberedReferralCode(): string {
  try {
    return localStorage.getItem(REF_KEY) ?? ''
  } catch {
    return ''
  }
}

export function usePublicReferralProgram() {
  return useQuery({
    queryKey: ['public-referral-program'],
    queryFn: async () => (await api.get<ReferralProgram>('/public/referral-program/')).data,
    staleTime: 5 * 60_000,
  })
}

export function useReferrerSignup() {
  return useMutation({
    mutationFn: async (input: { full_name: string; email: string; phone?: string; password: string }) =>
      (await api.post<{ detail: string; code: string }>('/public/refer/', input)).data,
  })
}

// ── The signed-in referrer ──────────────────────────────────────────────────
/** Null when this account has not turned referrals on. */
export function useReferrerDashboard() {
  return useQuery({
    queryKey: ['me-referrer'],
    queryFn: async () => {
      try {
        return (await api.get<ReferrerDashboard>('/me/referrer/')).data
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 404) return null
        throw err
      }
    },
  })
}

function useSetDashboard() {
  const qc = useQueryClient()
  return (data: ReferrerDashboard) => qc.setQueryData(['me-referrer'], data)
}

export function useBecomeReferrer() {
  const set = useSetDashboard()
  return useMutation({
    mutationFn: async () => (await api.post<ReferrerDashboard>('/me/referrer/')).data,
    onSuccess: set,
  })
}

export function useSaveReferrerBank() {
  const set = useSetDashboard()
  return useMutation({
    mutationFn: async (bank: BankDetails) => (await api.patch<ReferrerDashboard>('/me/referrer/', bank)).data,
    onSuccess: set,
  })
}

export function useRequestReferralPayout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (amount: string) =>
      (await api.post<PayoutRow>('/me/referrer/payouts/', { amount })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me-referrer'] }),
  })
}

// ── The platform ────────────────────────────────────────────────────────────
export interface PlatformReferrer {
  id: number
  code: string
  status: 'active' | 'suspended'
  full_name: string
  email: string
  phone: string
  bank_name: string
  account_no: string
  account_name: string
  referral_count: number
  earned: string
  totals: ReferrerTotals
  created_at: string
  referrals?: ReferralRow[]
}

export const REFERRALS_PAGE_SIZE = 25

export function usePlatformReferrers(page: number, search: string) {
  return useQuery({
    queryKey: ['platform-referrers', page, search],
    queryFn: async () =>
      (await api.get<Paginated<PlatformReferrer>>('/platform-referrers/', {
        params: { page, page_size: REFERRALS_PAGE_SIZE, search: search || undefined },
      })).data,
    placeholderData: keepPreviousData,
  })
}

export function usePlatformReferrer(id: number | null) {
  return useQuery({
    queryKey: ['platform-referrer', id],
    enabled: id != null,
    queryFn: async () => (await api.get<PlatformReferrer>(`/platform-referrers/${id}/`)).data,
  })
}

export function usePlatformPayouts(status: string, page: number) {
  return useQuery({
    queryKey: ['platform-referral-payouts', status, page],
    queryFn: async () =>
      (await api.get<Paginated<PayoutRow>>('/platform-referral-payouts/', {
        params: { status: status || undefined, page, page_size: REFERRALS_PAGE_SIZE },
      })).data,
    placeholderData: keepPreviousData,
  })
}

export function usePlatformCommissions(page: number) {
  return useQuery({
    queryKey: ['platform-commissions', page],
    queryFn: async () =>
      (await api.get<Paginated<CommissionRow>>('/platform-commissions/', {
        params: { page, page_size: REFERRALS_PAGE_SIZE },
      })).data,
    placeholderData: keepPreviousData,
  })
}

export function usePlatformReferralProgram() {
  return useQuery({
    queryKey: ['platform-referral-program'],
    queryFn: async () => (await api.get<ReferralProgram>('/platform-referral-program/')).data,
  })
}

function useInvalidatePlatform() {
  const qc = useQueryClient()
  return () => {
    for (const key of ['platform-referrers', 'platform-referrer', 'platform-referral-payouts',
      'platform-commissions', 'platform-referral-program', 'public-referral-program']) {
      qc.invalidateQueries({ queryKey: [key] })
    }
  }
}

export function useSaveReferralProgram() {
  const invalidate = useInvalidatePlatform()
  return useMutation({
    mutationFn: async (input: Partial<ReferralProgram>) =>
      (await api.patch<ReferralProgram>('/platform-referral-program/', input)).data,
    onSuccess: invalidate,
  })
}

export function useDecidePayout() {
  const invalidate = useInvalidatePlatform()
  return useMutation({
    mutationFn: async ({ id, decision, reference, note }: {
      id: number
      decision: 'mark-paid' | 'reject'
      reference?: string
      note?: string
    }) => (await api.post<PayoutRow>(`/platform-referral-payouts/${id}/${decision}/`, { reference, note })).data,
    onSuccess: invalidate,
  })
}

export function useVoidCommission() {
  const invalidate = useInvalidatePlatform()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) =>
      (await api.post<CommissionRow>(`/platform-commissions/${id}/void/`, { reason })).data,
    onSuccess: invalidate,
  })
}

export function useReferrerAction() {
  const invalidate = useInvalidatePlatform()
  return useMutation({
    mutationFn: async ({ id, verb, cooperative }: {
      id: number
      verb: 'suspend' | 'reactivate' | 'attach'
      cooperative?: number
    }) => (await api.post<PlatformReferrer>(`/platform-referrers/${id}/${verb}/`, { cooperative })).data,
    onSuccess: invalidate,
  })
}
