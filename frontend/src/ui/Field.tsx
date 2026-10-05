import type { ReactNode, SelectHTMLAttributes } from 'react'

export function Field({
  label,
  hint,
  children,
  interactive = false,
  htmlFor,
}: {
  label: string
  hint?: string
  children: ReactNode
  /**
   * Set this when the field contains interactive content beyond its own input
   * — buttons, a search-results list, a picker.
   *
   * A `<label>` wrapping a labelable control forwards activation to that
   * control, and nesting other interactive elements inside one is invalid HTML
   * for exactly that reason. Desktop Chrome and Firefox still dispatch a nested
   * button's click, but **Safari — iOS Safari in particular — re-targets the
   * activation to the input**, so the button's onClick never runs and the
   * keyboard simply reopens. That is what stopped iPhone users selecting a
   * cooperative on the signup page after searching.
   *
   * With this set the wrapper is a `<div>`, so nested buttons receive their own
   * taps. Pass `htmlFor` (with a matching input `id`) to keep the label
   * associated with the input, since the implicit association is lost.
   */
  interactive?: boolean
  htmlFor?: string
}) {
  const labelText = htmlFor ? (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[13px] font-medium text-ink-soft"
    >
      {label}
    </label>
  ) : (
    <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>
  )

  if (interactive) {
    return (
      <div className="block">
        {labelText}
        {children}
        {hint && <span className="mt-1 block text-xs text-muted-2">{hint}</span>}
      </div>
    )
  }

  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-2">{hint}</span>}
    </label>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[]
}

export function Select({ options, className = '', ...rest }: SelectProps) {
  return (
    <select className={`input ${className}`} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
