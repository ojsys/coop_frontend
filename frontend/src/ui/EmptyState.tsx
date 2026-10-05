import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function EmptyState({
  icon = 'inbox',
  title,
  hint,
  action,
}: {
  icon?: string
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-sand-deep text-muted-2">
        <Icon name={icon} size={24} />
      </span>
      <div className="font-display text-[15px] font-semibold text-ink">{title}</div>
      {hint && <p className="max-w-xs text-[13px] text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <EmptyState
      icon="error"
      title="Couldn't load this"
      hint={message ?? 'Something went wrong. Check the backend is running and try again.'}
    />
  )
}
