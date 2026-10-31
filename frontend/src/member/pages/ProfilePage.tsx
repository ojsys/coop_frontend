import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useAnnouncements, useMyProfile, useMyDocuments } from '@/api/hooks'
import {
  useUpdateMyProfile,
  useUploadMyPhoto,
  useUploadMyDocument,
  useDeleteMyDocument,
} from '@/api/mutations'
import { MemberHeader } from '../MemberShell'
import { Icon } from '@/ui/Icon'
import { Avatar } from '@/ui/Avatar'
import { VerifiedBadge } from '@/ui/VerifiedBadge'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { Field, Select } from '@/ui/Field'
import { BankSelect } from '@/ui/BankSelect'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { timeAgo, longDate, phone } from '@/lib/format'
import type { Member } from '@/api/types'
import { api } from '@/api/client'
import { session } from '@/api/session'
import {
  downloadMyData,
  useCancelDeletion,
  useMyDeletionState,
  useRequestDeletion,
} from '@/api/dataRights'
import { BlockerList, WhatDeletionMeans } from '@/marketing/AccountDeletePage'

export function ProfilePage() {
  const { user, activeMembership, logout } = useAuth()
  const { data: profile } = useMyProfile()
  const { data: documents = [] } = useMyDocuments()
  const { data: announcements = [] } = useAnnouncements()
  const uploadPhoto = useUploadMyPhoto()
  const del = useDeleteMyDocument()
  const toast = useToast()
  const photoRef = useRef<HTMLInputElement>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function exportData() {
    setExporting(true)
    try {
      await downloadMyData()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not prepare your data'), 'error')
    } finally {
      setExporting(false)
    }
  }
  // The upload sheet's preset type; null when closed. The ID step opens it on
  // "Means of ID", because an ID filed under another type does not count.
  const [docType, setDocType] = useState<string | null>(null)

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadPhoto.mutateAsync(file)
      toast('Photo updated')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not upload photo'), 'error')
    }
  }

  const p = profile
  return (
    <div>
      <MemberHeader title="Profile" />

      <div className="px-5 md:px-0">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4">
          <div className="relative">
            {p?.photo ? (
              <img src={p.photo} alt={user?.full_name ?? ''} className="size-[52px] rounded-full object-cover" />
            ) : (
              <Avatar name={user?.full_name ?? '?'} size={52} />
            )}
            <button
              onClick={() => photoRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-card bg-green text-paper transition hover:bg-green-hover"
              title="Upload photo"
            >
              <Icon name={uploadPhoto.isPending ? 'hourglass_empty' : 'photo_camera'} size={13} />
            </button>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-display text-lg font-semibold text-ink">
              {user?.full_name}
              <VerifiedBadge via={p?.verified_via} size={19} />
            </div>
            <div className="font-mono text-xs text-muted-2">
              {activeMembership?.member_no} · {phone(user?.phone) || user?.email}
            </div>
          </div>
        </div>

        {p && (
          <ProfileProgress
            profile={p}
            onEdit={() => setEditOpen(true)}
            onPhoto={() => photoRef.current?.click()}
            onUploadId={() => setDocType('id')}
          />
        )}
      </div>

      {/* KYC */}
      <Section title="KYC & personal" action={p ? { label: 'Edit', onClick: () => setEditOpen(true) } : undefined}>
        {p && (
          <div className="space-y-2 rounded-2xl border border-line bg-card p-4 text-sm">
            <Kv k="Date of birth" v={p.date_of_birth ? longDate(p.date_of_birth) : '—'} />
            <Kv k="Gender" v={p.gender || '—'} />
            <Kv k="Occupation" v={p.occupation || '—'} />
            <Kv k="Address" v={p.address || '—'} />
            <Kv k="Next of kin" v={p.next_of_kin_name ? `${p.next_of_kin_name}${p.next_of_kin_phone ? ` · ${p.next_of_kin_phone}` : ''}` : '—'} />
            <Kv k="Bank" v={p.bank_name ? `${p.bank_name}${p.bank_account_no ? ` · ${p.bank_account_no}` : ''}` : '—'} />
          </div>
        )}
      </Section>

      {/* Documents */}
      <Section title="Documents" action={{ label: 'Upload', onClick: () => setDocType('id') }}>
        <div className="space-y-2">
          {documents.length === 0 && (
            <p className="rounded-2xl border border-line bg-card px-4 py-5 text-center text-sm text-muted">No documents uploaded.</p>
          )}
          {documents.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
              <Icon name="description" size={20} className="text-muted-2" />
              <div className="flex-1">
                <div className="text-sm font-medium text-ink">{d.label || d.doc_type_display}</div>
                <div className="text-xs text-muted-2">{d.doc_type_display} · {longDate(d.created_at)}</div>
              </div>
              <a href={d.file} target="_blank" rel="noreferrer" className="p-1 text-muted-2 transition hover:text-ink" title="View"><Icon name="visibility" size={18} /></a>
              <button onClick={() => del.mutate(d.id)} className="p-1 text-muted-2 transition hover:text-danger" title="Remove"><Icon name="delete" size={18} /></button>
            </div>
          ))}
        </div>
      </Section>

      {/* Announcements */}
      <Section title="Announcements">
        <div className="space-y-2">
          {announcements.slice(0, 3).map((a) => (
            <div key={a.id} className="rounded-2xl border border-line bg-card p-4">
              <div className="font-display text-[14px] font-semibold text-ink">{a.title}</div>
              <p className="mt-1 line-clamp-2 text-[13px] text-muted">{a.body}</p>
              <div className="mt-1.5 text-xs text-muted-2">{a.sent_at ? timeAgo(a.sent_at) : 'draft'}</div>
            </div>
          ))}
          {announcements.length === 0 && (
            <p className="rounded-2xl border border-line bg-card px-4 py-6 text-center text-sm text-muted">No announcements.</p>
          )}
        </div>
      </Section>

      {/* Settings */}
      <Section title="Settings">
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          {/* On phones the bottom tab bar is full, so this is where a member
              gets back out to the public site. The desktop sidebar carries the
              same link. */}
          <Link
            to="/"
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-ink-soft transition hover:bg-sand-deep"
          >
            <Icon name="language" size={20} />
            <span className="text-sm font-medium">View website</span>
          </Link>
          <div className="border-t border-line" />
          <Link
            to="/refer"
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-ink-soft transition hover:bg-sand-deep"
          >
            <Icon name="redeem" size={20} />
            <span className="text-sm font-medium">Refer a cooperative &amp; earn</span>
          </Link>
          <div className="border-t border-line" />
          {/* Reachable from inside the app, not only the public footer: this is
              where a member looks for what is held about them and how to have it
              deleted, and the app stores would expect to find it here too. */}
          <Link
            to="/privacy"
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-ink-soft transition hover:bg-sand-deep"
          >
            <Icon name="privacy_tip" size={20} />
            <span className="text-sm font-medium">Privacy notice</span>
          </Link>
          <div className="border-t border-line" />
          <button onClick={() => setPasswordOpen(true)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-ink-soft transition hover:bg-sand-deep">
            <Icon name="lock" size={20} />
            <span className="text-sm font-medium">Change password</span>
          </button>
          <div className="border-t border-line" />
          {/* Your data, yours to take and to have deleted — next to the
              privacy notice that explains both. */}
          <button onClick={exportData} disabled={exporting} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-ink-soft transition hover:bg-sand-deep disabled:opacity-60">
            <Icon name={exporting ? 'hourglass_empty' : 'download'} size={20} />
            <span className="text-sm font-medium">{exporting ? 'Preparing your data…' : 'Download my data'}</span>
          </button>
          <div className="border-t border-line" />
          <button onClick={() => setDeleteOpen(true)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-ink-soft transition hover:bg-sand-deep">
            <Icon name="person_remove" size={20} />
            <span className="text-sm font-medium">Delete my account</span>
          </button>
          <div className="border-t border-line" />
          <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-danger">
            <Icon name="logout" size={20} />
            <span className="text-sm font-medium">Sign out</span>
          </button>
        </div>
      </Section>

      {editOpen && p && <EditKycModal profile={p} onClose={() => setEditOpen(false)} />}
      {deleteOpen && <DeleteAccountModal onClose={() => setDeleteOpen(false)} onExport={exportData} exporting={exporting} />}
      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} />}
      {docType && <UploadDocModal initialType={docType} onClose={() => setDocType(null)} />}
    </div>
  )
}

/** Change your own password. The server rotates the sign-in token, which signs
 *  out every other device; this one stores the new token and carries on. */
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const mismatch = confirm.length > 0 && next !== confirm

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) return
    setSaving(true)
    try {
      const { data } = await api.post<{ detail: string; token: string }>('/me/password/', {
        current_password: current,
        new_password: next,
      })
      session.setToken(data.token)
      toast('Password changed. Other devices have been signed out.')
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not change your password'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Change password" subtitle="You will stay signed in here; other devices will be signed out.">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Current password">
          <input className="input" type="password" autoComplete="current-password" value={current}
            onChange={(e) => setCurrent(e.target.value)} required />
        </Field>
        <Field label="New password" hint="At least 8 characters, not all numbers, and not too common.">
          <input className="input" type="password" autoComplete="new-password" value={next}
            onChange={(e) => setNext(e.target.value)} minLength={8} required />
        </Field>
        <Field label="Confirm new password" hint={mismatch ? 'The passwords do not match.' : undefined}>
          <input className="input" type="password" autoComplete="new-password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={!current || next.length < 8 || next !== confirm}>
            Change password
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function Section({ title, action, children }: { title: string; action?: { label: string; onClick: () => void }; children: React.ReactNode }) {
  return (
    <div className="px-5 pt-6 md:px-0">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">{title}</h2>
        {action && (
          <button onClick={action.onClick} className="text-[13px] font-medium text-green">{action.label}</button>
        )}
      </div>
      {children}
    </div>
  )
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-2">{k}</span>
      <span className="text-right capitalize text-ink-soft">{v}</span>
    </div>
  )
}

function EditKycModal({ profile, onClose }: { profile: Member; onClose: () => void }) {
  const update = useUpdateMyProfile()
  const toast = useToast()
  const [form, setForm] = useState({
    phone: phone(profile.phone),
    date_of_birth: profile.date_of_birth ?? '',
    gender: profile.gender ?? '',
    occupation: profile.occupation ?? '',
    address: profile.address ?? '',
    next_of_kin_name: profile.next_of_kin_name ?? '',
    next_of_kin_phone: profile.next_of_kin_phone ?? '',
    bank_name: profile.bank_name ?? '',
    bank_code: profile.bank_code ?? '',
    bank_account_no: profile.bank_account_no ?? '',
  })
  function set(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await update.mutateAsync({ ...form, date_of_birth: form.date_of_birth || null })
      toast('Details updated')
      onClose()
    } catch (err) { toast(apiErrorMessage(err, 'Could not save'), 'error') }
  }

  return (
    <Modal open onClose={onClose} title="Edit your details">
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="input" /></Field>
          <Field label="Date of birth"><input type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} className="input" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gender">
            <Select value={form.gender} onChange={(e) => set('gender', e.target.value)} options={[
              { value: '', label: '—' }, { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'other', label: 'Other' },
            ]} />
          </Field>
          <Field label="Occupation"><input value={form.occupation} onChange={(e) => set('occupation', e.target.value)} className="input" /></Field>
        </div>
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
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={update.isPending}>Save changes</Button>
        </div>
      </form>
    </Modal>
  )
}

function UploadDocModal({ initialType, onClose }: { initialType: string; onClose: () => void }) {
  const upload = useUploadMyDocument()
  const toast = useToast()
  const [docType, setDocType] = useState(initialType)
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { toast('Choose a file', 'error'); return }
    try {
      await upload.mutateAsync({ doc_type: docType, label, file })
      toast('Document uploaded')
      onClose()
    } catch (err) { toast(apiErrorMessage(err, 'Upload failed'), 'error') }
  }

  return (
    <Modal open onClose={onClose} title="Upload document" subtitle="Attach a KYC or supporting file">
      <form onSubmit={submit} className="space-y-3.5">
        <Field
          label="Type"
          hint={docType === 'id' ? "NIN slip, voter's card, driver's licence or international passport — a clear photo or scan." : undefined}
        >
          <Select value={docType} onChange={(e) => setDocType(e.target.value)} options={[
            { value: 'id', label: 'Means of ID' },
            { value: 'passport', label: 'Passport photograph' },
            { value: 'proof_of_address', label: 'Proof of address' },
            { value: 'form', label: 'Membership form' },
            { value: 'other', label: 'Other' },
          ]} />
        </Field>
        <Field label="Label" hint="Optional"><input value={label} onChange={(e) => setLabel(e.target.value)} className="input" placeholder="NIN slip" /></Field>
        <Field label="File"><input required type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={upload.isPending}>Upload</Button>
        </div>
      </form>
    </Modal>
  )
}

/** The road to the verified tick, one step at a time. Each unfinished step
 *  opens the form that finishes it, so nobody has to guess which field or
 *  document type is missing. */
function ProfileProgress({
  profile: p,
  onEdit,
  onPhoto,
  onUploadId,
}: {
  profile: Member
  onEdit: () => void
  onPhoto: () => void
  onUploadId: () => void
}) {
  if (p.verification_status === 'verified') return null

  const action: Record<string, { label: string; onClick: () => void }> = {
    details: { label: 'Add details', onClick: onEdit },
    contact: { label: 'Add details', onClick: onEdit },
    photo: { label: 'Add photo', onClick: onPhoto },
    id: { label: 'Upload ID', onClick: onUploadId },
  }

  const awaiting = p.verification_status === 'awaiting'
  const declined = p.verification_status === 'withdrawn'

  return (
    <div className="mt-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-display text-[14px] font-semibold text-ink">
          <Icon name={awaiting ? 'hourglass_top' : 'verified'} size={18} className={awaiting ? 'text-gold' : 'text-green'} />
          {awaiting ? 'Awaiting verification' : 'Complete your profile'}
        </div>
        <span className="font-mono text-[13px] font-semibold text-ink">{p.profile_percent}%</span>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-sand-deep">
        <div className={`h-full rounded-full transition-all ${awaiting ? 'bg-gold' : 'bg-green'}`} style={{ width: `${p.profile_percent}%` }} />
      </div>

      {declined && (
        <div className="mt-3 rounded-xl bg-danger-50 px-3 py-2.5 text-[13px] text-ink-soft">
          <strong className="text-danger">An officer couldn’t verify you yet.</strong>{' '}
          {p.verification_note ? `They said: “${p.verification_note}”. ` : ''}
          Fix it below and it goes straight back to them.
        </div>
      )}

      {awaiting ? (
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          Your profile is 100% complete. An officer of your cooperative will check your details and ID, and you’ll be notified when you’re verified.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {p.profile_steps.map((step, n) => (
            <li key={step.key} className="flex items-center gap-3">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                  step.done ? 'bg-green text-paper' : 'border border-line text-muted'
                }`}
              >
                {step.done ? <Icon name="check" size={15} /> : n + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`text-sm ${step.done ? 'text-muted line-through decoration-muted-2' : 'font-medium text-ink'}`}>{step.label}</div>
                {!step.done && step.missing.length > 1 && (
                  <div className="truncate text-xs text-muted-2">Needs {step.missing.join(', ').toLowerCase()}</div>
                )}
              </div>
              {!step.done && (
                <button onClick={action[step.key].onClick} className="shrink-0 rounded-full bg-green-50 px-3 py-1 text-[12px] font-semibold text-green transition hover:bg-green-100">
                  {action[step.key].label}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** Asking for the account to be deleted — or, once asked, seeing where it
 *  stands and cancelling. */
function DeleteAccountModal({
  onClose,
  onExport,
  exporting,
}: {
  onClose: () => void
  onExport: () => void
  exporting: boolean
}) {
  const { data: state } = useMyDeletionState()
  const request = useRequestDeletion()
  const cancel = useCancelDeletion()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const pending = state?.request?.status === 'pending' ? state.request : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await request.mutateAsync(reason.trim())
      toast('Request sent to your cooperative')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not send the request'), 'error')
    }
  }

  async function undo() {
    try {
      await cancel.mutateAsync()
      toast('Deletion request cancelled')
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not cancel'), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title="Delete my account" subtitle={pending ? 'Request pending' : undefined}>
      <div className="space-y-4">
        {pending ? (
          <p className="text-sm text-ink-soft">
            You asked on {longDate(pending.created_at)}. An officer will settle anything outstanding and
            complete it within 30 days; we'll email you when it's done. You can cancel until then.
          </p>
        ) : (
          <WhatDeletionMeans />
        )}
        {state && <BlockerList blockers={state.blockers} requested={Boolean(pending)} />}
        <button onClick={onExport} disabled={exporting} className="flex items-center gap-1.5 text-sm font-medium text-green hover:underline disabled:opacity-60">
          <Icon name="download" size={17} /> {exporting ? 'Preparing your data…' : 'Download a copy of my data first'}
        </button>

        {pending ? (
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Close</Button>
            <Button type="button" size="sm" loading={cancel.isPending} onClick={undo}>Cancel my request</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Field label="Reason" hint="Optional — helps your cooperative.">
              <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="input" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>Keep my account</Button>
              <Button type="submit" variant="danger" size="sm" loading={request.isPending}>Request deletion</Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
