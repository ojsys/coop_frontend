import { useReference } from '@/api/hooks'
import { Field, Select } from './Field'

/**
 * Bank capture: a dropdown where we have a verified catalogue, free text where
 * we don't.
 *
 * Paystack identifies a bank by **code**, never by name — a settlement
 * subaccount and a member's transfer recipient are both created from
 * `(bank_code, account_number)`. So capturing "GTBank" as text is not enough to
 * pay anyone, which is why this component exists at all.
 *
 * The asymmetry is deliberate and mirrors LocationSelect: the catalogue is
 * empty until `manage.py refresh_banks` has run, or when no live PSP key is
 * configured. Falling back to a text input keeps the form usable in that state
 * instead of offering an empty dropdown — a bank entry screen must not break
 * because Paystack happened to be unreachable. The code is simply blank then,
 * and the officer or member re-picks their bank once the list is populated.
 *
 * Emits both halves together: selecting a bank sets the name *and* the code, so
 * the two can never drift apart in a form's state.
 */
export function BankSelect({
  name,
  code,
  onChange,
  label = 'Bank',
  required = false,
}: {
  name: string
  code: string
  onChange: (next: { bank_name: string; bank_code: string }) => void
  label?: string
  required?: boolean
}) {
  const { data } = useReference()
  const banks = data?.banks ?? []

  if (banks.length === 0) {
    return (
      <Field
        label={label}
        hint="Bank list unavailable — type the name; an officer can pick it from the list later."
      >
        <input
          required={required}
          value={name}
          onChange={(e) => onChange({ bank_name: e.target.value, bank_code: '' })}
          className="input"
          placeholder="Access Bank"
        />
      </Field>
    )
  }

  return (
    <Field label={label}>
      <Select
        required={required}
        // Keyed on the code, which is the half that identifies the bank.
        value={code}
        onChange={(e) => {
          const picked = banks.find((b) => b.code === e.target.value)
          onChange({
            bank_name: picked?.name ?? '',
            bank_code: picked?.code ?? '',
          })
        }}
        options={[
          { value: '', label: 'Select bank…' },
          ...banks.map((b) => ({ value: b.code, label: b.name })),
        ]}
      />
    </Field>
  )
}
