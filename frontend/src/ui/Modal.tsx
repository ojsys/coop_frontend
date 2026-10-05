import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 460,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  width?: number
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative z-10 w-full overflow-hidden rounded-card border border-line bg-card shadow-float"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-sand-deep"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}
