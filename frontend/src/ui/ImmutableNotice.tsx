import { Icon } from './Icon'

export function ImmutableNotice() {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-green-100 bg-green-50 px-4 py-3">
      <Icon name="lock" size={18} className="mt-0.5 text-green" />
      <p className="text-[13px] text-green">
        <span className="font-semibold">Immutable ledger.</span> Postings cannot be
        edited or deleted. Corrections are made by posting a reversing entry — the
        original always remains visible for audit.
      </p>
    </div>
  )
}
