import { useState } from 'react'
import { useRoles } from '@/api/hooks'
import { useUpdateMember } from '@/api/mutations'
import { useToast } from '@/ui/toast'
import { Modal } from '@/ui/Modal'
import { Button } from '@/ui/Button'
import { Field, Select } from '@/ui/Field'
import { BankSelect } from '@/ui/BankSelect'
import { apiErrorMessage } from '@/lib/apiError'
import type { Member } from '@/api/types'

/** Edit a member's details, role and status. Renders nothing when `member` is null. */
export function MemberEditModal({
  member,
  onClose,
}: {
  member: Member | null
  onClose: () => void
}) {
  if (!member) return null
  return <MemberEditForm key={member.id} member={member} onClose={onClose} />
}

function MemberEditForm({ member, onClose }: { member: Member; onClose: () => void }) {
  const isMember = member.kind !== 'non_member'
  const update = useUpdateMember()
  const { data: roles = [] } = useRoles()
  const toast = useToast()
  // The server refuses a role change that would leave the cooperative with no
  // officer, and explains how to proceed. That message is the whole value of
  // the refusal, so it is shown in the form rather than flashed in a toast.
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    full_name: member.full_name,
    phone: member.phone ?? '',
    member_no: member.member_no,
    role: member.role != null ? String(member.role) : '',
    status: member.status,
    share_capital: member.share_capital,
    date_of_birth: member.date_of_birth ?? '',
    gender: member.gender ?? '',
    occupation: member.occupation ?? '',
    address: member.address ?? '',
    next_of_kin_name: member.next_of_kin_name ?? '',
    next_of_kin_phone: member.next_of_kin_phone ?? '',
    bank_name: member.bank_name ?? '',
    // Paystack identifies a bank by code, never by name. This form used to send
    // the name alone, so a member whose details an officer typed here could
    // never be paid electronically — their approved loans sat in the
    // awaiting-payment queue reading "no bank code" with nothing to act on.
    bank_code: member.bank_code ?? '',
    bank_account_no: member.bank_account_no ?? '',
  })

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await update.mutateAsync({
        id: member.id,
        full_name: form.full_name,
        phone: form.phone,
        member_no: form.member_no,
        ...(isMember ? { role: form.role ? Number(form.role) : null, share_capital: form.share_capital } : {}),
        status: form.status,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender,
        occupation: form.occupation,
        address: form.address,
        next_of_kin_name: form.next_of_kin_name,
        next_of_kin_phone: form.next_of_kin_phone,
        bank_name: form.bank_name,
        bank_code: form.bank_code,
        bank_account_no: form.bank_account_no,
      })
      toast('Member updated')
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update member'))
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${member.full_name}`} subtitle={member.member_no}>
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Full name">
          <input required value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Member no.">
            <input required value={form.member_no} onChange={(e) => set('member_no', e.target.value)} className="input" />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="input" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* Offices and shares are for members; a non-member's record keeps
              neither (the server refuses both). Convert them first. */}
          {isMember ? (
            <Field label="Role">
              <Select
                value={form.role}
                onChange={(e) => set('role', e.target.value)}
                options={[
                  { value: '', label: 'No role' },
                  ...roles.map((r) => ({ value: String(r.id), label: r.name })),
                ]}
              />
            </Field>
          ) : (
            <Field label="Type">
              <input disabled value="Non-member" className="input disabled:opacity-70" />
            </Field>
          )}
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
              options={[
                { value: 'prospective', label: 'Prospective' },
                { value: 'active', label: 'Active' },
                { value: 'suspended', label: 'Suspended' },
                { value: 'exited', label: 'Exited' },
              ]}
            />
          </Field>
        </div>
        {isMember && (
          <Field label="Share capital (₦)">
            <input inputMode="decimal" value={form.share_capital} onChange={(e) => set('share_capital', e.target.value)} className="input" />
          </Field>
        )}

        <details className="rounded-lg border border-line bg-paper px-3.5 py-2.5">
          <summary className="cursor-pointer text-[13px] font-medium text-ink-soft">KYC & personal details</summary>
          <div className="mt-3 space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of birth">
                <input type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} className="input" />
              </Field>
              <Field label="Gender">
                <Select value={form.gender} onChange={(e) => set('gender', e.target.value)} options={[
                  { value: '', label: '—' }, { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'other', label: 'Other' },
                ]} />
              </Field>
            </div>
            <Field label="Occupation"><input value={form.occupation} onChange={(e) => set('occupation', e.target.value)} className="input" /></Field>
            <Field label="Address"><input value={form.address} onChange={(e) => set('address', e.target.value)} className="input" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Next of kin"><input value={form.next_of_kin_name} onChange={(e) => set('next_of_kin_name', e.target.value)} className="input" /></Field>
              <Field label="Kin phone"><input value={form.next_of_kin_phone} onChange={(e) => set('next_of_kin_phone', e.target.value)} className="input" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <BankSelect
                name={form.bank_name}
                code={form.bank_code}
                onChange={(next) => setForm((f) => ({ ...f, ...next }))}
              />
              <Field label="Account no."><input value={form.bank_account_no} onChange={(e) => set('bank_account_no', e.target.value)} className="input" /></Field>
            </div>
          </div>
        </details>

        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-[13px] text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={update.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}
