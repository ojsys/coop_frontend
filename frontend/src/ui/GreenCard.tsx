import type { ReactNode } from 'react'

// The signature green gradient card from the prototype (plan chip, savings hero).
export function GreenCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-lg p-3.5 text-paper ${className}`}
      style={{ background: 'linear-gradient(160deg,#0b4f3a,#0e6048)' }}
    >
      {children}
    </div>
  )
}
