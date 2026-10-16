import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PlatformMark } from '@/ui/PlatformMark'
import { usePublicBranding } from '@/api/public'
import { Icon } from '@/ui/Icon'
import { Button } from '@/ui/Button'
import { apiErrorMessage } from '@/lib/apiError'
import {
  useConfirmDeletion,
  useRequestDeletionByEmail,
  type DeletionBlocker,
} from '@/api/dataRights'

/**
 * Asking for your account to be deleted without the app — the URL given to
 * Google Play as the data-deletion route, so it must work for someone who
 * has uninstalled the app or cannot sign in.
 *
 * Email-confirmed: the request is only filed once the person follows the
 * link sent to the account's address, so nobody can file one for someone
 * else by typing their email.
 */

const inputClass =
  'w-full rounded-md border border-line bg-card px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-green focus:ring-2 focus:ring-green/15'

function Shell({ children }: { children: React.ReactNode }) {
  const { data: branding } = usePublicBranding()
  return (
    <div className="flex min-h-screen items-start justify-center bg-paper p-6 sm:items-center">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center gap-3">
          <PlatformMark size={40} />
          <span className="font-display text-lg font-semibold text-ink">
            {branding?.name || 'CooperativeOS'}
          </span>
        </Link>
        {children}
      </div>
    </div>
  )
}

/** What happens, in the privacy notice's words. Shown before anyone commits. */
export function WhatDeletionMeans() {
  return (
    <div className="space-y-2.5 rounded-xl border border-line bg-card p-4 text-[13px] leading-relaxed text-ink-soft">
      <p>
        <strong className="text-ink">Deleted:</strong> your sign-in, contact details, date of birth,
        gender, address, occupation, next of kin, bank details, photo and documents.
      </p>
      <p>
        <strong className="text-ink">Kept by your cooperative:</strong> its financial records —
        ledger, contribution and loan history — under your member number only, as its
        record-keeping duties require.
      </p>
      <p>
        Any savings, share capital or loan must be settled first. An officer completes the
        deletion within 30 days and we email you when it's done.
      </p>
    </div>
  )
}

export function BlockerList({ blockers, requested = false }: { blockers: DeletionBlocker[]; requested?: boolean }) {
  if (blockers.length === 0) return null
  return (
    <div className="rounded-xl border border-gold/40 bg-gold-50 p-4 text-[13px] text-ink-soft">
      <div className="mb-1.5 font-semibold text-ink">To be settled first</div>
      <ul className="space-y-1">
        {blockers.map((b, i) => (
          <li key={i} className="flex gap-2">
            <Icon name="schedule" size={16} className="mt-0.5 shrink-0 text-gold-deep" />
            <span>{b.cooperative ? <strong>{b.cooperative}: </strong> : null}{b.message}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-muted">
        {requested
          ? "Your cooperative's officers have been told and will contact you to settle these."
          : "You can still ask now — your cooperative's officers will contact you to settle these."}
      </p>
    </div>
  )
}

export function AccountDeletePage() {
  const request = useRequestDeletionByEmail()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await request.mutateAsync(email)
      setSent(true)
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not send the confirmation email.'))
    }
  }

  return (
    <Shell>
      {sent ? (
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Check your email</h1>
          <p className="mt-2 text-sm text-muted">
            If <span className="text-ink-soft">{email}</span> has an account, we've sent it a link to
            confirm the request. Nothing happens until you follow it. The link works for 3 days.
          </p>
        </div>
      ) : (
        <>
          <h1 className="font-display text-2xl font-semibold text-ink">Delete your account</h1>
          <p className="mt-1 text-sm text-muted">
            Ask for your account and personal data to be deleted. Enter the email address on your
            account and we'll send a link to confirm it's you.
          </p>

          <div className="mt-5"><WhatDeletionMeans /></div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-soft">Email</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className={inputClass} placeholder="you@example.com" />
            </label>
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-danger-50 px-3 py-2 text-sm text-danger">
                <Icon name="error" size={18} /> {error}
              </div>
            )}
            <Button type="submit" className="w-full" loading={request.isPending}>
              Email me a confirmation link
            </Button>
          </form>

          <p className="mt-6 text-[13px] text-muted">
            Want a copy of your data first? <Link to="/login" className="font-medium text-green hover:underline">Sign in</Link>{' '}
            and choose <strong>Download my data</strong> on your profile.
          </p>
        </>
      )}
    </Shell>
  )
}

export function AccountDeleteConfirmPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const confirm = useConfirmDeletion()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await confirm.mutateAsync({ token, reason: reason.trim() })
    } catch (err) {
      setError(apiErrorMessage(err, 'This link is invalid or has expired.'))
    }
  }

  if (confirm.data) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-semibold text-ink">Request sent</h1>
        <p className="mt-2 text-sm text-muted">{confirm.data.detail}</p>
        <div className="mt-5"><BlockerList blockers={confirm.data.blockers} requested /></div>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="font-display text-2xl font-semibold text-ink">Confirm account deletion</h1>
      <p className="mt-1 text-sm text-muted">This sends your request to your cooperative.</p>
      <div className="mt-5"><WhatDeletionMeans /></div>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-soft">Reason <span className="font-normal text-muted">(optional)</span></span>
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
        </label>
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-danger-50 px-3 py-2 text-sm text-danger">
            <Icon name="error" size={18} /> {error}{' '}
            <Link to="/account/delete" className="font-medium underline">Get a new link</Link>
          </div>
        )}
        <Button type="submit" variant="danger" className="w-full" loading={confirm.isPending} disabled={!token}>
          Yes, delete my account
        </Button>
      </form>
    </Shell>
  )
}
