import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { DisbursementEvidence, Loan, LoanRepayment, WalletTopUp } from './types'

// Invalidate everything tenant-scoped after a write — simplest correct default
// given how interconnected the ledger, contributions and dashboards are.
function useInvalidateAll() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries()
}

export interface RecordContributionInput {
  membership: number
  contribution_type: number
  amount: string
  channel: 'cash' | 'transfer' | 'psp'
  occurred_at?: string
  psp_reference?: string
}

export function useRecordContribution() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: RecordContributionInput) => {
      const { data } = await api.post('/contributions/record/', input)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useInitiateContribution() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: RecordContributionInput) => {
      const { data } = await api.post('/contributions/initiate/', input)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useVerifyPayment() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (reference: string) => {
      const { data } = await api.post('/contributions/verify/', { reference })
      return data as { status: string; amount: string; type_name?: string }
    },
    onSuccess: invalidate,
  })
}

export function useReverseContribution() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/contributions/${id}/reverse/`)
      return data
    },
    onSuccess: invalidate,
  })
}

export interface CreateMemberInput {
  member_no: string
  full_name: string
  email: string
  phone?: string
  role?: number | null
  share_capital?: string
  status?: string
}

export function useCreateMember() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: CreateMemberInput) => {
      const { data } = await api.post('/members/', input)
      return data
    },
    onSuccess: invalidate,
  })
}

export interface CreateContributionTypeInput {
  name: string
  frequency: string
  kind: string
  expected_amount?: string | null
  gl_account?: number | null
  active?: boolean
}

export function useCreateContributionType() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: CreateContributionTypeInput) => {
      const { data } = await api.post('/contribution-types/', input)
      return data
    },
    onSuccess: invalidate,
  })
}

export interface UpdateMemberInput {
  id: number
  full_name?: string
  phone?: string
  role?: number | null
  status?: string
  share_capital?: string
  member_no?: string
  date_of_birth?: string | null
  gender?: string
  address?: string
  occupation?: string
  next_of_kin_name?: string
  next_of_kin_phone?: string
  bank_name?: string
  /** Paystack's code for `bank_name`. Omitting it was why officers could save a
   *  member's bank details that could never receive a payout. */
  bank_code?: string
  bank_account_no?: string
}

export function useUpdateMember() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateMemberInput) => {
      const { data } = await api.patch(`/members/${id}/`, input)
      return data
    },
    onSuccess: invalidate,
  })
}

export interface ImportResult {
  created: number
  total: number
  errors: { row: number; error: string }[]
}

export function useBulkImportMembers() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post<ImportResult>('/members/import/', fd)
      return data
    },
    onSuccess: invalidate,
  })
}

/** Upload/replace a member's headshot (multipart PATCH). */
export function useUploadMemberPhoto() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const fd = new FormData()
      fd.append('photo', file)
      const { data } = await api.patch(`/members/${id}/`, fd)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useUploadMemberDocument() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ membership, doc_type, label, file }: {
      membership: number; doc_type: string; label: string; file: File
    }) => {
      const fd = new FormData()
      fd.append('membership', String(membership))
      fd.append('doc_type', doc_type)
      fd.append('label', label)
      fd.append('file', file)
      const { data } = await api.post('/member-documents/', fd)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useDeleteMemberDocument() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/member-documents/${id}/`)
      return id
    },
    onSuccess: invalidate,
  })
}

// ── Member self-service (/me/…) ─────────────────────────────────────────────
export function useApplyLoan() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: { product: number; principal: string; term_months: number; purpose?: string }) => {
      const { data } = await api.post('/me/loans/', input)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useInitiateLoanRepayment() {
  return useMutation({
    mutationFn: async (input: { loanId: number; amount: string; psp_reference: string; callback_url?: string }) => {
      const { loanId, ...body } = input
      const { data } = await api.post(`/me/loans/${loanId}/repay-initiate/`, body)
      return data as {
        reference: string
        authorization_url?: string
        payment_error?: string
        payment_simulated?: boolean
        paystack_public_key?: string
        payer_email?: string
        amount_kobo?: number
      }
    },
  })
}

export function useVerifyLoanRepayment() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: { loanId: number; reference: string }) => {
      const { data } = await api.post(`/me/loans/${input.loanId}/repay-verify/`, { reference: input.reference })
      return data as Loan & { payment_status?: string }
    },
    onSuccess: invalidate,
  })
}

// Member reports a direct bank transfer ("I have paid") → pending claim an
// officer confirms.
export function useReportTransfer() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: { loanId: number; amount?: string; note?: string; transfer?: number }) => {
      const { loanId, ...body } = input
      const { data } = await api.post(`/me/loans/${loanId}/report-transfer/`, body)
      return data
    },
    onSuccess: invalidate,
  })
}

export type StartedTransfer = LoanRepayment & {
  psp_reference: string
  expires_at: string
  bank: { bank_name: string; account_name: string; account_no: string }
}

/** Begin a fee-free repayment by bank transfer: the society's account, the
 *  amount, a narration reference and a 30-minute window. */
export function useStartTransfer() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ loanId, amount }: { loanId: number; amount: string }) => {
      const { data } = await api.post<StartedTransfer>(`/me/loans/${loanId}/start-transfer/`, { amount })
      return data
    },
    onSuccess: invalidate,
  })
}

export function useCancelTransfer() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ loanId, transfer }: { loanId: number; transfer: number }) => {
      await api.post(`/me/loans/${loanId}/cancel-transfer/`, { transfer })
    },
    onSuccess: invalidate,
  })
}

// Officer side: verify/confirm or dismiss a reported transfer.
export function useConfirmRepayment() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/loan-repayments/${id}/confirm/`)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useRejectRepayment() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/loan-repayments/${id}/reject/`)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useCreateMyGoal() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: { product: number; name: string; target_amount: string; target_date?: string | null }) => {
      const { data } = await api.post('/me/savings-goals/', input)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useDeleteMyGoal() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/me/savings-goals/${id}/`)
      return id
    },
    onSuccess: invalidate,
  })
}

export function useUpdateMyProfile() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await api.patch('/me/profile/', input)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useUploadMyPhoto() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('photo', file)
      const { data } = await api.patch('/me/profile/', fd)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useUploadMyDocument() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ doc_type, label, file }: { doc_type: string; label: string; file: File }) => {
      const fd = new FormData()
      fd.append('doc_type', doc_type)
      fd.append('label', label)
      fd.append('file', file)
      const { data } = await api.post('/me/documents/', fd)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useDeleteMyDocument() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/me/documents/${id}/`)
      return id
    },
    onSuccess: invalidate,
  })
}

export function useUpdateContributionType() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: number } & Partial<CreateContributionTypeInput>) => {
      const { data } = await api.patch(`/contribution-types/${id}/`, input)
      return data
    },
    onSuccess: invalidate,
  })
}

export interface CreateMeetingInput {
  title: string
  location?: string
  agenda?: string
  scheduled_at: string
  proxy_enabled?: boolean
}

export function useCreateMeeting() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: CreateMeetingInput) => {
      const { data } = await api.post('/meetings/', input)
      return data
    },
    onSuccess: invalidate,
  })
}

export interface CreateResolutionInput {
  title: string
  description?: string
  meeting?: number | null
  voting_mode?: 'one_member' | 'weighted'
}

export function useCreateResolution() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: CreateResolutionInput) => {
      const { data } = await api.post('/resolutions/', input)
      return data
    },
    onSuccess: invalidate,
  })
}

export interface UpdateCooperativeInput {
  id: number
  name?: string
  coop_type?: string
  country?: string
  state?: string
  lga?: string
  base_currency?: string
  tier?: string
  brand_color?: string
  member_cap?: number
  // The collection account is deliberately absent. It is the one field where a
  // single officer could redirect every future payment, so the server refuses
  // it here — it goes through useProposeBankDetails and takes effect only once
  // a different privileged officer approves. Leaving it in this type would let
  // the profile form post values that are silently discarded.
  // Public contact details and the statement footer.
  contact_email?: string
  contact_phone?: string
  contact_address?: string
  statement_footer?: string
  join_code?: string
  join_link_enabled?: boolean
}

export function useUpdateCooperative() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCooperativeInput) => {
      const { data } = await api.patch(`/cooperatives/${id}/`, input)
      return data
    },
    onSuccess: invalidate,
  })
}

/** Upload/replace a society's logo or favicon (multipart PATCH). */
export function useUploadCooperativeBrandAsset() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ id, field, file }: {
      id: number; field: 'logo' | 'favicon'; file: File
    }) => {
      const fd = new FormData()
      fd.append(field, file)
      const { data } = await api.patch(`/cooperatives/${id}/`, fd)
      return data
    },
    onSuccess: invalidate,
  })
}

export interface RoleInput {
  id?: number
  slug?: string
  name?: string
  permissions?: string[]
}

export function useCreateRole() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: RoleInput) => {
      const { data } = await api.post('/roles/', input)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useUpdateRole() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ id, ...input }: RoleInput & { id: number }) => {
      const { data } = await api.patch(`/roles/${id}/`, input)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useDeleteRole() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/roles/${id}/`)
      return id
    },
    onSuccess: invalidate,
  })
}

export function useSendArrearsReminders() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ reached: number; members_in_arrears: number }>('/reports/send-arrears-reminders/')
      return data
    },
    onSuccess: invalidate,
  })
}

export function useDeleteAnnouncement() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/announcements/${id}/`)
      return id
    },
    onSuccess: invalidate,
  })
}

export interface CreateAnnouncementInput {
  title: string
  body: string
  audience?: string
  audience_role?: number | null
  channels: string[]
}

export function useCreateAnnouncement() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: CreateAnnouncementInput) => {
      const { data } = await api.post('/announcements/', input)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useSendAnnouncement() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/announcements/${id}/send/`)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useResolutionAction() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({
      id,
      action,
      body,
    }: {
      id: number
      action: 'open' | 'close' | 'vote'
      body?: Record<string, unknown>
    }) => {
      const { data } = await api.post(`/resolutions/${id}/${action}/`, body ?? {})
      return data
    },
    onSuccess: invalidate,
  })
}

export function useRematchEvent() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/payment-events/${id}/rematch/`)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useRematchAll() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ rematched: number }>('/payment-events/rematch-all/')
      return data
    },
    onSuccess: invalidate,
  })
}

export interface ProvisionCooperativeInput {
  name: string
  slug: string
  registration_no?: string
  coop_type?: string
  country?: string
  state?: string
  lga?: string
  tier?: string
  member_cap?: number
}

export function useProvisionCooperative() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: ProvisionCooperativeInput) => {
      const { data } = await api.post('/cooperatives/', input)
      return data
    },
    onSuccess: invalidate,
  })
}

// ── Platform-admin mutations ────────────────────────────────────────────────
// A small generic CRUD helper keeps the many platform resources terse. Each
// resource gets create/update/remove hooks that invalidate the whole cache
// (platform aggregates like billing/attention derive from these tables).

interface CrudInput {
  id?: number
  [key: string]: unknown
}

function useCrud(resource: string) {
  const create = useCrudCreate(resource)
  const update = useCrudUpdate(resource)
  const remove = useCrudRemove(resource)
  const action = useCrudAction(resource)
  return { create, update, remove, action }
}

export function useCrudCreate(resource: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: CrudInput) => {
      const { data } = await api.post(`/${resource}/`, input)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useCrudUpdate(resource: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ id, ...input }: CrudInput) => {
      const { data } = await api.patch(`/${resource}/${id}/`, input)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useCrudRemove(resource: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/${resource}/${id}/`)
      return id
    },
    onSuccess: invalidate,
  })
}

/** POST /{resource}/{id}/{action}/ — for custom actions (verify, advance…). */
export function useCrudAction(resource: string) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({
      id,
      action,
      body,
    }: {
      id: number
      action: string
      body?: Record<string, unknown>
    }) => {
      const { data } = await api.post(`/${resource}/${id}/${action}/`, body ?? {})
      return data
    },
    onSuccess: invalidate,
  })
}

export const usePlansCrud = () => useCrud('plans')
export const useSubscriptionsCrud = () => useCrud('subscriptions')
export const useInvoicesCrud = () => useCrud('invoices')
export const useOnboardingCrud = () => useCrud('onboarding-items')
export const useDomainsCrud = () => useCrud('domains')
export const useProviderStatusCrud = () => useCrud('provider-status')
export const usePlatformTeamCrud = () => useCrud('platform-team')
export const useSupportTicketsCrud = () => useCrud('support-tickets')
export const useIncidentsCrud = () => useCrud('incidents')
export const useProviderAccountsCrud = () => useCrud('provider-accounts')
export const useSavingsProductsCrud = () => useCrud('savings-products')
export const useSavingsGoalsCrud = () => useCrud('savings-goals')
export const useDividendsCrud = () => useCrud('dividends')
export const useLoanProductsCrud = () => useCrud('loan-products')
export const useMembersCrud = () => useCrud('members')
export const useLoansCrud = () => useCrud('loans')
export const useApprovalsCrud = () => useCrud('approvals')
export const useMeetingsCrud = () => useCrud('meetings')
export const useResolutionsCrud = () => useCrud('resolutions')
export const useAttendancesCrud = () => useCrud('attendances')
export const useNotificationTemplatesCrud = () => useCrud('notification-templates')

export function useUpdatePlatformProfile() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await api.patch('/platform/profile/', input)
      return data
    },
    onSuccess: invalidate,
  })
}

/** Upload/replace the platform's own logo or favicon (multipart PATCH). */
export function useUploadPlatformBrandAsset() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ field, file }: {
      field: 'logo' | 'favicon'; file: File
    }) => {
      const fd = new FormData()
      fd.append(field, file)
      const { data } = await api.patch('/platform/profile/', fd)
      return data
    },
    onSuccess: invalidate,
  })
}

// Cooperative lifecycle: POST /cooperatives/{id}/{suspend|reactivate|offboard}/
export function useCooperativeAction() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: number
      action: 'suspend' | 'reactivate' | 'offboard'
    }) => {
      const { data } = await api.post(`/cooperatives/${id}/${action}/`)
      return data
    },
    onSuccess: invalidate,
  })
}

/**
 * Open a support session as somebody inside a cooperative.
 *
 * Naming a `membership` impersonates that specific person — support is
 * usually reproducing one particular member's problem. Omitting it keeps the
 * original behaviour: the server picks any officer.
 */
export function useImpersonate() {
  return useMutation({
    mutationFn: async ({ id, membership }: { id: number; membership?: number }) => {
      const { data } = await api.post<import('./types').ImpersonateResult>(
        `/cooperatives/${id}/impersonate/`,
        membership ? { consent: true, membership } : { consent: true },
      )
      return data
    },
  })
}

export function useCooperativeHealthCheck() {
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.get<import('./types').CooperativeHealth>(
        `/cooperatives/${id}/health-check/`,
      )
      return data
    },
  })
}

export interface ProposeBankDetailsInput {
  id: number
  bank_name: string
  /**
   * Paystack's code for the bank. Required rather than optional on purpose:
   * the society's settlement subaccount is created from the code, so a
   * proposal that omits it produces bank details that cannot be paid to. The
   * endpoint reads each field off the request body individually, so a field
   * that isn't sent is silently discarded.
   */
  bank_code: string
  bank_account_name: string
  bank_account_no: string
  note?: string
}

/**
 * Propose new collection-account details for a second officer to vet.
 *
 * Separate from useUpdateCooperative because these fields are not writable on
 * the profile at all: a change here creates an approval request and takes
 * effect only when a *different* privileged officer approves it. Invalidates
 * approvals so the pending request appears in the queue immediately.
 */
export function useProposeBankDetails() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: ProposeBankDetailsInput) => {
      const { data } = await api.post<{
        detail: string
        change_id: number
        approval_id: number
        summary: string
      }>(`/cooperatives/${id}/propose-bank-details/`, input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['cooperative'] })
    },
  })
}

export interface RequestWithdrawalInput {
  membership: number
  amount: string
  channel: 'cash' | 'transfer'
  reason?: string
}

/**
 * Record a savings payout and send it for a second officer's approval.
 *
 * Nothing moves when this succeeds: the response carries `approval_id`, and the
 * money only leaves once a different privileged officer approves it. Invalidates
 * approvals so the pending request shows up in that queue immediately.
 */
export function useRequestWithdrawal() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: RequestWithdrawalInput) => {
      const { data } = await api.post('/withdrawals/', input)
      return data as { id: number; approval_id: number; detail: string }
    },
    onSuccess: invalidate,
  })
}

export interface RequestMyWithdrawalInput {
  amount: string
  channel: 'cash' | 'transfer'
  reason?: string
}

/**
 * A member asking for their own savings back.
 *
 * Deliberately carries no `membership`: the backend takes it from the signed-in
 * caller and ignores the body, so this cannot be pointed at another member. That
 * is why it is a separate mutation from `useRequestWithdrawal` rather than the
 * same one with the field omitted.
 *
 * Nothing moves on success — the response carries `approval_id`, and an officer
 * must approve before any money leaves.
 */
export function useRequestMyWithdrawal() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: RequestMyWithdrawalInput) => {
      const { data } = await api.post('/me/withdrawals/', input)
      return data as { id: number; approval_id: number; detail: string }
    },
    onSuccess: invalidate,
  })
}

export interface RecordInternalTransferInput {
  from_account: number
  to_account: number
  amount: string
  occurred_at?: string
  note?: string
}

/**
 * Record the cooperative moving its own money between its own accounts.
 *
 * Unlike a withdrawal this posts immediately rather than raising an approval:
 * both legs are the cooperative's own asset accounts, so nothing leaves and no
 * member's balance changes. The backend refuses any non-asset account, which is
 * what keeps this from being a payout without approval.
 */
export function useRecordInternalTransfer() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: RecordInternalTransferInput) => {
      const { data } = await api.post('/internal-transfers/', input)
      return data
    },
    onSuccess: invalidate,
  })
}

/**
 * Create the society's PSP settlement subaccount at the provider.
 *
 * This is what makes collections settle into the society's *own* bank rather
 * than the platform's account. It is not done at provisioning: a subaccount
 * needs verified bank details, and those arrive later and through dual control.
 *
 * Requires the bank **code**, not just the name — Paystack identifies the
 * settlement bank by code — so a society whose details predate bank selection
 * gets a 400 naming what is missing.
 *
 * Idempotent server-side: calling it twice returns the existing account instead
 * of splitting one society's settlement across two subaccounts.
 */
export interface FundWalletInput {
  amount: string
  email?: string
  callback_url?: string
}

/**
 * Start a checkout that funds the society's disbursement wallet.
 *
 * The wallet is the only money the platform holds, and it is the society's
 * own — collections settle to its bank through its subaccount. An officer funds
 * it when they intend to lend, because an electronic disbursement can only draw
 * on money actually sitting at the payment provider.
 *
 * Nothing is credited here. The response carries a checkout URL (or `null` when
 * no live key is configured); the wallet moves only once the payment is
 * confirmed.
 */
export function useFundWallet() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: FundWalletInput) => {
      const { data } = await api.post('/wallet/topup/', input)
      return data as {
        detail: string
        authorization_url: string | null
        topup: { psp_reference: string }
      }
    },
    onSuccess: invalidate,
  })
}

/**
 * Confirm a wallet top-up against the provider and credit the wallet.
 *
 * Idempotent server-side, so it is safe to call from a payment return URL that
 * the browser may replay — a second call returns the already-confirmed record
 * rather than crediting the wallet twice.
 */
export function useVerifyWalletTopUp() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (reference: string) => {
      const { data } = await api.post('/wallet/verify/', { reference })
      return data as { balance: string; topup: WalletTopUp }
    },
    onSuccess: invalidate,
  })
}

/**
 * Send wallet funds back to the society's own bank account.
 *
 * The float is the society's own money, and this is how it takes it back. One
 * privileged officer suffices because the destination can only be the society's
 * own collection account, which already required two officers to set.
 */
/**
 * Ask the provider what really happened to one payout.
 *
 * This is the answer to "it still says pending but the money has gone". Safe to
 * press repeatedly: a payout that has reached a final state only records the
 * newer payload, and a failure is never reversed twice.
 */
/**
 * Ask the provider whether a loan's transfer actually landed.
 *
 * Privileged: the answer is applied through the same path as a webhook, so a
 * transfer that turns out to have failed reverses its journal and puts the loan
 * back to approved. That is money moving, not a lookup.
 */
export function useRecheckDisbursement() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (loanId: number) => {
      const { data } = await api.post(
        `/loans/${loanId}/recheck-disbursement/`)
      return data as DisbursementEvidence
    },
    onSuccess: invalidate,
  })
}

/**
 * Apply the safe correction for one loan-health finding — only those the
 * server marks auto-fixable, which move no money (e.g. reopening a loan
 * marked repaid while a balance is still owed).
 */
export function useFixLoanHealth() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: { loanId: number; code: string }) => {
      const { data } = await api.post(`/loans/${input.loanId}/fix-health/`, { code: input.code })
      return data as { result: string }
    },
    onSuccess: invalidate,
  })
}

export function useRecheckPayout() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/payouts/${id}/recheck/`)
      return data as { detail: string; changed: boolean }
    },
    onSuccess: invalidate,
  })
}

/** Recheck every payout still in flight — after a batch where webhooks went missing. */
export function useRecheckAllPayouts() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/payouts/recheck-all/')
      return data as {
        checked: number
        changed: number
        unreachable: number
        detail: string
      }
    },
    onSuccess: invalidate,
  })
}

export function useWithdrawWallet() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (input: { amount: string; reason?: string }) => {
      const { data } = await api.post('/wallet/withdraw/', input)
      return data as { detail: string; balance: string }
    },
    onSuccess: invalidate,
  })
}

export function useConnectSettlementAccount() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (cooperativeId: number) => {
      const { data } = await api.post(
        `/cooperatives/${cooperativeId}/connect-settlement-account/`,
      )
      return data as {
        detail: string
        subaccount_code: string
        created: boolean
      }
    },
    onSuccess: invalidate,
  })
}
