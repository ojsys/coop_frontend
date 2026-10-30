import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import {
  useCooperativeDocuments,
  useDeleteCooperativeDocument,
  useResendEmailVerification,
  useSubmitVerification,
  useUploadCooperativeDocument,
  useVerification,
  type CooperativeDocType,
  type VerificationHolder,
} from '@/api/verification'
import { useUploadMemberDocument } from '@/api/mutations'
import { PageHeader } from '@/ui/PageHeader'
import { Card, CardHeader } from '@/ui/Card'
import { Badge, type Tone } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Spinner } from '@/ui/Spinner'
import { ErrorState } from '@/ui/EmptyState'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { dateTime } from '@/lib/format'

/**
 * The society's KYC checklist.
 *
 * Three things, in the order they tend to happen: confirm your own email,
 * have a Chairperson who has uploaded an ID (Secretary and Treasurer are
 * optional, since some societies are run by one person), and upload
 * the certificate of registration. The checklist itself comes from the server
 * (tenants/verification.py), so this page never decides what counts as done.
 */

const STATUS_TONE: Record<string, Tone> = {
  not_started: 'gold',
  submitted: 'blue',
  verified: 'green',
  changes_requested: 'danger',
}

const ACCEPT = 'image/*,.pdf'

export function VerificationPage() {
  const { user, activeMembership } = useAuth()
  const canAct = activeMembership?.is_privileged ?? false
  const { data, isLoading, isError } = useVerification()
  const docs = useCooperativeDocuments()
  const submit = useSubmitVerification()
  const resend = useResendEmailVerification()
  const toast = useToast()

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-7" />
      </div>
    )
  }
  if (isError || !data) return <ErrorState />

  const locked = data.status === 'submitted' || data.status === 'verified'
  const emailUnconfirmed = user?.email_verified === false

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Verification"
        subtitle="Who runs your cooperative, checked once — so online payments can open."
        actions={<Badge tone={STATUS_TONE[data.status]} dot>{data.status_display}</Badge>}
      />

      {data.status === 'verified' && (
        <Notice tone="green" icon="verified" title="Your cooperative is verified.">
          Online contributions and loan repayments, the disbursement wallet and
          electronic loan payouts are open to you.
        </Notice>
      )}
      {data.status === 'submitted' && (
        <Notice tone="blue" icon="hourglass_top" title="With us for review.">
          Sent {dateTime(data.submitted_at)}. We'll email your officers when it's checked —
          usually within two working days. Nothing else waits on it: keep using the console.
        </Notice>
      )}
      {data.status === 'changes_requested' && (
        <Notice tone="danger" icon="feedback" title="Our reviewer asked for a change.">
          “{data.reviewer_note}” Fix it below and send it again.
        </Notice>
      )}
      {data.status === 'not_started' && (
        <Notice tone="gold" icon="lock_open" title="What verification opens">
          Members paying online, funding the disbursement wallet and paying loans out
          electronically. Keeping your books, members, meetings and statements work
          without it.
        </Notice>
      )}

      {/* 1 — Email */}
      <Card className="mb-4">
        <CardHeader
          title={<Step n={1} done={!emailUnconfirmed}>Confirm your email</Step>}
          subtitle="The person sending the submission must have confirmed their address."
        />
        {emailUnconfirmed ? (
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-ink-soft">
            <span className="min-w-0 flex-1">
              We sent a link to <strong>{user?.email}</strong>.
            </span>
            <Button
              size="sm"
              variant="secondary"
              loading={resend.isPending}
              onClick={async () => {
                try {
                  toast((await resend.mutateAsync()).detail)
                } catch (err) {
                  toast(apiErrorMessage(err, 'Could not send the link.'), 'error')
                }
              }}
            >
              Send the link again
            </Button>
          </div>
        ) : (
          <p className="text-[13px] text-muted">{user?.email} is confirmed.</p>
        )}
      </Card>

      {/* 2 — Exco */}
      <Card className="mb-4">
        <CardHeader
          title={<Step n={2} done={data.officers.filter((o) => o.required).every((o) => o.done)}>Your exco’s IDs</Step>}
          subtitle="Your Chairperson uploads a means of ID — NIN slip, passport, driver's licence or voter's card. A Secretary and Treasurer are optional: add them if your society has them."
          action={
            canAct && !locked ? (
              <Link to="/console/members" className="text-[13px] font-semibold text-green hover:underline">
                Appoint officers
              </Link>
            ) : undefined
          }
        />
        <ul className="divide-y divide-line">
          {data.officers.map((office) => (
            <li key={office.role_slug} className="py-3 first:pt-0 last:pb-0">
              <div className="mb-1.5 flex items-center gap-2">
                <DoneIcon done={office.done} />
                <span className="text-sm font-semibold text-ink">{office.role_name}</span>
                <span className="text-[12px] text-muted-2">
                  {office.required ? 'Required' : 'Optional'}
                </span>
              </div>
              {office.holders.length === 0 ? (
                <p className="pl-7 text-[13px] text-muted">
                  {office.required
                    ? `Nobody holds this office yet. Add them as a member, then give them the ${office.role_name} role.`
                    : `Not needed to submit. If your society has a ${office.role_name}, add them as a member and give them the role.`}
                </p>
              ) : (
                <ul className="space-y-1.5 pl-7">
                  {office.holders.map((h) => (
                    <HolderRow
                      key={h.membership_id}
                      holder={h}
                      isYou={h.user_id === user?.id}
                      canUpload={canAct && !locked}
                    />
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {/* 3 — Society documents */}
      <Card className="mb-4">
        <CardHeader
          title={
            <Step n={3} done={data.documents.filter((d) => d.required).every((d) => d.done)}>
              Your cooperative’s papers
            </Step>
          }
          subtitle="A clear photo or scan is fine."
        />
        <ul className="divide-y divide-line">
          {data.documents.map((slot) => (
            <DocumentSlot
              key={slot.doc_type}
              docType={slot.doc_type}
              label={slot.label}
              required={slot.required}
              files={(docs.data ?? []).filter((d) => d.doc_type === slot.doc_type)}
              canEdit={canAct && !locked}
            />
          ))}
        </ul>
      </Card>

      {!locked && (
        <Card>
          {data.missing.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-[13px] font-semibold text-ink">Still to do</div>
              <ul className="space-y-1">
                {data.missing.map((m) => (
                  <li key={m} className="flex items-start gap-2 text-[13px] text-ink-soft">
                    <Icon name="radio_button_unchecked" size={16} className="mt-0.5 shrink-0 text-muted-2" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-muted">
              {canAct
                ? 'Once sent, the papers are locked until we have reviewed them.'
                : 'An officer who can manage the society sends this for review.'}
            </p>
            {canAct && (
              <Button
                icon="send"
                loading={submit.isPending}
                disabled={!data.ready || emailUnconfirmed}
                onClick={async () => {
                  try {
                    await submit.mutateAsync()
                    toast('Sent for review. We’ll email your officers when it’s checked.')
                  } catch (err) {
                    toast(apiErrorMessage(err, 'Could not send it for review.'), 'error')
                  }
                }}
              >
                {data.status === 'changes_requested' ? 'Send it again' : 'Send for review'}
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

function Notice({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'green' | 'blue' | 'gold' | 'danger'
  icon: string
  title: string
  children: React.ReactNode
}) {
  const styles = {
    green: 'border-green/20 bg-green-50 text-green',
    blue: 'border-line bg-card text-[#2c5f8a]',
    gold: 'border-gold/30 bg-gold-50 text-gold-deep',
    danger: 'border-danger/30 bg-danger-50 text-danger',
  }[tone]
  return (
    <div className={`mb-4 flex gap-3 rounded-lg border px-4 py-3 ${styles}`}>
      <Icon name={icon} size={20} className="mt-0.5 shrink-0" />
      <div className="text-[13px] text-ink-soft">
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  )
}

function Step({ n, done, children }: { n: number; done: boolean; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-semibold ${
          done ? 'bg-green text-paper' : 'bg-sand-deep text-muted'
        }`}
      >
        {done ? <Icon name="check" size={15} /> : n}
      </span>
      {children}
    </span>
  )
}

function DoneIcon({ done }: { done: boolean }) {
  return done ? (
    <Icon name="check_circle" size={19} fill className="text-green" />
  ) : (
    <Icon name="radio_button_unchecked" size={19} className="text-muted-2" />
  )
}

function HolderRow({
  holder,
  isYou,
  canUpload,
}: {
  holder: VerificationHolder
  isYou: boolean
  canUpload: boolean
}) {
  const upload = useUploadMemberDocument()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    try {
      await upload.mutateAsync({
        membership: holder.membership_id,
        doc_type: 'id',
        label: 'Means of ID',
        file,
      })
      toast(`ID uploaded for ${holder.full_name}.`)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not upload the ID.'), 'error')
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-2 text-[13px]">
      <span className="min-w-0 flex-1 text-ink-soft">
        {holder.full_name}
        {isYou && <span className="text-muted"> (you)</span>}
        <span className="ml-1.5 font-mono text-[12px] text-muted">{holder.member_no}</span>
      </span>
      {holder.has_id ? (
        <Badge tone="green">ID uploaded</Badge>
      ) : canUpload ? (
        <>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button
            size="sm"
            variant="secondary"
            icon="upload"
            loading={upload.isPending}
            onClick={() => input.current?.click()}
          >
            Upload ID
          </Button>
        </>
      ) : (
        <Badge tone="gold">ID needed</Badge>
      )}
    </li>
  )
}

function DocumentSlot({
  docType,
  label,
  required,
  files,
  canEdit,
}: {
  docType: CooperativeDocType
  label: string
  required: boolean
  files: { id: number; file: string; created_at: string }[]
  canEdit: boolean
}) {
  const upload = useUploadCooperativeDocument()
  const remove = useDeleteCooperativeDocument()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [removing, setRemoving] = useState<number | null>(null)

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <DoneIcon done={files.length > 0} />
        <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
          {label}
          {!required && <span className="ml-1.5 font-normal text-muted">optional</span>}
        </span>
        {canEdit && (
          <>
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                try {
                  await upload.mutateAsync({ doc_type: docType, file })
                  toast(`${label} uploaded.`)
                } catch (err) {
                  toast(apiErrorMessage(err, 'Could not upload it.'), 'error')
                }
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              icon="upload"
              loading={upload.isPending}
              onClick={() => input.current?.click()}
            >
              {files.length ? 'Add another' : 'Upload'}
            </Button>
          </>
        )}
      </div>
      {files.length > 0 && (
        <ul className="mt-1.5 space-y-1 pl-7">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-[13px]">
              <a href={f.file} target="_blank" rel="noreferrer" className="text-green hover:underline">
                View file
              </a>
              <span className="text-muted">· {dateTime(f.created_at)}</span>
              {canEdit && (
                <button
                  type="button"
                  className="ml-auto text-muted hover:text-danger disabled:opacity-60"
                  disabled={removing === f.id}
                  onClick={async () => {
                    setRemoving(f.id)
                    try {
                      await remove.mutateAsync(f.id)
                    } catch (err) {
                      toast(apiErrorMessage(err, 'Could not remove it.'), 'error')
                    } finally {
                      setRemoving(null)
                    }
                  }}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
