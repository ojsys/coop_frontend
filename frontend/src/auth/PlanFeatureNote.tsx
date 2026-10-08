import { useAuth } from './AuthContext'
import { usePlanCatalogue, usePublicPlans } from '@/api/public'
import type { PlanFeature } from '@/api/types'
import { Icon } from '@/ui/Icon'

/**
 * Says why a control is unavailable and which plan includes it — in place of
 * a button that would only ever be refused.
 */
export function PlanFeatureNote({ feature, className = '' }: { feature: PlanFeature; className?: string }) {
  const { activeMembership } = useAuth()
  const { data: catalogue } = usePlanCatalogue()
  const { data: plans } = usePublicPlans()
  const label = catalogue?.features.find((f) => f.key === feature)?.label ?? 'This feature'
  const from = plans?.find((p) => p.features.some((f) => f.key === feature))?.name
  const current = activeMembership?.plan?.name

  return (
    <div className={`flex items-start gap-2 rounded-lg bg-sand-deep px-3 py-2.5 text-xs text-muted ${className}`}>
      <Icon name="lock" size={16} className="mt-px shrink-0 text-muted-2" />
      <span>
        <span className="font-semibold text-ink">{label}</span>
        {from ? ` is included from the ${from} plan` : ' is not included in your plan'}
        {current ? ` — your society is on ${current}.` : '.'}{' '}
        Contact us to upgrade.
      </span>
    </div>
  )
}
