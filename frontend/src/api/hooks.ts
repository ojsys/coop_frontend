import { useQuery } from '@tanstack/react-query'
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
      const { data } = await api.get<Paginated<Member> | Member[]>('/members/', { params })
      return unwrap(data)
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
      const { data } = await api.get<Paginated<Member> | Member[]>('/members/', {
        headers: { 'X-Cooperative-Id': String(cooperativeId) },
      })
      return unwrap(data)
    },
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
      const { data } = await api.get<Paginated<ContributionType> | ContributionType[]>(
        '/contribution-types/',
      )
      return unwrap(data)
    },
  })
}

export function useContributions() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['contributions', coop],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Contribution> | Contribution[]>(
        '/contributions/',
      )
      return unwrap(data)
    },
  })
}

export function useAccounts() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['accounts', coop],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Account> | Account[]>('/accounts/')
      return unwrap(data)
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
      const { data } = await api.get<Paginated<InternalTransfer> | InternalTransfer[]>(
        '/internal-transfers/',
      )
      return unwrap(data)
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
      const { data } = await api.get<Paginated<Resolution> | Resolution[]>('/resolutions/')
      return unwrap(data)
    },
  })
}

export function useMeetings() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['meetings', coop],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Meeting> | Meeting[]>('/meetings/')
      return unwrap(data)
    },
  })
}

export function useAnnouncements() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['announcements', coop],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Announcement> | Announcement[]>(
        '/announcements/',
      )
      return unwrap(data)
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
      const { data } = await api.get<Paginated<Record<string, unknown>> | Record<string, unknown>[]>(
        '/provider-accounts/',
      )
      return unwrap(data)
    },
  })
}

export function useRoles() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['roles', coop],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Role> | Role[]>('/roles/')
      return unwrap(data)
    },
  })
}

// Platform surface
export function useCooperatives() {
  return useQuery({
    queryKey: ['cooperatives'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Cooperative> | Cooperative[]>('/cooperatives/')
      return unwrap(data)
    },
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
      const { data } = await api.get<Paginated<Plan> | Plan[]>('/plans/')
      return unwrap(data)
    },
  })
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Subscription> | Subscription[]>(
        '/subscriptions/',
      )
      return unwrap(data)
    },
  })
}

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Invoice> | Invoice[]>('/invoices/')
      return unwrap(data)
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
      const { data } = await api.get<
        Paginated<OnboardingItem> | OnboardingItem[]
      >('/onboarding-items/')
      return unwrap(data)
    },
  })
}

export function useDomains() {
  return useQuery({
    queryKey: ['domains'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Domain> | Domain[]>('/domains/')
      return unwrap(data)
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
      const { data } = await api.get<Paginated<Incident> | Incident[]>('/incidents/')
      return unwrap(data)
    },
  })
}

export function usePlatformTeam() {
  return useQuery({
    queryKey: ['platform-team'],
    queryFn: async () => {
      const { data } = await api.get<
        Paginated<PlatformTeamMember> | PlatformTeamMember[]
      >('/platform-team/')
      return unwrap(data)
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
      const { data } = await api.get<
        Paginated<NotificationTemplate> | NotificationTemplate[]
      >('/notification-templates/')
      return unwrap(data)
    },
  })
}

export function useApprovals(status?: string) {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['approvals', coop, status],
    queryFn: async () => {
      const { data } = await api.get<Paginated<ApprovalRequest> | ApprovalRequest[]>('/approvals/', { params: status ? { status } : undefined })
      return unwrap(data)
    },
  })
}

export function useLoanProducts() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['loan-products', coop],
    queryFn: async () => {
      const { data } = await api.get<Paginated<LoanProduct> | LoanProduct[]>('/loan-products/')
      return unwrap(data)
    },
  })
}

export function useLoans(params?: { membership?: number; status?: string }) {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['loans', coop, params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Loan> | Loan[]>('/loans/', { params })
      return unwrap(data)
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
      const { data } = await api.get<Paginated<DividendDeclaration> | DividendDeclaration[]>('/dividends/')
      return unwrap(data)
    },
  })
}

export function useSavingsProducts() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['savings-products', coop],
    queryFn: async () => {
      const { data } = await api.get<Paginated<SavingsProduct> | SavingsProduct[]>('/savings-products/')
      return unwrap(data)
    },
  })
}

export function useSavingsGoals(membershipId: number | undefined) {
  return useQuery({
    enabled: membershipId != null,
    queryKey: ['savings-goals', membershipId],
    queryFn: async () => {
      const { data } = await api.get<Paginated<SavingsGoal> | SavingsGoal[]>(
        '/savings-goals/', { params: { membership: membershipId } })
      return unwrap(data)
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
      const { data } = await api.get<Paginated<Loan> | Loan[]>('/me/loans/')
      return unwrap(data)
    },
  })
}

export function usePendingRepayments() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['pending-repayments', coop],
    queryFn: async () => {
      const { data } = await api.get<Paginated<RepaymentClaim> | RepaymentClaim[]>(
        '/loan-repayments/?status=pending')
      return unwrap(data)
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
      const { data } = await api.get<Paginated<LoanProduct> | LoanProduct[]>('/me/loan-products/')
      return unwrap(data)
    },
  })
}

export function useMySavingsGoals() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['my-savings-goals', coop],
    queryFn: async () => {
      const { data } = await api.get<Paginated<SavingsGoal> | SavingsGoal[]>('/me/savings-goals/')
      return unwrap(data)
    },
  })
}

export function useMySavingsProducts() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['my-savings-products', coop],
    queryFn: async () => {
      const { data } = await api.get<Paginated<SavingsProduct> | SavingsProduct[]>('/me/savings-products/')
      return unwrap(data)
    },
  })
}

export function useMyDividends() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['my-dividends', coop],
    queryFn: async () => {
      const { data } = await api.get<Paginated<MemberDividend> | MemberDividend[]>('/me/dividends/')
      return unwrap(data)
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
      const { data } = await api.get<Paginated<Withdrawal> | Withdrawal[]>(
        '/me/withdrawals/',
      )
      return unwrap(data)
    },
  })
}

export function useMyDocuments() {
  const coop = useCoopKey()
  return useQuery({
    queryKey: ['my-documents', coop],
    queryFn: async () => {
      const { data } = await api.get<Paginated<MemberDocument> | MemberDocument[]>('/me/documents/')
      return unwrap(data)
    },
  })
}

export function useMemberDocuments(membershipId: string | number | undefined) {
  return useQuery({
    enabled: membershipId != null,
    queryKey: ['member-documents', membershipId],
    queryFn: async () => {
      const { data } = await api.get<
        Paginated<MemberDocument> | MemberDocument[]
      >('/member-documents/', { params: { membership: membershipId } })
      return unwrap(data)
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
      const { data } = await api.get<Paginated<Attendance> | Attendance[]>(
        '/attendances/', { params: { meeting: meetingId } })
      return unwrap(data)
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
      const { data } = await api.get<
        Paginated<SupportTicket> | SupportTicket[]
      >('/support-tickets/', { params: { cooperative: cooperativeId } })
      return unwrap(data)
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
      const { data } = await api.get<Paginated<Withdrawal> | Withdrawal[]>(
        '/withdrawals/',
        { params },
      )
      return unwrap(data)
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
      const { data } = await api.get<Paginated<Payout> | Payout[]>(
        '/payouts/',
        { params },
      )
      return unwrap(data)
    },
  })
}
