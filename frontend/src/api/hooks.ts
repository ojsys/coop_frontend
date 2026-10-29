import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { AxiosRequestConfig } from 'axios'
import { api } from './client'
import { useAuth } from '@/auth/AuthContext'
import type {
  Account,
  DisbursementEvidence,
  InternalTransfer,
  LoanHealth,
  Payout,
  WalletSummary,
  Withdrawal,
  CooperativeActivity,
  SiteActivity,
  Announcement,
  ApprovalRequest,
  ArrearsReport,
  Attendance,
  AttentionItem,
  AuditEvent,
  AuditLog,
  BillingSummary,
  FleetHealth,
  Incident,
  MemberDocument,
  NotificationTemplate,
  PaymentMonitor,
  PlatformProfile,
  PlatformMemberHit,
  Contribution,
  ContributionSummary,
  ContributionType,
  Cooperative,
  DashboardData,
  DividendDeclaration,
  DividendSurplus,
  Domain,
  Invoice,
  LedgerEntry,
  Loan,
  LoanProduct,
  RepaymentClaim,
  Member,
  MemberDividend,
  MemberStatement,
  Meeting,
  NotificationItem,
  OnboardingItem,
  Paginated,
  PaymentEvent,
  Plan,
  PlatformAnalytics,
  PlatformHealth,
  PlatformTeamMember,
  ReconSummary,
  Reference,
  Resolution,
  Role,
  SavingsGoal,
  SavingsProduct,
  Subscription,
  SupportTicket,
} from './types'

// DRF list endpoints are paginated; unwrap to results when present.
function unwrap<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results
}

/**
 * Every row of a paginated list, not just its first page.
 *
 * The console's tables search, filter and count on the client, so reading only
 * page one (25 rows) silently hid everything after it. Asks for the server's
 * largest page and follows on until there is no next page.
 */
async function getAll<T>(url: string, config: AxiosRequestConfig = {}): Promise<T[]> {
  const rows: T[] = []
  for (let page = 1; page <= 200; page++) {
    const { data } = await api.get<Paginated<T> | T[]>(url, {
      ...config,
      params: { ...config.params, page_size: 500, page },
    })
    if (Array.isArray(data)) return data
    rows.push(...data.results)
    if (!data.next) break
  }
  return rows
}

// Scope query keys by active cooperative so switching tenants refetches.
function useCoopKey() {
  const { activeCooperativeId } = useAuth()
  return activeCooperativeId ?? 'none'
}

export function useDashboard(params?: { year?: number; month?: number }) {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['dashboard', coop, params],
    queryFn: async () => {
      const { data } = await api.get<DashboardData>('/reports/dashboard/', { params })
      return data
    },
  })
}

export function useMembers(params?: { status?: string }) {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['members', coop, params],
    queryFn: async () => {
      return getAll<Member>('/members/', { params })
    },
  })
}

/**
 * Members of *another* cooperative, for the platform console.
 *
 * The tenant normally comes from the signed-in user's own context, which a
 * platform admin does not have — they belong to no cooperative. Passing the
 * header explicitly is enough: the request interceptor only fills it in when
 * it is absent, and resolve_cooperative lets a platform admin bind any
 * cooperative (everyone else fails closed to their own).
 */
export function usePlatformMembers(cooperativeId: number | undefined) {
  return useQuery({
    enabled: cooperativeId != null,
    queryKey: ['platform-members', cooperativeId],
    queryFn: async () => {
      return getAll<Member>('/members/', { headers: { 'X-Cooperative-Id': String(cooperativeId) } })
    },
  })
}

/**
 * One member's full profile — KYC, next of kin, bank — for platform staff.
 * Opening it is written to the cooperative's audit log server-side.
 */
export function usePlatformMember(cooperativeId: number, membershipId: number | null) {
  return useQuery({
    enabled: membershipId != null,
    queryKey: ['platform-member', cooperativeId, membershipId],
    queryFn: async () => {
      const { data } = await api.get<Member>(`/members/${membershipId}/`, {
        headers: { 'X-Cooperative-Id': String(cooperativeId) },
      })
      return data
    },
  })
}

/** Search people across every cooperative (platform staff only). */
export function usePlatformMemberSearch(query: string) {
  const q = query.trim()
  return useQuery({
    enabled: q.length >= 2,
    queryKey: ['platform-member-search', q],
    queryFn: async () => {
      const { data } = await api.get<PlatformMemberHit[]>('/platform/member-search/', { params: { q } })
      return data
    },
  })
}

export function usePlatformMemberDocuments(cooperativeId: number, membershipId: number | null) {
  return useQuery({
    enabled: membershipId != null,
    queryKey: ['platform-member-documents', cooperativeId, membershipId],
    queryFn: () =>
      getAll<MemberDocument>('/member-documents/', {
        params: { membership: membershipId },
        headers: { 'X-Cooperative-Id': String(cooperativeId) },
      }),
  })
}

export function useMember(id: string | number | undefined) {
  const coop = useCoopKey()
  return useQuery({
    enabled: id != null,
    queryKey: ['member', coop, id],
    queryFn: async () => {
      const { data } = await api.get<Member>(`/members/${id}/`)
      return data
    },
  })
}

export function useMemberStatement(id: string | number | undefined) {
  const coop = useCoopKey()
  return useQuery({
    enabled: id != null,
    queryKey: ['statement', coop, id],
    queryFn: async () => {
      const { data } = await api.get<MemberStatement>(`/members/${id}/statement/`)
      return data
    },
  })
}

export function useContributionTypes() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['contribution-types', coop],
    queryFn: async () => {
      return getAll<ContributionType>('/contribution-types/')
    },
  })
}

export function useContributions() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['contributions', coop],
    queryFn: async () => {
      return getAll<Contribution>('/contributions/')
    },
  })
}

export function useAccounts() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['accounts', coop],
    queryFn: async () => {
      return getAll<Account>('/accounts/')
    },
  })
}

export function useLedgerEntries() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['ledger-entries', coop],
    queryFn: async () => {
      const { data } = await api.get<Paginated<LedgerEntry> | LedgerEntry[]>(
        '/ledger-entries/',
      )
      return unwrap(data)
    },
  })
}

/**
 * The cooperative's own money moved between its own accounts.
 *
 * Readable by any member — they are entitled to see what their society did with
 * its money — but only a privileged officer can record one.
 */
export function useInternalTransfers() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['internal-transfers', coop],
    queryFn: async () => {
      return getAll<InternalTransfer>('/internal-transfers/')
    },
  })
}

export function usePaymentEvents() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['payment-events', coop],
    queryFn: async () => {
      const { data } = await api.get<Paginated<PaymentEvent> | PaymentEvent[]>(
        '/payment-events/',
      )
      return unwrap(data)
    },
  })
}

export function useReconSummary() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['recon-summary', coop],
    queryFn: async () => {
      const { data } = await api.get<ReconSummary>('/payment-events/summary/')
      return data
    },
  })
}

export function useResolutions() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['resolutions', coop],
    queryFn: async () => {
      return getAll<Resolution>('/resolutions/')
    },
  })
}

export function useMeetings() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['meetings', coop],
    queryFn: async () => {
      return getAll<Meeting>('/meetings/')
    },
  })
}

export function useAnnouncements() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['announcements', coop],
    queryFn: async () => {
      return getAll<Announcement>('/announcements/')
    },
  })
}

export function useNotifications() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['notifications', coop],
    queryFn: async () => {
      const { data } = await api.get<Paginated<NotificationItem> | NotificationItem[]>(
        '/notifications/',
      )
      return unwrap(data)
    },
  })
}

export function useAuditLogs() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['audit-logs', coop],
    queryFn: async () => {
      const { data } = await api.get<Paginated<AuditLog> | AuditLog[]>('/audit-logs/')
      return unwrap(data)
    },
  })
}

export function useArrears() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['arrears', coop],
    queryFn: async () => {
      const { data } = await api.get<ArrearsReport>('/reports/arrears/')
      return data
    },
  })
}

export function useContributionSummary() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['contribution-summary', coop],
    queryFn: async () => {
      const { data } = await api.get<ContributionSummary>('/reports/contribution-summary/')
      return data
    },
  })
}

export function useProviderAccounts() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['provider-accounts', coop],
    queryFn: async () => {
      return getAll<Record<string, unknown>>('/provider-accounts/')
    },
  })
}

export function useRoles() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['roles', coop],
    queryFn: async () => {
      return getAll<Role>('/roles/')
    },
  })
}

// Platform surface
export function useCooperatives() {
  return useQuery({
    queryKey: ['cooperatives'],
    queryFn: async () => {
      return getAll<Cooperative>('/cooperatives/')
    },
  })
}

export const COOPERATIVES_PAGE_SIZE = 25
export type CooperativeOrdering = '-created_at' | 'name'

/** One page of the platform's Cooperatives list, searched and sorted on the
 *  server so the page stays quick however many societies sign up. */
export function useCooperativesPage(search: string, page: number, ordering: CooperativeOrdering) {
  return useQuery({
    queryKey: ['cooperatives', 'page', search, page, ordering],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Cooperative>>('/cooperatives/', {
        params: { search: search || undefined, page, ordering, page_size: COOPERATIVES_PAGE_SIZE },
      })
      return data
    },
    placeholderData: keepPreviousData,
  })
}

export function usePlatformOverview() {
  return useQuery({
    queryKey: ['platform-overview'],
    queryFn: async () => {
      const { data } = await api.get<import('./types').PlatformOverview>(
        '/platform/overview/',
      )
      return data
    },
  })
}

export function useCooperative(id: string | number | undefined) {
  return useQuery({
    enabled: id != null,
    queryKey: ['cooperative', id],
    queryFn: async () => {
      const { data } = await api.get<Cooperative>(`/cooperatives/${id}/`)
      return data
    },
  })
}

// ── Platform-admin: billing / onboarding / white-label / health / team ──────
export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      return getAll<Plan>('/plans/')
    },
  })
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      return getAll<Subscription>('/subscriptions/')
    },
  })
}

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      return getAll<Invoice>('/invoices/')
    },
  })
}

export function useNextInvoiceNumber(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['invoice-next-number'],
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data } = await api.get<{ number: string }>('/invoices/next-number/')
      return data.number
    },
  })
}

export function useBillingSummary() {
  return useQuery({
    queryKey: ['billing-summary'],
    queryFn: async () => {
      const { data } = await api.get<BillingSummary>('/platform/billing/')
      return data
    },
  })
}

export function useOnboardingItems() {
  return useQuery({
    queryKey: ['onboarding-items'],
    queryFn: async () => {
      return getAll<OnboardingItem>('/onboarding-items/')
    },
  })
}

export function useDomains() {
  return useQuery({
    queryKey: ['domains'],
    queryFn: async () => {
      return getAll<Domain>('/domains/')
    },
  })
}

export function usePlatformAnalytics(months = 6) {
  return useQuery({
    queryKey: ['platform-analytics', months],
    queryFn: async () => {
      const { data } = await api.get<PlatformAnalytics>('/platform/analytics/', {
        params: { months },
      })
      return data
    },
  })
}

export function usePlatformAttention() {
  return useQuery({
    queryKey: ['platform-attention'],
    queryFn: async () => {
      const { data } = await api.get<{ items: AttentionItem[] }>(
        '/platform/attention/',
      )
      return data.items
    },
  })
}

export function usePlatformHealth() {
  return useQuery({
    queryKey: ['platform-health'],
    queryFn: async () => {
      const { data } = await api.get<PlatformHealth>('/platform/health/')
      return data
    },
  })
}

export function useFleetHealth() {
  return useQuery({
    queryKey: ['fleet-health'],
    queryFn: async () => {
      const { data } = await api.get<FleetHealth>('/platform/fleet-health/')
      return data
    },
  })
}

export function usePaymentMonitor() {
  return useQuery({
    queryKey: ['payment-monitor'],
    queryFn: async () => {
      const { data } = await api.get<PaymentMonitor>('/platform/payment-monitor/')
      return data
    },
  })
}

export function useAuditStream() {
  return useQuery({
    queryKey: ['audit-stream'],
    queryFn: async () => {
      const { data } = await api.get<{ events: AuditEvent[] }>('/platform/audit-stream/')
      return data.events
    },
  })
}

export function useIncidents() {
  return useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      return getAll<Incident>('/incidents/')
    },
  })
}

export function usePlatformTeam() {
  return useQuery({
    queryKey: ['platform-team'],
    queryFn: async () => {
      return getAll<PlatformTeamMember>('/platform-team/')
    },
  })
}

export function usePlatformProfile() {
  return useQuery({
    queryKey: ['platform-profile'],
    queryFn: async () => {
      const { data } = await api.get<PlatformProfile>('/platform/profile/')
      return data
    },
  })
}

export function useNotificationTemplates() {
  return useQuery({
    queryKey: ['notification-templates'],
    queryFn: async () => {
      return getAll<NotificationTemplate>('/notification-templates/')
    },
  })
}

export function useApprovals(status?: string) {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['approvals', coop, status],
    queryFn: async () => {
      return getAll<ApprovalRequest>('/approvals/', { params: status ? { status } : undefined })
    },
  })
}

/** Whether the signed-in officer is the society's only officer and its
 *  Secretary — the one case where they may approve their own requests. */
export function useApprovalPolicy() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['approvals', coop, 'policy'],
    queryFn: async () => {
      const { data } = await api.get<{ sole_secretary: boolean }>('/approvals/policy/')
      return data
    },
  })
}

export function useLoanProducts() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['loan-products', coop],
    queryFn: async () => {
      return getAll<LoanProduct>('/loan-products/')
    },
  })
}

export function useLoans(params?: { membership?: number; status?: string }) {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['loans', coop, params],
    queryFn: async () => {
      return getAll<Loan>('/loans/', { params })
    },
  })
}

export function useDividendSurplus() {
  const coop = useCoopKey()
  return useQuery({
    // Under the 'dividends' key so posting or reversing (which invalidate
    // everything) refreshes it with the list.
    queryKey: ['dividends', 'surplus', coop],
    queryFn: async () => {
      const { data } = await api.get<DividendSurplus>('/dividends/surplus/')
      return data
    },
  })
}

export function useDividends() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['dividends', coop],
    queryFn: async () => {
      return getAll<DividendDeclaration>('/dividends/')
    },
  })
}

export function useSavingsProducts() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['savings-products', coop],
    queryFn: async () => {
      return getAll<SavingsProduct>('/savings-products/')
    },
  })
}

export function useSavingsGoals(membershipId: number | undefined) {
  return useQuery({
    enabled: membershipId != null,
    queryKey: ['savings-goals', membershipId],
    queryFn: async () => {
      return getAll<SavingsGoal>('/savings-goals/', { params: { membership: membershipId } })
    },
  })
}

// ── Member self-service (/me/…) — scoped to the signed-in member ────────────
export function useMyProfile() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['my-profile', coop],
    queryFn: async () => {
      const { data } = await api.get<Member>('/me/profile/')
      return data
    },
  })
}

export function useMyLoans() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['my-loans', coop],
    queryFn: async () => {
      return getAll<Loan>('/me/loans/')
    },
  })
}

export function usePendingRepayments() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['pending-repayments', coop],
    queryFn: async () => {
      return getAll<RepaymentClaim>('/loan-repayments/?status=pending')
    },
  })
}

/**
 * What paying ``amount`` online costs — Paystack's fee is the member's to pay,
 * on top, so the society receives the whole amount. Used for contributions.
 */
export function useFeeQuote(amount: string) {
  const valid = Number(amount) > 0
  return useQuery({
    queryKey: ['fee-quote', amount],
    enabled: valid,
    queryFn: async () => {
      const { data } = await api.get<{ amount: string; fee: string; total: string }>(
        '/fee-quote/', { params: { amount } })
      return data
    },
    staleTime: 5 * 60_000,
  })
}

/**
 * What repaying ``amount`` online costs, Paystack's fee included — the member
 * pays the fee on top so the society receives the whole repayment.
 */
export function useRepayQuote(loanId: number, amount: string) {
  const coop = useCoopKey()
  const valid = Number(amount) > 0
  return useQuery({
    queryKey: ['repay-quote', coop, loanId, amount],
    enabled: valid,
    queryFn: async () => {
      const { data } = await api.get<{ amount: string; fee: string; total: string }>(
        `/me/loans/${loanId}/repay-quote/`, { params: { amount } })
      return data
    },
    staleTime: 5 * 60_000,
  })
}

export function useMyLoan(id: number | undefined) {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['my-loan', coop, id],
    enabled: id != null,
    queryFn: async () => {
      const { data } = await api.get<Loan>(`/me/loans/${id}/`)
      return data
    },
  })
}

export function useMyLoanProducts() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['my-loan-products', coop],
    queryFn: async () => {
      return getAll<LoanProduct>('/me/loan-products/')
    },
  })
}

export function useMySavingsGoals() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['my-savings-goals', coop],
    queryFn: async () => {
      return getAll<SavingsGoal>('/me/savings-goals/')
    },
  })
}

export function useMySavingsProducts() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['my-savings-products', coop],
    queryFn: async () => {
      return getAll<SavingsProduct>('/me/savings-products/')
    },
  })
}

export function useMyDividends() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['my-dividends', coop],
    queryFn: async () => {
      return getAll<MemberDividend>('/me/dividends/')
    },
  })
}

/**
 * The signed-in member's own savings withdrawal requests.
 *
 * Scoped to the caller by the backend, so this never shows another member's.
 * A row with `is_paid` false is still waiting on an officer and has moved no
 * money.
 */
export function useMyWithdrawals() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['my-withdrawals', coop],
    queryFn: async () => {
      return getAll<Withdrawal>('/me/withdrawals/')
    },
  })
}

export function useMyDocuments() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['my-documents', coop],
    queryFn: async () => {
      return getAll<MemberDocument>('/me/documents/')
    },
  })
}

export function useMemberDocuments(membershipId: string | number | undefined) {
  return useQuery({
    enabled: membershipId != null,
    queryKey: ['member-documents', membershipId],
    queryFn: async () => {
      return getAll<MemberDocument>('/member-documents/', { params: { membership: membershipId } })
    },
  })
}

export function useTrialBalance() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['trial-balance', coop],
    queryFn: async () => {
      const { data } = await api.get<import('./types').TrialBalance>('/reports/trial-balance/')
      return data
    },
  })
}

export function useIncomeStatement() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['income-statement', coop],
    queryFn: async () => {
      const { data } = await api.get<import('./types').IncomeStatement>('/reports/income-statement/')
      return data
    },
  })
}

export function useBalanceSheet() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['balance-sheet', coop],
    queryFn: async () => {
      const { data } = await api.get<import('./types').BalanceSheet>('/reports/balance-sheet/')
      return data
    },
  })
}

export function useAttendances(meetingId: number | undefined) {
  return useQuery({
    enabled: meetingId != null,
    queryKey: ['attendances', meetingId],
    queryFn: async () => {
      return getAll<Attendance>('/attendances/', { params: { meeting: meetingId } })
    },
  })
}

export function useReference() {
  return useQuery({
    queryKey: ['reference'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await api.get<Reference>('/reference/')
      return data
    },
  })
}

export function useSupportTickets(cooperativeId: number | undefined) {
  return useQuery({
    enabled: cooperativeId != null,
    queryKey: ['support-tickets', cooperativeId],
    queryFn: async () => {
      return getAll<SupportTicket>('/support-tickets/', { params: { cooperative: cooperativeId } })
    },
  })
}

/**
 * Platform-wide first-party activity for /analytics.
 *
 * Distinct from usePlatformAnalytics, which answers business questions (MRR,
 * retention, adoption). This one answers "what happened on the site".
 */
export function usePlatformSiteActivity(days = 30) {
  return useQuery({
    queryKey: ['platform-site-activity', days],
    queryFn: async () => {
      const { data } = await api.get<SiteActivity>('/platform/site-activity/', {
        params: { days },
      })
      return data
    },
  })
}

/** The same picture for one cooperative — tenant-scoped by the server. */
export function useCooperativeActivity(days = 30) {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['coop-activity', coop, days],
    queryFn: async () => {
      const { data } = await api.get<CooperativeActivity>('/reports/activity/', {
        params: { days },
      })
      return data
    },
  })
}

/**
 * Savings payouts for the active cooperative.
 *
 * Reads stay open to any member (they can see their own history); requesting
 * one is privileged-only, enforced server-side by CanPayOutSavings.
 */
export function useWithdrawals(params?: { membership?: number; unpaid?: boolean }) {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['withdrawals', coop, params],
    queryFn: async () => {
      return getAll<Withdrawal>('/withdrawals/', { params })
    },
  })
}

/**
 * The society's disbursement wallet: balance plus its recent top-ups.
 *
 * Deliberately does **not** call `unwrap()` — unlike every list endpoint here,
 * `/wallet/` returns a single object, because the balance is the point and the
 * top-ups are context for it.
 *
 * The balance is derived server-side from ledger account 1020 rather than
 * stored, so there is no field that can drift from the journals behind it.
 */
export function useWallet() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['wallet', coop],
    queryFn: async () => {
      const { data } = await api.get<WalletSummary>('/wallet/')
      return data
    },
  })
}

/**
 * Money sent out — loan disbursements, and the society withdrawing its own
 * wallet float.
 *
 * `unsettled` narrows to what is still in flight. That list matters more than
 * the rest: a payout is recorded as sent when the provider *accepts* the
 * transfer, which is not the same as it settling, and a provider webhook can be
 * missed. Anything sitting there has not been confirmed either way.
 */
/**
 * Loans whose state does not add up, plus the approved-but-unpaid queue.
 *
 * The two come back together but are counted apart: `awaiting_payment` findings
 * are work to do, `defects` are things that should not be possible.
 */
export function useLoanHealth() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['loan-health', coop],
    queryFn: async () => {
      const { data } = await api.get<LoanHealth>('/loans/health/')
      return data
    },
  })
}

/**
 * Whether a given loan was actually disbursed.
 *
 * Enabled only when a loan is selected, so opening the panel is what asks.
 */
export function useDisbursementEvidence(loanId: number | null) {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['loan-disbursement', coop, loanId],
    enabled: loanId !== null,
    queryFn: async () => {
      const { data } = await api.get<DisbursementEvidence>(
        `/loans/${loanId}/disbursement/`)
      return data
    },
  })
}

export function usePayouts(params?: { unsettled?: boolean; status?: string }) {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['payouts', coop, params],
    queryFn: async () => {
      return getAll<Payout>('/payouts/', { params })
    },
  })
}
