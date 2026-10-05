import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-green text-paper hover:bg-green-hover',
  secondary: 'border border-line bg-card text-ink-soft hover:bg-sand',
  ghost: 'text-ink-soft hover:bg-sand-deep',
  danger: 'bg-danger text-white hover:opacity-90',
}
const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[13px] gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: string
  loading?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  children,
  className = '',
  disabled,
  ...rest
}: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-semibold transition disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <Spinner className="size-4" />
      ) : icon ? (
        <Icon name={icon} size={size === 'sm' ? 17 : 19} />
      ) : null}
      {children}
    </button>
  )
}
