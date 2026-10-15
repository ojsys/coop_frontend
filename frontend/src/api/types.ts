// DTOs mirroring the DRF serializers (accounts, tenants, ledger, contributions,
// payments, governance, communications, reports). Kept deliberately close to the
// server field names so hooks map 1:1 to endpoints.

export interface MembershipSummary {
  id: number
  cooperative_id: number
  cooperative_name: string
  cooperative_slug: string
  /** The society's own branding — null until an officer uploads one. */
  cooperative_logo: string | null
  cooperative_favicon: string | null
  cooperative_brand_color: string
  member_no: string
  /** Non-members cannot vote or receive dividends. Absent on older servers. */
  kind?: MemberKind
  role_slug: string | null
  /** Holds an office of any kind — the rule for reaching the console at all. */
  is_officer: boolean
  role_name: string | null
  is_privileged: boolean
  status: MemberStatus
  share_capital: string
  /** The society's plan. Absent from servers older than plan features. */
  plan?: MembershipPlan
}

/** Keys of the features plans differ by (see core/entitlements.py). */
export type PlanFeature =
  | 'electronic_payouts'
  | 'dividends'
  | 'savings_plans'
  | 'custom_branding'
  | 'custom_domain'

export interface MembershipPlan {
  /** Null when the society is not on a subscription yet. */
  name: string | null
  /** What the society may use right now (everything during grace). */
  features: PlanFeature[]
  /** While set, every feature is included regardless of plan. */
  grace_until: string | null
  band_label?: string | null
  min_members?: number | null
  /** 0 = no upper limit. */
  max_members?: number | null
  /** Active people on the register — members and non-members — as billed. */
  members_counted?: number
  billing_cycle?: 'monthly' | 'annual' | null
  cycle_amount?: string | null
  status?: string | null
  renews_on?: string | null
}

/** A full member, or someone the society serves who has not joined. */
export type MemberKind = 'member' | 'non_member'

export interface CurrentUser {
  id: number
  full_name: string
  email: string
  phone: string
  national_id: string
  is_platform_admin: boolean
  two_factor_enabled: boolean
  memberships: MembershipSummary[]
}

export type MemberStatus = 'prospective' | 'active' | 'suspended' | 'exited'

export interface Member {
  id: number
  member_no: string
  full_name: string
  email: string
  phone: string
  role: number | null
  role_name: string | null
  kind: MemberKind
  kind_display: string
  status: MemberStatus
  share_capital: string
  joined_at: string | null
  exited_at: string | null
  savings_balance: string
  // KYC / headshot
  photo: string | null
  date_of_birth: string | null
  gender: string
  address: string
  occupation: string
  next_of_kin_name: string
  next_of_kin_phone: string
  bank_name: string
  /** Paystack's code for `bank_name`. Blank until the member or an officer
   *  picks the bank from the catalogue; a payout cannot be created without it. */
  bank_code: string
  bank_account_no: string
  document_count: number
}

export interface ApprovalRequest {
  id: number
  /** Mirrors approvals.ApprovalRequest.Action. The last two are cooperative-
   *  level rather than per-object: a bank-detail change and a savings payout,
   *  both raised from their own screens rather than the Approvals submit form. */
  action:
    | 'loan.approve'
    | 'loan.disburse'
    | 'dividend.post'
    | 'coop.bank_update'
    | 'savings.withdraw'
  action_display: string
  object_id: number
  summary: string
  status: 'pending' | 'approved' | 'rejected'
  status_display: string
  requested_by: number | null
  requested_by_name: string | null
  decided_by_name: string | null
  decided_at: string | null
  note: string
  created_at: string
}

export interface LoanProduct {
  id: number
  name: string
  interest_rate: string
  max_amount: string
  max_term_months: number
  /** Application fee: this % of the amount plus the flat sum below. */
  application_fee_percent: string
  application_fee_flat: string
  /** Whether non-members may apply, and their rate (null = members' rate). */
  open_to_non_members: boolean
  non_member_interest_rate: string | null
  active: boolean
  created_at: string
}

export interface LoanRepayment {
  id: number
  loan: number
  amount: string
  channel?: string
  status?: string
  note?: string
  created_at: string
}

export interface RepaymentClaim {
  id: number
  loan: number
  amount: string
  channel: string
  channel_display: string
  status: string
  note: string
  psp_reference: string
  member_name: string
  member_no: string
  member_bank_name: string
  member_bank_account_no: string
  product_name: string
  outstanding: string
  created_at: string
}

export interface RepaymentInstalment {
  id: number
  sequence: number
  due_date: string
  amount_due: string
  principal_component: string
  interest_component: string
  amount_paid: string
  outstanding: string
  status: 'pending' | 'paid'
  is_overdue: boolean
}

export interface CoopBank {
  bank_name: string
  account_name: string
  account_no: string
}

export interface Loan {
  id: number
  membership: number
  member_no: string
  member_name: string
  member_phone?: string
  member_email?: string
  member_bank_name?: string
  /** The member's *current* bank code. Compared against
   *  `destination_bank_code` to tell whether refreshing the frozen
   *  destination would actually make the loan payable. */
  member_bank_code?: string
  member_bank_account_no?: string
  member_share_capital?: string
  member_photo?: string | null
  product: number
  product_name: string
  member_kind?: MemberKind
  principal: string
  /** Deducted at disbursement; captured when the loan was applied for. */
  application_fee: string
  /** What the member receives: principal − application_fee. */
  amount_to_disburse: string
  interest_rate: string
  term_months: number
  purpose: string
  status: 'pending' | 'approved' | 'rejected' | 'disbursed' | 'repaid'
  status_display: string
  interest: string
  total_repayable: string
  outstanding: string
  repaid_amount?: string
  monthly_instalment?: string
  disbursed_at: string | null
  repayments: LoanRepayment[]
  instalments?: RepaymentInstalment[]
  coop_bank?: CoopBank | null
  /**
   * Where this loan will be paid, captured when it was applied for.
   *
   * Distinct from `member_bank_*`, which is the member's details *now*. If the
   * two differ the member changed them after applying — and the payout follows
   * the snapshot, not the current value. Blank is legitimate: a cash-collected
   * loan needs no account.
   */
  destination_bank_name?: string
  destination_bank_code?: string
  destination_account_no?: string
  /** The destination as one line, for an officer deciding whether to approve. */
  destination_summary?: string
  /** False when the code or account number is missing — a transfer needs both. */
  destination_is_payable?: boolean
  created_at: string
}

export interface DividendAllocation {
  id: number
  membership: number
  member_no: string
  member_name: string
  share_capital: string
  amount: string
}

export interface DividendDeclaration {
  id: number
  period_label: string
  /** 'pool' = a fixed total shared pro-rata; 'rate' = % of share capital. */
  method: 'pool' | 'rate'
  rate: string | null
  total_amount: string
  note: string
  status: 'draft' | 'posted' | 'reversed'
  status_display: string
  /** A draft waiting for a second officer to approve posting it. */
  awaiting_approval: boolean
  posted_at: string | null
  reversed_at: string | null
  reversal_reason: string
  member_count: number
  allocations: DividendAllocation[]
  created_by_name: string | null
  created_at: string
}

/** `GET /dividends/surplus/` — what may be distributed, and why. */
export interface DividendSurplus {
  income_total: string
  expense_total: string
  /** Negative once dividends have been paid from it. */
  retained_surplus: string
  available: string
  share_capital_base: string
  eligible_members: number
}

export interface MemberDividend {
  id: number
  period_label: string
  status: string
  share_capital: string
  amount: string
  declared_at: string
}

export interface SavingsProduct {
  id: number
  name: string
  description: string
  interest_rate: string
  contribution_type: number | null
  contribution_type_name: string | null
  active: boolean
  goal_count: number
  created_at: string
}

export interface SavingsGoal {
  id: number
  membership: number
  member_no: string
  product: number
  product_name: string
  name: string
  target_amount: string
  target_date: string | null
  saved_amount: string
  progress_pct: number
  created_at: string
}

export interface MemberDocument {
  id: number
  membership: number
  doc_type: string
  doc_type_display: string
  label: string
  file: string
  created_at: string
}

export interface Cooperative {
  id: number
  name: string
  slug: string
  registration_no: string
  coop_type: string
  /** ISO 3166-1 alpha-2. Empty on rows created before location went global. */
  country: string
  /** State / province / county — the label depends on `country`. */
  state: string
  /** LGA / district / city — the label depends on `country`. */
  lga: string
  base_currency: string
  tier: 'small' | 'medium' | 'large'
  status: 'prospective' | 'active' | 'suspended' | 'closed'
  brand_color: string
  member_cap: number
  bank_name?: string
  bank_account_name?: string
  bank_account_no?: string
  /** Absolute-ish media URLs served by Django; null until one is uploaded. */
  logo?: string | null
  favicon?: string | null
  contact_email?: string
  contact_phone?: string
  contact_address?: string
  /** Replaces the default footer line on generated statements when set. */
  statement_footer?: string
  /** The invite link is /join/<join_code>; officers choose the code. */
  join_code?: string | null
  join_link_enabled?: boolean
  created_at: string
}

export interface StatementLine {
  date: string
  description: string
  reference?: string
  credit: string
  debit: string
  balance: string
}

export interface MemberStatement {
  member_no: string
  savings_balance: string
  lines: StatementLine[]
}

export interface Role {
  id: number
  slug: string
  name: string
  permissions: string[]
  is_privileged: boolean
}

export interface ContributionType {
  id: number
  name: string
  slug: string
  frequency: string
  kind: string
  expected_amount: string | null
  gl_account: number | null
  gl_account_name: string | null
  active: boolean
}

export interface Contribution {
  id: number
  membership: number
  member_no?: string
  contribution_type: number
  type_name?: string
  amount: string
  channel: string
  status: string
  psp_reference: string
  occurred_at: string
  journal: number | null
}

export interface Account {
  id: number
  code: string
  name: string
  kind: string
  system: boolean
  balance: string
}

export interface LedgerEntry {
  id: number
  reference: string
  occurred_at: string
  account: number
  account_code: string
  account_name: string
  membership: number | null
  debit: string
  credit: string
  currency: string
  description: string
}

export interface PaymentEvent {
  id: number
  provider: string
  event_id: string
  reference: string
  amount: string
  status: string
  received_at: string
}

export interface ReconciliationSummary {
  ingested: number
  matched: number
  unmatched: number
  partial: number
  duplicate: number
  ignored: number
  accuracy: number
}

export interface ResolutionResults {
  for: number
  against: number
  abstain: number
  for_weight: string
  against_weight: string
  passed: boolean
}

export interface Resolution {
  id: number
  meeting: number | null
  title: string
  description: string
  status: string
  voting_mode: string
  outcome: string
  opens_at: string | null
  closes_at: string | null
  results: ResolutionResults | null
  my_vote: string | null
}

export interface Meeting {
  id: number
  title: string
  location: string
  agenda: string
  minutes: string
  scheduled_at: string
  voting_opens_at: string | null
  proxy_enabled: boolean
  status: string
  attendance_count: number
}

export interface Attendance {
  id: number
  meeting: number
  membership: number
  member_no: string
  member_name: string
  present: boolean
  proxy_for: number | null
  created_at: string
}

export interface Announcement {
  id: number
  title: string
  body: string
  audience: string
  audience_role: string | null
  channels: string[]
  status: string
  reach: number
  sent_at: string | null
  created_at: string
}

export interface NotificationItem {
  id: number
  title: string
  body: string
  read: boolean
  created_at: string
}

export interface AuditLog {
  id: number
  actor_name: string | null
  action: string
  entity_type: string
  entity_id: string
  entity_repr: string
  before: unknown
  after: unknown
  created_at: string
}

export interface TrendPoint {
  period: string
  total: string
}

export interface ReconSummary {
  ingested: number
  matched: number
  exceptions: number
  match_accuracy: number
  by_status: Record<string, number>
}

export interface DashboardData {
  period: string
  contributions_this_period: string
  total_savings: string
  arrears_outstanding: string
  members_in_arrears: number
  active_members: number
  total_members: number
  participation_rate: number
  contributions_trend: TrendPoint[]
  reconciliation: ReconSummary
}

export interface TrialBalance {
  rows: { code: string; name: string; kind: string; debit: string; credit: string }[]
  total_debit: string
  total_credit: string
  balanced: boolean
}

export interface StatementLineItem {
  code: string
  name: string
  amount: string
}

export interface IncomeStatement {
  income: StatementLineItem[]
  income_total: string
  expense: StatementLineItem[]
  expense_total: string
  surplus: string
}

export interface BalanceSheet {
  assets: StatementLineItem[]
  assets_total: string
  liabilities: StatementLineItem[]
  liabilities_total: string
  equity: StatementLineItem[]
  retained_surplus: string
  total_equity_and_liabilities: string
  balanced: boolean
}

export interface ContributionSummary {
  period: string
  total: string
  by_type: { type: string; total: string; count: number }[]
}

export interface ArrearsReport {
  period: string
  expected_per_member: string
  members_in_arrears: number
  total_outstanding: string
  items: {
    membership_id: number
    member_no: string
    expected: string
    collected: string
    outstanding: string
  }[]
}

export interface PlatformOverview {
  period: string
  cooperatives_live: number
  cooperatives_total: number
  members_total: number
  active_members_total: number
  gross_contributions: string
  mrr: string
  reconciliation_accuracy: number
  by_state: { state: string; count: number }[]
  by_tier: { small: number; medium: number; large: number }
  recently_provisioned: { name: string; state: string; created_at: string }[]
  contributions_trend: TrendPoint[]
}

// ── Platform-admin (Startup Ripple) surfaces ───────────────────────────────
export interface Plan {
  id: number
  name: string
  tier: 'small' | 'medium' | 'large'
  tier_display: string
  price_monthly: string
  price_annual: string | null
  price_is_from: boolean
  currency: string
  min_members: number
  max_members: number
  band_label: string
  description: string
  features: PlanFeature[]
  /** Unenforced promises for the price card, one per line. */
  extras: string
  active: boolean
  subscriber_count: number
  created_at: string
}

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled'

export interface Subscription {
  id: number
  cooperative: number
  cooperative_name: string
  plan: number
  plan_name: string
  status: SubscriptionStatus
  status_display: string
  billing_cycle: 'monthly' | 'annual'
  /** Negotiated price per billing cycle; null = the plan's list price. */
  price_override: string | null
  /** What one invoice is for; null when an annual price still needs quoting. */
  cycle_amount: string | null
  monthly_value: string
  features_grace_until: string | null
  started_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  created_at: string
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void'

export interface Invoice {
  id: number
  cooperative: number
  cooperative_name: string
  subscription: number | null
  number: string
  period_label: string
  amount: string
  currency: string
  status: InvoiceStatus
  status_display: string
  issued_at: string | null
  due_at: string | null
  paid_at: string | null
  created_at: string
}

export type OnboardingStage =
  | 'discovery' | 'data_migration' | 'parallel_run' | 'go_live' | 'done'

export interface OnboardingItem {
  id: number
  cooperative: number | null
  prospect_name: string
  display_name: string
  stage: OnboardingStage
  stage_display: string
  owner: number | null
  owner_name: string | null
  target_go_live: string | null
  notes: string
  created_at: string
  updated_at: string
}

export interface DomainVerification {
  record_type: string
  host: string
  target: string
  instructions: string
}

export interface Domain {
  id: number
  cooperative: number
  cooperative_name: string
  domain: string
  is_primary: boolean
  dns_status: 'pending' | 'verified' | 'failed'
  ssl_status: 'awaiting' | 'issued' | 'failed'
  verified_at: string | null
  verification: DomainVerification
  created_at: string
}

export interface ProviderStatus {
  id: number
  name: string
  kind: 'psp' | 'sms' | 'email' | 'other'
  kind_display: string
  status: 'operational' | 'degraded' | 'down'
  status_display: string
  latency_ms: number
  checked_at: string | null
  created_at: string
}

export interface SupportTicket {
  id: number
  cooperative: number
  cooperative_name: string
  subject: string
  body: string
  priority: 'low' | 'normal' | 'high'
  priority_display: string
  status: 'open' | 'in_progress' | 'closed'
  status_display: string
  created_by: number | null
  created_by_name: string | null
  closed_at: string | null
  created_at: string
}

export interface HealthCheckItem {
  key: string
  label: string
  ok: boolean
  detail: string
}

export interface CooperativeHealth {
  cooperative: string
  status: string
  healthy: boolean
  checks: HealthCheckItem[]
  metrics: Record<string, number | boolean>
}

export interface ImpersonateResult {
  token: string
  cooperative_id: number
  user: {
    full_name: string
    email: string
    member_no: string
    role: string
    /** Which surface to open. An ordinary member has no console, so sending
     *  them there lands on a permission wall. */
    is_privileged: boolean
  }
}

export interface PlatformTeamMember {
  id: number
  user: number
  name: string
  email: string
  role: 'owner' | 'onboarding_lead' | 'support' | 'finance'
  role_display: string
  active: boolean
  created_at: string
}

export interface BillingSummary {
  mrr: string
  /**
   * Where the book stands, beside the headline figure. MRR counts ACTIVE
   * subscriptions only, so without this a platform whose tenants are all still
   * in their free month shows zero revenue with no indication why.
   *
   * `value` is typed loosely on purpose: these are Decimals server-side, which
   * DRF renders as JSON numbers, while `mrr` above is declared a string. One of
   * the two is already wrong, and `naira()` accepts either.
   */
  subscriptions: Record<
    'active' | 'trial' | 'past_due' | 'canceled',
    { count: number; value: string | number }
  >
  outstanding: string
  overdue_amount: string
  overdue_count: number
  by_status: Record<string, { count: number; amount: string }>
  plan_tiers: {
    plan_id: number
    name: string
    tier: string
    price_monthly: string
    coops: number
  }[]
}

export interface FeatureAdoption {
  feature: string
  pct: number
}

export interface ChurnRisk {
  cooperative_id: number
  name: string
  reason: string
  score: number
}

export interface CohortRow {
  cohort: string
  size: number
  values: (number | null)[]
}

export interface PlatformAnalytics {
  months: number
  feature_adoption: FeatureAdoption[]
  churn_watchlist: ChurnRisk[]
  coops_by_state: { state: string; count: number }[]
  net_revenue_retention: number
  mrr_trend: { period: string; month: string; mrr: string }[]
  revenue_by_tier: { tier: string; coops: number; revenue: string }[]
  arpu: string
  paid_vs_trial: { paid: number; trial: number }
  growth_trend: { period: string; month: string; new_coops: number; new_members: number }[]
  activation_funnel: { stage: string; count: number }[]
  active_vs_dormant: { active: number; dormant: number }
  cohort_retention: { rows: CohortRow[]; span: number }
}

export interface AttentionItem {
  icon: string
  tone: 'danger' | 'gold' | 'neutral'
  title: string
  detail: string
  cta: string
  link: string
}

export interface SystemMetric {
  label: string
  value: string
  foot: string
}

export interface ProviderHistoryPoint {
  latency_ms: number
  status: string
  checked_at: string
}

export interface ProviderWithHistory {
  id: number
  name: string
  kind: string
  status: string
  latency_ms: number
  history: ProviderHistoryPoint[]
}

export interface PlatformHealth {
  providers: ProviderStatus[]
  system: SystemMetric[]
  provider_history: ProviderWithHistory[]
}

export interface FleetHealth {
  total: number
  healthy: number
  at_risk_count: number
  at_risk: {
    cooperative_id: number
    name: string
    status: string
    failing: string[]
    recon_exceptions: number
    ledger_balanced: boolean
  }[]
}

export interface PaymentMonitor {
  window_days: number
  total_events: number
  success_rate: number
  exceptions: number
  trend: { day: string; total: number; success: number }[]
  recent: {
    id: number
    provider: string
    reference: string
    amount: string
    status: string
    cooperative: string | null
    received_at: string
  }[]
}

export interface AuditEvent {
  id: number
  action: string
  actor: string
  cooperative: string | null
  entity: string
  created_at: string
}

export interface Incident {
  id: number
  title: string
  severity: 'info' | 'minor' | 'major' | 'critical'
  severity_display: string
  status: 'open' | 'monitoring' | 'resolved'
  status_display: string
  note: string
  started_at: string
  resolved_at: string | null
  created_at: string
}

export interface PlatformProfile {
  name: string
  brand_color: string
  logo?: string | null
  favicon?: string | null
  support_email: string
  support_phone?: string
  default_currency: string
  default_timezone: string
  /** GA4 measurement ID, e.g. "G-XXXXXXXXXX". Blank switches tracking off. */
  ga_measurement_id?: string
}

export interface NotificationTemplate {
  id: number
  key: string
  name: string
  channel: 'email' | 'sms' | 'in_app'
  channel_display: string
  subject: string
  body: string
  active: boolean
  created_at: string
}

export interface StateRef {
  state: string
  capital: string
  lgas: string[]
}

export interface Reference {
  states: StateRef[]
  coop_types: string[]
  white_label: { cname_target: string }
  /**
   * The payment provider's bank catalogue, cached server-side.
   *
   * **Empty means "no verified catalogue"** — either `manage.py refresh_banks`
   * has not run or no live PSP key is configured. Callers must fall back to a
   * free-text input in that case rather than blocking the form, the same way
   * LocationSelect handles countries without a subdivision list. A bank entry
   * screen must never break because Paystack is briefly unreachable.
   */
  banks: BankRef[]
}

/**
 * A bank the provider can settle to or transfer to.
 *
 * `code` is the part that matters: Paystack creates a settlement subaccount and
 * a transfer recipient from the code, never the name. A name without its code
 * cannot be paid.
 */
export interface BankRef {
  code: string
  name: string
}

/** A country and the vocabulary it uses for the two levels below it. */
export interface CountryRef {
  code: string
  name: string
  /** What this country calls the middle level ("State", "County", …). */
  region_label: string
  /** What it calls the lowest level ("LGA", "District", …). */
  locality_label: string
  /** False means we ship no verified list — the form falls back to text. */
  has_subdivisions: boolean
}

export interface SubdivisionRegion {
  region: string
  capital: string
  localities: string[]
}

/** The unauthenticated catalogue behind the public signup form. */
export interface PublicReference {
  countries: CountryRef[]
  coop_types: string[]
}

/**
 * The editable content of the public site.
 *
 * Every string here is owned by an admin in the Django CMS, not by this
 * bundle — changing the landing page must never require a deploy.
 */
export interface SiteContent {
  hero: {
    eyebrow: string
    title: string
    subtitle: string
    primary_cta: string
    secondary_cta: string
    /** null until someone uploads one; the page shows a panel instead. */
    image: string | null
    image_alt: string
  }
  principle: { eyebrow: string; title: string; body: string }
  features_title: string
  features_intro: string
  features: { icon: string; title: string; body: string }[]
  showcase_title: string
  showcase_intro: string
  /** Alternating image-and-text blocks that explain a feature properly. */
  showcase: {
    title: string
    body: string
    bullets: string[]
    image: string | null
    image_alt: string
  }[]
  steps_title: string
  steps_intro: string
  steps: { number: string; icon: string; title: string; body: string }[]
  apps: {
    title: string
    body: string
    note: string
    /** Store link, or the uploaded APK. null hides the Android button. */
    android_url: string | null
    /** null hides the iOS button — useful while it is unreleased. */
    ios_url: string | null
    screenshot: string | null
    screenshot_alt: string
  }
  cta: {
    title: string
    body: string
    button: string
    image: string | null
    image_alt: string
  }
  gallery_title: string
  gallery_intro: string
  gallery: { image: string | null; alt_text: string; caption: string }[]
  /** True when gallery rows exist at all, even if all are hidden. Lets the
   *  page tell "nothing uploaded yet" from "deliberately emptied". */
  gallery_has_custom: boolean
  trust_badges: { icon: string; text: string }[]
  pricing: { title: string; intro: string; fallback: string }
  footer: { tagline: string; disclaimer: string }
  meta: { title: string; description: string }
}

// DRF PageNumberPagination envelope
export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ── Activity analytics ──────────────────────────────────────────────────────
// Volumes are counted from the domain tables; the audit log supplies the feed
// and the per-entity breakdown (its `action` strings are half free-text, so
// grouping by them would give one bucket per row).

/**
 * A type alias, not an interface, and that is load-bearing: the chart
 * components take `Record<string, unknown>[]`, and TypeScript grants an
 * implicit index signature to anonymous object types and aliases but never to a
 * named interface. Declared as an interface this cannot be plotted — which is
 * why the existing series (mrr_trend, growth_trend) are inline object types.
 */
export type ActivityDay = {
  day: string
  events: number
  contributions: number
  /** Platform series only. */
  members?: number
  /** Cooperative series only — confirmed value that day. A number because it
   *  is plotted; the display totals are strings. */
  value?: number
}

export interface ActivityEvent {
  id: number
  action: string
  actor: string
  cooperative?: string | null
  entity: string
  entity_type: string
  created_at: string
}

export interface EntityCount {
  entity: string
  count: number
}

export interface SiteActivity {
  window_days: number
  totals: {
    audit_events: number
    new_cooperatives: number
    new_members: number
    onboarding_started: number
    contributions: number
    contributions_value: string
    join_requests: number
    join_requests_pending: number
    join_requests_approved: number
    announcements: number
  }
  daily: ActivityDay[]
  by_entity: EntityCount[]
  busiest_cooperatives: { cooperative: string; count: number }[]
  feed: ActivityEvent[]
  /** Reused from the B2B analytics service so the numbers cannot disagree. */
  growth_trend: {
    period: string
    month: string
    new_coops: number
    new_members: number
  }[]
  activation_funnel: { stage: string; count: number }[]
  payments: {
    window_days: number
    total_events: number
    success_rate: number
    exceptions: number
    trend: { day: string; total: number; success: number }[]
  }
}

export interface CooperativeActivity {
  window_days: number
  totals: {
    audit_events: number
    new_members: number
    contributions: number
    contributions_value: string
    join_requests: number
    join_requests_pending: number
    announcements: number
  }
  daily: ActivityDay[]
  by_entity: EntityCount[]
  top_contributors: {
    member_no: string
    name: string
    count: number
    total: string
  }[]
  feed: ActivityEvent[]
}

/**
 * A member being paid some of their savings back out.
 *
 * Created by an officer and posted to the ledger only once a *different*
 * privileged officer approves it under /approvals/, so a row with `is_paid`
 * false has moved no money. The destination fields are a snapshot taken when it
 * was requested — a member editing their bank details later must not rewrite
 * where a payment already went.
 */
export interface Withdrawal {
  id: number
  membership: number
  member_no: string
  member_name: string
  amount: string
  channel: 'cash' | 'transfer'
  channel_display: string
  reason: string
  destination_bank_name: string
  destination_account_no: string
  requested_by: number | null
  requested_by_name: string | null
  paid_at: string | null
  is_paid: boolean
  journal: number | null
  /** Who, how much and to where — the same text the approver sees. */
  summary: string
  created_at: string
}

/**
 * The cooperative moving its own money between two of its own accounts —
 * banking a cash float, or drawing cash from the bank.
 *
 * Unlike a `Withdrawal` this needs one privileged officer rather than two, and
 * posts immediately: both legs are the cooperative's own asset accounts, so
 * nothing leaves the cooperative and no member's balance moves. The backend
 * enforces that both accounts are assets, which is what stops this being a way
 * to pay a member out without approval.
 *
 * `occurred_at` is when the money really moved at the bank, which is not
 * necessarily when it was recorded here.
 */
export interface InternalTransfer {
  id: number
  from_account: number
  from_account_code: string
  from_account_name: string
  to_account: number
  to_account_code: string
  to_account_name: string
  amount: string
  occurred_at: string
  note: string
  recorded_by: number | null
  recorded_by_name: string | null
  journal: number | null
  /** Both accounts and the amount, as one line of text. */
  summary: string
  created_at: string
}

/**
 * One payment that funded a society's disbursement wallet.
 *
 * Three amounts, because they genuinely differ: the officer paid `amount`, the
 * provider kept `fee`, and `net_amount` is what the wallet was actually
 * credited. Showing only the first would make the balance look wrong to
 * whoever reconciles it.
 */
export interface WalletTopUp {
  id: number
  amount: string
  fee: string
  net_amount: string
  currency: string
  status: 'pending' | 'confirmed' | 'failed'
  status_display: string
  is_confirmed: boolean
  provider: string
  psp_reference: string
  initiated_by: number | null
  initiated_by_name: string | null
  journal: number | null
  confirmed_at: string | null
  created_at: string
}

/**
 * `GET /wallet/` — the balance plus the recent top-ups behind it.
 *
 * Note this is a single object, not a paginated list: the balance is derived
 * server-side from ledger account 1020, so it cannot drift from the journals
 * that produced it.
 */
/**
 * One thing the loan health check noticed.
 *
 * `code === 'awaiting_payment'` is **not** a defect: before approval began
 * disbursing, approving a loan and paying it were separate steps, so those rows
 * are a work queue. They arrive at `info` severity and are excluded from the
 * `defects` count. Treating them as damage would "repair" valid records.
 */
export interface LoanFinding {
  code: string
  severity: 'critical' | 'warning' | 'info'
  loan_id: number
  cooperative_id: number
  member: string
  amount: string
  title: string
  detail: string
  /** What correcting it means, in words. */
  fix: string
  /** False when the correction would touch the ledger — those need a person. */
  auto_fixable: boolean
}

export interface LoanHealth {
  checked: number
  findings: LoanFinding[]
  counts: Record<string, number>
  awaiting_payment: number
  defects: number
  critical: number
  auto_fixable: number
}

/**
 * Whether a loan's principal actually left — the evidence, not the status field.
 *
 * `verdict` drives the wording and tone. The distinction that matters most is
 * between `in_flight` (nobody has confirmed it yet, which is normal for a few
 * minutes) and `no_journal` (the loan claims money moved and the ledger
 * disagrees). Showing both as "problem" would train officers to ignore it.
 */
export type DisbursementVerdict =
  | 'confirmed_cash'
  | 'confirmed_transfer'
  | 'in_flight'
  | 'failed'
  | 'reversed'
  | 'no_journal'
  | 'not_disbursed'

export interface DisbursementEvidence {
  loan_id: number
  member: string
  principal: string
  status: string
  status_display: string
  disbursed_at: string | null
  verdict: DisbursementVerdict
  headline: string
  detail: string
  /** 'cash' | 'transfer' | 'unknown' — a cash loan has no payout to ask about. */
  method: string
  can_recheck: boolean
  /** Why rechecking is unavailable. Shown instead of a dead button. */
  recheck_unavailable_because: string
  journal: {
    id: number
    reference: string
    memo: string
    /** Read from the ledger entries, not from the loan's principal. */
    amount: string
    occurred_at: string
    posted_at: string
    is_reversed: boolean
  } | null
  payout: {
    id: number
    reference: string
    status: string
    status_display: string
    summary: string
    destination: string
    failure_reason: string
    needs_recheck: boolean
    sent_at: string | null
    settled_at: string | null
  } | null
}

export interface WalletSummary {
  balance: string
  currency: string
  /** Funding that actually arrived (confirmed only). */
  topups: WalletTopUp[]
  /** Checkouts started but not paid: pending or failed. */
  attempts: WalletTopUp[]
  attempt_counts: { pending: number; failed: number }
}

/**
 * Money sent out of the platform to a bank account — a loan disbursement, a
 * society withdrawing its own wallet float, later a savings payout.
 *
 * `needs_recheck` is true while the provider has not confirmed settlement. A
 * webhook can be missed or delayed, so a payout can sit pending here while the
 * money has in fact already left; that flag is what the officer's recheck
 * action looks for.
 */
export interface Payout {
  id: number
  kind: 'loan' | 'wallet' | 'savings'
  kind_display: string
  object_id: number | null
  amount: string
  currency: string
  status: 'queued' | 'pending' | 'success' | 'failed' | 'reversed'
  status_display: string
  /** Amount, bank and account as one line. */
  summary: string
  needs_recheck: boolean
  is_settled: boolean
  destination_bank_name: string
  destination_bank_code: string
  destination_account_no: string
  destination_account_name: string
  reference: string
  transfer_code: string
  reason: string
  failure_reason: string
  journal: number | null
  requested_by: number | null
  requested_by_name: string | null
  sent_at: string | null
  settled_at: string | null
  created_at: string
}
