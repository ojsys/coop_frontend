import { useAuth } from '@/auth/AuthContext'

/** The society's subscription, as the console's lock reads it. See
 *  RenewSubscription.tsx. */

/** Pages a lapsed society can still open. */
export const OPEN_WHILE_LAPSED = ['/console', '/console/settings', '/console/guide']

export function useSubscriptionState() {
  const { activeMembership } = useAuth()
  const plan = activeMembership?.plan
  return {
    plan,
    lapsed: plan?.lapsed ?? false,
    invoice: plan?.open_invoice ?? null,
    canPay: activeMembership?.is_privileged ?? false,
  }
}
