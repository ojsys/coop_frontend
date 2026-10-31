import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMember, useMemberStatement, useMemberDocuments, useSavingsGoals, useSavingsProducts, useWithdrawals } from '@/api/hooks'
import { useUploadMemberPhoto, useUploadMemberDocument, useDeleteMemberDocument, useSavingsGoalsCrud, useRequestWithdrawal, useMembersCrud } from '@/api/mutations'
import { MemberEditModal } from '../MemberEditModal'
import { session } from '@/api/session'
import { useAuth } from '@/auth/AuthContext'
import { Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Avatar } from '@/ui/Avatar'
import { Badge, StatusPill } from '@/ui/Badge'
import { VerifiedBadge } from '@/ui/VerifiedBadge'
import { StatTile } from '@/ui/StatTile'
import { Table, type Column } from '@/ui/Table'
import { QueryState } from '@/ui/QueryState'
import { Modal } from '@/ui/Modal'
import { Field, Select } from '@/ui/Field'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { naira, longDate, lineAmount, signedNaira, phone } from '@/lib/format'
import type { Member, StatementLine, Withdrawal } from '@/api/types'

export function MemberDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: member, isLoading, isError } = useMember(id)
  const { data: statement } = useMemberStatement(id)
  const [editOpen, setEditOpen] = useState(false)
  // Requesting a payout is privileged-only server-side, so don't offer the
  // control to an office-holder who would only get a 403.
  const { activeMembership } = useAuth()
  const canPayOut = activeMembership?.is_privileged ?? false
  const convert = useMembersCrud().action
  const toast = useToast()

  async function convertToMember() {
    if (!member) return
    try {
      await convert.mutateAsync({ id: member.id, action: 'convert-to-member' })
      toast(`${member.full_name} is now a member — record their share capital to give them dividends and a vote`)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not convert'), 'error')
    }
  }

  function downloadPdf() {
    fetch(`/api/v1/reports/statement-pdf/?membership=${id}`, {
      headers: {
        Authorization: `Token ${session.getToken()}`,
        'X-Cooperative-Id': String(session.getCooperativeId() ?? ''),
      },
    })
      .then((r) => r.blob())
      .then((b) => {
        const url = URL.createObjectURL(b)
        const a = document.createElement('a')
        a.href = url
        a.download = `statement-${member?.member_no ?? id}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  const columns: Column<StatementLine>[] = [
    { key: 'date', header: 'Date', render: (l) => longDate(l.date) },
    { key: 'desc', header: 'Description', render: (l) => l.description },
    { key: 'amt', header: 'Amount', align: 'right', render: (l) => <span className="font-mono tnum text-green-bright">{signedNaira(lineAmount(l))}</span> },
    { key: 'bal', header: 'Balance', align: 'right', render: (l) => <span className="font-mono tnum">{naira(l.balance)}</span> },
  ]

  return (
    <div>
      <button onClick={() => navigate('/console/members')} className="mb-4 flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
        <Icon name="arrow_back" size={18} /> Back to members
      </button>

      <QueryState isLoading={isLoading} isError={isError}>
        {member && (
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <div className="space-y-4">
              <Card>
                <div className="flex items-center gap-3">
                  <PhotoBlock member={member} />
                  <div>
                    <div className="flex items-center gap-1.5 font-display text-lg font-semibold text-ink">
                      {member.full_name}
                      <VerifiedBadge via={member.verified_via} size={19} />
                    </div>
                    <div className="font-mono text-xs text-muted-2">{member.member_no}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <StatusPill status={member.status} />
                      {member.kind === 'non_member' && <Badge tone="blue">Non-member</Badge>}
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2.5 text-sm">
                  <Row icon="badge" label={member.kind === 'non_member' ? 'Non-member — no vote, shares or dividends' : (member.role_name ?? 'Member')} />
                  <Row icon="call" label={phone(member.phone) || '—'} />
                  <Row icon="mail" label={member.email || 'No email'} />
                  <Row icon="event" label={member.joined_at ? `Joined ${longDate(member.joined_at)}` : 'Join date not set'} />
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" size="sm" icon="edit" className="flex-1" onClick={() => setEditOpen(true)}>Edit</Button>
                  <Button variant="secondary" size="sm" icon="download" className="flex-1" onClick={downloadPdf}>Statement</Button>
                </div>
                {canPayOut && member.email && (
                  <Button variant="secondary" size="sm" icon="mail" className="mt-2 w-full" onClick={() => navigate(`/console/email?member=${member.id}`)}>
                    Email {member.full_name.split(' ')[0]}
                  </Button>
                )}
                {/* The same record carries on — loans, savings, history — so
                    converting is a one-step decision, not a re-registration. */}
                {canPayOut && member.kind === 'non_member' && (
                  <Button size="sm" icon="how_to_reg" className="mt-2 w-full" loading={convert.isPending} onClick={convertToMember}>
                    Convert to member
                  </Button>
                )}
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Total savings" value={naira(member.savings_balance)} icon="savings" iconTone="green" />
                <StatTile label="Share capital" value={naira(member.share_capital)} icon="paid" iconTone="gold" />
              </div>

              <VerificationCard member={member} canVerify={canPayOut} />
              <KycCard member={member} />
              <SavingsGoalsCard membershipId={member.id} />
              <WithdrawalsCard member={member} canPayOut={canPayOut} />
            </div>

            <div className="space-y-4">
              <DocumentsCard membershipId={member.id} />

              <Card padded={false}>
                <div className="flex items-center justify-between p-5 pb-3">
                  <h3 className="font-display text-[15px] font-semibold text-ink">Statement</h3>
                  <Button variant="ghost" size="sm" icon="download" onClick={downloadPdf}>Download PDF</Button>
                </div>
                <Table columns={columns} rows={statement?.lines ?? []} rowKey={(_, i) => i} empty={<span className="text-sm text-muted">No transactions yet.</span>} />
              </Card>
            </div>
          </div>
        )}
      </QueryState>

      <MemberEditModal member={editOpen ? (member ?? null) : null} onClose={() => setEditOpen(false)} />
    </div>
  )
}

function PhotoBlock({ member }: { member: Member }) {
  const upload = useUploadMemberPhoto()
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await upload.mutateAsync({ id: member.id, file })
      toast('Photo updated')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not upload photo'), 'error')
    }
  }

  return (
    <div className="group relative">
      {member.photo ? (
        <img src={member.photo} alt={member.full_name} className="size-14 rounded-full object-cover" />
      ) : (
        <Avatar name={member.full_name} size={56} />
      )}
      <button
        onClick={() => fileRef.current?.click()}
        className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-card bg-green text-paper transition hover:bg-green-hover"
        title="Upload headshot"
      >
        <Icon name={upload.isPending ? 'hourglass_empty' : 'photo_camera'} size={13} />
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  )
}

function SavingsGoalsCard({ membershipId }: { membershipId: number }) {
  const { data: goals = [] } = useSavingsGoals(membershipId)
  const { data: products = [] } = useSavingsProducts()
  const { create, remove } = useSavingsGoalsCrud()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ product: '', name: '', target_amount: '', target_date: '' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await create.mutateAsync({ membership: membershipId, product: Number(form.product), name: form.name, target_amount: form.target_amount, target_date: form.target_date || null })
      toast('Savings goal added'); setOpen(false); setForm({ product: '', name: '', target_amount: '', target_date: '' })
    } catch (err) { toast(apiErrorMessage(err, 'Could not add goal'), 'error') }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-[15px] font-semibold text-ink">Savings goals</h3>
        <Button size="sm" variant="secondary" icon="add" onClick={() => setOpen(true)} disabled={products.length === 0}>Add</Button>
      </div>
      {products.length === 0 && <p className="text-[13px] text-muted">Create a savings product in Settings first.</p>}
      <div className="space-y-3">
        {goals.map((g) => (
          <div key={g.id}>
            <div className="mb-1 flex items-center justify-between text-[13px]">
              <span className="font-medium text-ink-soft">{g.name} <span className="text-muted-2">· {g.product_name}</span></span>
              <button onClick={() => remove.mutate(g.id)} className="text-muted-2 hover:text-danger" title="Remove"><Icon name="close" size={14} /></button>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-sand-deep">
              <div className="h-full rounded-full bg-green" style={{ width: `${g.progress_pct}%` }} />
            </div>
            <div className="mt-0.5 flex justify-between text-xs text-muted-2">
              <span>{naira(g.saved_amount)} of {naira(g.target_amount)}</span>
              <span>{g.progress_pct}%</span>
            </div>
          </div>
        ))}
        {goals.length > 0 || products.length > 0 ? goals.length === 0 && <p className="text-[13px] text-muted">No goals yet.</p> : null}
      </div>

      {open && (
        <Modal open onClose={() => setOpen(false)} title="New savings goal">
          <form onSubmit={submit} className="space-y-3.5">
            <Field label="Product">
              <Select required value={form.product} onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))} options={[{ value: '', label: 'Select…' }, ...products.map((p) => ({ value: String(p.id), label: p.name }))]} />
            </Field>
            <Field label="Goal name"><input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" placeholder="New shop" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Target (₦)"><input required type="number" min="0" value={form.target_amount} onChange={(e) => setForm((f) => ({ ...f, target_amount: e.target.value }))} className="input" /></Field>
              <Field label="Target date"><input type="date" value={form.target_date} onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))} className="input" /></Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" loading={create.isPending}>Add goal</Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  )
}

/** The verified badge: where the member is on the way to it, and the
 *  officer's decision once their profile is ready for review. */
function VerificationCard({ member, canVerify }: { member: Member; canVerify: boolean }) {
  const { action } = useMembersCrud()
  const toast = useToast()
  const [declining, setDeclining] = useState(false)
  const [note, setNote] = useState('')
  const status = member.verification_status
  const by = member.verified_by_name ?? 'an officer'
  const on = member.verified_at ? ` on ${longDate(member.verified_at)}` : ''

  async function decide(act: 'verify' | 'unverify') {
    try {
      await action.mutateAsync({ id: member.id, action: act, body: act === 'unverify' ? { note: note.trim() } : undefined })
      toast(act === 'verify' ? `${member.full_name} is verified` : 'Sent back to the member with your note')
      setDeclining(false)
      setNote('')
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not update verification'), 'error')
    }
  }

  const text = {
    verified: `Verified by ${by}${on}.`,
    awaiting: 'Profile complete and a means of ID uploaded. Check the ID under Documents against their details, then verify them — or decline with a note saying what to fix.',
    withdrawn: `Declined by ${by}${on}${member.verification_note ? `: “${member.verification_note}”` : ''}. They’re back in the queue as soon as they update their profile.`,
    incomplete: `Profile ${member.profile_percent}% complete. They’ll be ready for review once these are on file — or verify them now if you know them.`,
  }[status]

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-display text-[15px] font-semibold text-ink">Verification</h3>
        {status === 'verified' && <VerifiedBadge via={member.verified_via} label />}
        {status === 'awaiting' && <Badge tone="gold" dot>Awaiting review</Badge>}
        {status === 'withdrawn' && <Badge tone="danger">Declined</Badge>}
        {status === 'incomplete' && <Badge>{member.profile_percent}% complete</Badge>}
      </div>
      <p className="text-[13px] leading-relaxed text-muted">{text}</p>
      {status === 'incomplete' && (
        <ul className="mt-2.5 space-y-1 text-[13px] text-ink-soft">
          {member.verification_missing.map((m) => (
            <li key={m} className="flex items-center gap-2">
              <Icon name="radio_button_unchecked" size={15} className="text-muted-2" /> {m}
            </li>
          ))}
        </ul>
      )}
      {canVerify && (
        <div className="mt-3 flex gap-2">
          {status !== 'verified' && (
            <Button size="sm" icon="verified" className="flex-1" loading={action.isPending && !declining} onClick={() => decide('verify')}>
              Verify member
            </Button>
          )}
          {(status === 'awaiting' || status === 'verified') && (
            <Button size="sm" variant="secondary" className="flex-1" onClick={() => setDeclining(true)}>
              {status === 'verified' ? 'Remove verification' : 'Decline'}
            </Button>
          )}
        </div>
      )}

      <Modal
        open={declining}
        onClose={() => setDeclining(false)}
        title={status === 'verified' ? 'Remove verification' : 'Decline verification'}
        subtitle={member.full_name}
      >
        <form onSubmit={(e) => { e.preventDefault(); decide('unverify') }} className="space-y-4">
          <Field label="What should they fix?" hint="Sent to the member. They go back into the queue once they update their profile.">
            <textarea rows={3} required value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="The ID photo is blurry — please upload a clearer one" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setDeclining(false)}>Cancel</Button>
            <Button type="submit" size="sm" variant="danger" loading={action.isPending}>
              {status === 'verified' ? 'Remove' : 'Decline'}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}

function KycCard({ member }: { member: Member }) {
  const rows: [string, string][] = [
    ['Date of birth', member.date_of_birth ? longDate(member.date_of_birth) : '—'],
    ['Gender', member.gender || '—'],
    ['Occupation', member.occupation || '—'],
    ['Address', member.address || '—'],
    ['Next of kin', member.next_of_kin_name ? `${member.next_of_kin_name}${member.next_of_kin_phone ? ` · ${member.next_of_kin_phone}` : ''}` : '—'],
    ['Bank', member.bank_name ? `${member.bank_name}${member.bank_account_no ? ` · ${member.bank_account_no}` : ''}` : '—'],
  ]
  return (
    <Card>
      <h3 className="mb-3 font-display text-[15px] font-semibold text-ink">KYC & personal</h3>
      <div className="space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <span className="text-muted-2">{k}</span>
            <span className="text-right capitalize text-ink-soft">{v}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function DocumentsCard({ membershipId }: { membershipId: number }) {
  const { data: docs = [] } = useMemberDocuments(membershipId)
  const del = useDeleteMemberDocument()
  const [open, setOpen] = useState(false)
  const toast = useToast()

  return (
    <Card padded={false}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h3 className="font-display text-[15px] font-semibold text-ink">Documents</h3>
          <p className="text-[13px] text-muted">KYC & supporting files</p>
        </div>
        <Button size="sm" icon="upload_file" onClick={() => setOpen(true)}>Upload</Button>
      </div>
      <div className="divide-y divide-line">
        {docs.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted">No documents uploaded.</p>}
        {docs.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-5 py-3">
            <Icon name="description" size={20} className="text-muted-2" />
            <div className="flex-1">
              <div className="text-sm font-medium text-ink">{d.label || d.doc_type_display}</div>
              <div className="text-xs text-muted-2">{d.doc_type_display} · {longDate(d.created_at)}</div>
            </div>
            <a href={d.file} target="_blank" rel="noreferrer" className="rounded-md p-1.5 text-muted-2 transition hover:bg-sand hover:text-ink" title="View"><Icon name="visibility" size={18} /></a>
            <button onClick={() => del.mutate(d.id)} className="rounded-md p-1.5 text-muted-2 transition hover:text-danger" title="Remove"><Icon name="delete" size={18} /></button>
          </div>
        ))}
      </div>
      {open && <UploadDocModal membershipId={membershipId} onClose={() => setOpen(false)} onDone={() => toast('Document uploaded')} />}
    </Card>
  )
}

function UploadDocModal({ membershipId, onClose, onDone }: { membershipId: number; onClose: () => void; onDone: () => void }) {
  const upload = useUploadMemberDocument()
  const toast = useToast()
  const [docType, setDocType] = useState('id')
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { toast('Choose a file', 'error'); return }
    try {
      await upload.mutateAsync({ membership: membershipId, doc_type: docType, label, file })
      onDone(); onClose()
    } catch (err) { toast(apiErrorMessage(err, 'Upload failed'), 'error') }
  }

  return (
    <Modal open onClose={onClose} title="Upload document" subtitle="Attach a KYC or supporting file">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="Type">
          <Select value={docType} onChange={(e) => setDocType(e.target.value)} options={[
            { value: 'id', label: 'Means of ID' },
            { value: 'passport', label: 'Passport photo' },
            { value: 'proof_of_address', label: 'Proof of address' },
            { value: 'form', label: 'Membership form' },
            { value: 'other', label: 'Other' },
          ]} />
        </Field>
        <Field label="Label" hint="Optional">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="input" placeholder="NIN slip" />
        </Field>
        <Field label="File">
          <input required type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={upload.isPending}>Upload</Button>
        </div>
      </form>
    </Modal>
  )
}

function Row({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-ink-soft">
      <Icon name={icon} size={18} className="text-muted-2" />
      {label}
    </div>
  )
}

/**
 * Paying savings back out.
 *
 * Nothing here moves money. A request is recorded and sent to the approvals
 * queue; a *different* privileged officer approves it, and only then does it
 * post to the ledger and reduce the member's balance. That is why a row can sit
 * here as "awaiting approval" with the balance above it unchanged.
 */
function WithdrawalsCard({
  member,
  canPayOut,
}: {
  member: Member
  canPayOut: boolean
}) {
  const { data: withdrawals = [] } = useWithdrawals({ membership: member.id })
  const request = useRequestWithdrawal()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    amount: '',
    channel: 'transfer' as 'cash' | 'transfer',
    reason: '',
  })

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const result = await request.mutateAsync({
        membership: member.id,
        amount: form.amount,
        channel: form.channel,
        reason: form.reason,
      })
      toast(result.detail)
      setOpen(false)
      setForm({ amount: '', channel: 'transfer', reason: '' })
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not request the withdrawal'), 'error')
    }
  }

  const noAccount = !member.bank_account_no

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-[15px] font-semibold text-ink">Withdrawals</div>
          <div className="text-[13px] text-muted">
            {naira(member.savings_balance)} available
          </div>
        </div>
        {canPayOut && (
          <Button size="sm" variant="secondary" icon="payments" onClick={() => setOpen(true)}>
            Pay out
          </Button>
        )}
      </div>

      {withdrawals.length === 0 ? (
        <p className="py-1 text-[13px] text-muted">No withdrawals yet.</p>
      ) : (
        <ul className="space-y-2">
          {withdrawals.slice(0, 5).map((w: Withdrawal) => (
            <li key={w.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <span className="font-mono tnum text-ink">{naira(w.amount)}</span>
                <span className="ml-2 text-xs text-muted-2">{w.channel_display}</span>
              </span>
              {w.is_paid ? (
                <span className="shrink-0 text-xs font-medium text-green">Paid</span>
              ) : (
                <span className="shrink-0 text-xs font-medium text-gold-deep">
                  Awaiting approval
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-sand px-3 py-2 text-xs text-muted">
        <Icon name="verified_user" size={14} className="mt-0.5 shrink-0" />
        A second officer approves every payout before any money leaves — whoever
        requests one cannot approve it.
      </p>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={`Pay out to ${member.full_name}`}
          subtitle="Recorded now, paid once another officer approves"
        >
          <form onSubmit={submit} className="space-y-3.5">
            <Field
              label="Amount (₦)"
              hint={`${naira(member.savings_balance)} available. More than this is refused.`}
            >
              <input
                required
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                className="input"
                placeholder="0"
              />
            </Field>
            <Field
              label="Paid by"
              hint={
                noAccount
                  ? 'This member has no bank account on file, so only cash is possible.'
                  : `Transfer goes to ${member.bank_name} ${member.bank_account_no}.`
              }
            >
              <Select
                value={form.channel}
                onChange={(e) => set('channel', e.target.value as 'cash' | 'transfer')}
                options={[
                  { value: 'transfer', label: 'Bank transfer' },
                  { value: 'cash', label: 'Cash' },
                ]}
              />
            </Field>
            <Field label="Reason" hint="Optional — shown to the approver.">
              <input
                value={form.reason}
                onChange={(e) => set('reason', e.target.value)}
                className="input"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={request.isPending}>
                Send for approval
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  )
}
