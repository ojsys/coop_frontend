import { useAuth } from './AuthContext'
import type { PlanFeature } from '@/api/types'

/**
 * Whether the active society's plan includes a feature.
 *
 * True when the server does not say (an older backend, or no membership yet):
 * the server enforces plan features regardless, so the cost of guessing wrong
 * here is a refusal message, never a feature handed out.
 */
export function useHasFeature(feature: PlanFeature): boolean {
  const { activeMembership } = useAuth()
  const features = activeMembership?.plan?.features
  return features ? features.includes(feature) : true
}
