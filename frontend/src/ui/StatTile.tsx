import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function StatTile({
  label,
  value,
  icon,
  iconTone = 'green',
  trend,
  trendUp,
  foot,
}: {
  label: string
  value: ReactNode
  icon?: string
  iconTone?: 'green' | 'gold' | 'danger' | 'neutral'
  trend?: string
  trendUp?: boolean
  foot?: ReactNode
}) {
  const iconToneCls = {
    green: 'bg-green-50 text-green',
    gold: 'bg-gold-50 text-gold-deep',
    danger: 'bg-danger-50 text-danger',
    neutral: 'bg-sand-deep text-muted',
  }[iconTone]

  return (
    <div className="rounded-card border border-line bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted">{label}</span>
        {icon && (
          <span className={`flex size-8 items-center justify-center rounded-md ${iconToneCls}`}>
            <Icon name={icon} size={18} />
          </span>
        )}
      </div>
      <div className="mt-2 font-display text-[26px] font-semibold leading-none tracking-tight text-ink tnum">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[12px]">
        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 font-medium ${trendUp ? 'text-green-bright' : 'text-danger'}`}
          >
            <Icon name={trendUp ? 'trending_up' : 'trending_down'} size={15} />
            {trend}
          </span>
        )}
        {foot && <span className="text-muted-2">{foot}</span>}
      </div>
    </div>
  )
}
