// Material Symbols Rounded wrapper. `name` is the ligature (e.g. "payments").
export function Icon({
  name,
  className = '',
  fill = false,
  size,
  style,
}: {
  name: string
  className?: string
  fill?: boolean
  size?: number
  style?: React.CSSProperties
}) {
  return (
    <span
      className={`msr${fill ? ' fill' : ''} ${className}`}
      style={{ fontSize: size, ...style }}
      aria-hidden="true"
    >
      {name}
    </span>
  )
}
