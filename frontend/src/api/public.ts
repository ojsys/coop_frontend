import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { PlanFeature, PublicReference, SiteContent, SubdivisionRegion } from './types'

/** The platform's own brand — never a cooperative's. Anonymous visitors have
 *  no tenant context, so the public site always wears the platform identity. */
export interface PublicBranding {
  name: string
  brand_color: string
  logo: string | null
  favicon: string | null
  support_email: string
  support_phone: string
  /** GA4 measurement ID set by a platform admin. Empty = tracking is off. */
  ga_measurement_id: string
}

export interface PublicPlan {
  id: number
  name: string
  tier: 'small' | 'medium' | 'large'
  tier_display: string
  price_monthly: string
  /** Price for a year paid up front; null when quoted per society. */
  price_annual: string | null
  /** True when price_monthly is a starting price ("From …"). */
  price_is_from: boolean
  currency: string
  min_members: number
  /** 0 means "no upper bound". */
  max_members: number
  /** The band as written everywhere, e.g. "50–250 members". */
  band_label: string
  description: string
  /** Gated features this plan includes, labelled, in catalogue order. */
  features: { key: PlanFeature; label: string }[]
  /** Service promises (support, training…), one per entry. */
  extras: string[]
}

/** `GET /public/plan-catalogue/` — what every plan has, and what differs. */
export interface PlanCatalogue {
  core: string[]
  features: { key: PlanFeature; label: string; description: string }[]
}

export function usePlanCatalogue() {
  return useQuery({
    queryKey: ['plan-catalogue'],
    queryFn: async () => {
      const { data } = await api.get<PlanCatalogue>('/public/plan-catalogue/')
      return data
    },
    staleTime: 30 * 60_000,
  })
}

export function usePublicBranding() {
  return useQuery({
    queryKey: ['public-branding'],
    queryFn: async () => {
      const { data } = await api.get<PublicBranding>('/public/branding/')
      return data
    },
    // Marketing content barely changes; don't refetch it on every mount.
    staleTime: 5 * 60_000,
  })
}

export function usePublicPlans() {
  return useQuery({
    queryKey: ['public-plans'],
    queryFn: async () => {
      const { data } = await api.get<PublicPlan[]>('/public/plans/')
      return data
    },
    staleTime: 5 * 60_000,
  })
}

/**
 * The landing page's copy and imagery, edited in the Django admin.
 *
 * Kept on a short stale time rather than Infinity: an admin who changes the
 * headline expects to see it on a refresh, not at the end of the session.
 */
export function usePublicSiteContent() {
  return useQuery({
    queryKey: ['public-site-content'],
    queryFn: async () => {
      const { data } = await api.get<SiteContent>('/public/site-content/')
      return data
    },
    staleTime: 60_000,
  })
}

/**
 * The country + cooperative-type catalogue.
 *
 * Deliberately the *public* endpoint even on authenticated pages. The console
 * forms and the public signup form need exactly the same catalogue, and
 * pointing them at one source means the signup page cannot silently lose its
 * dropdowns again the way it did when they were fed by the authenticated
 * /reference/ (a 401 there left every option list empty).
 */
export function usePublicReference() {
  return useQuery({
    queryKey: ['public-reference'],
    queryFn: async () => {
      const { data } = await api.get<PublicReference>('/public/reference/')
      return data
    },
    // A static catalogue — never worth refetching within a session.
    staleTime: Infinity,
  })
}

/**
 * One country's regions, fetched only once a country is actually chosen.
 *
 * Nigeria alone is ~20KB of LGAs, so this stays out of the catalogue call.
 * Pass `undefined` for countries with no verified list and the query stays
 * idle — the caller renders text inputs instead.
 */
export function useCountrySubdivisions(country: string | undefined) {
  return useQuery({
    queryKey: ['public-subdivisions', country],
    enabled: Boolean(country),
    queryFn: async () => {
      const { data } = await api.get<{
        country: string
        regions: SubdivisionRegion[]
      }>(`/public/reference/subdivisions/${country}/`)
      return data
    },
    staleTime: Infinity,
  })
}

/**
 * One subscription invoice, addressed by its pay token.
 *
 * Public because an officer opens it from the invoice email with no session —
 * the token is the authorisation, so it is never listed, only fetched by exact
 * value.
 */
export interface PublicInvoice {
  number: string
  cooperative: string
  period_label: string
  plan: string | null
  amount: string
  currency: string
  status: string
  due_at: string | null
  payable: boolean
  paystack_public_key: string | null
  authorization_url?: string | null
  payment_error?: string
  payer_email?: string
  /** Minted fresh per attempt; required by Paystack Inline as `ref`. */
  reference?: string
}

export function usePublicInvoice(token: string | undefined) {
  return useQuery({
    enabled: Boolean(token),
    queryKey: ['public-invoice', token],
    queryFn: async () => {
      const { data } = await api.get<PublicInvoice>(`/public/invoice/${token}/`)
      return data
    },
    // A bad or spent token should not be retried into a rate limit.
    retry: false,
  })
}

/** Start a checkout for this invoice; returns a fresh Paystack reference. */
export async function startInvoicePayment(token: string): Promise<PublicInvoice> {
  // The server sets Paystack's return address to this invoice's pay page.
  const { data } = await api.post<PublicInvoice>(`/public/invoice/${token}/`, {})
  return data
}

/** Settle the invoice after Paystack hands the payer back. */
export async function verifyInvoicePayment(
  reference: string,
): Promise<{ number: string; status: string; paid: boolean }> {
  const { data } = await api.post('/public/invoice/verify/', { reference })
  return data
}

// ── Policy pages ────────────────────────────────────────────────────────────
// Written by a lawyer, pasted into the Django admin, served from here. Kept out
// of the code so publishing a revised policy is an admin task, not a deploy.

export interface LegalDocument {
  slug: string
  title: string
  body: string
  effective_date: string | null
  updated_at: string
}

/**
 * One policy page. 404s when nothing is published at that slug, which the
 * caller treats as "fall back" rather than as an error worth showing — the
 * /privacy URL is registered with Google Play and must never go blank.
 */
export function useLegalDocument(slug: string) {
  return useQuery({
    enabled: Boolean(slug),
    queryKey: ['legal', slug],
    // Don't retry a 404: an unpublished document is an answer, not a failure.
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await api.get<LegalDocument>(`/public/legal/${slug}/`)
      return data
    },
  })
}

/** The published policy pages, for footer links. */
export function useLegalIndex() {
  return useQuery({
    queryKey: ['legal-index'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await api.get<{
        documents: { slug: string; title: string }[]
      }>('/public/legal/')
      return data.documents
    },
  })
}
