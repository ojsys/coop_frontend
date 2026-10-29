import { Link, useParams } from 'react-router-dom'
import { useLegalDocument } from '@/api/public'
import { PrivacyPage } from './PrivacyPage'
import { LegalProse } from './LegalProse'
import { longDate } from '@/lib/format'

/**
 * A policy page whose text is written by a lawyer and pasted into the admin.
 *
 * Kept out of the code so publishing a revised policy is an admin task rather
 * than a deployment. Two things make that safe:
 *
 *  - An unpublished or absent document 404s, and `/privacy` then falls back to
 *    the notice built into the frontend. That URL is registered with Google
 *    Play, so it must never go blank while waiting for legal copy.
 *  - The body is rendered as React elements, never as HTML. Pasted text cannot
 *    inject markup, which matters when the paste comes from a Word document.
 */
export function LegalPage({ slug: fixedSlug }: { slug?: string }) {
  const params = useParams()
  const slug = fixedSlug ?? params.slug ?? ''
  const { data, isLoading, isError } = useLegalDocument(slug)

  // No published document. For the privacy notice that is expected until legal
  // copy arrives, so serve the built-in one rather than an empty page.
  if (!isLoading && (isError || !data)) {
    if (slug === 'privacy') return <PrivacyPage />
    return (
      <Shell title="Not published yet">
        <p>
          This page has not been published. If you were expecting a policy here,
          please{' '}
          <a className="text-green hover:underline" href="mailto:info@mycooperativeos.com">
            contact us
          </a>
          .
        </p>
      </Shell>
    )
  }

  if (isLoading) {
    return (
      <Shell title="">
        <div className="h-4 w-48 animate-pulse rounded bg-sand-deep" />
      </Shell>
    )
  }

  return (
    <Shell title={data!.title} date={data!.effective_date}>
      <LegalProse body={data!.body} />
    </Shell>
  )
}

function Shell({
  title,
  date,
  children,
}: {
  title: string
  date?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="font-display text-[15px] font-semibold text-ink">
            CooperativeOS
          </Link>
          <Link to="/" className="text-[13px] font-medium text-green hover:underline">
            Back to home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {date && (
          <p className="mt-2 text-[13px] text-muted-2">Effective {longDate(date)}</p>
        )}
        <div className="mt-6 space-y-3 text-[14px] leading-relaxed text-ink-soft">
          {children}
        </div>
      </main>
    </div>
  )
}
