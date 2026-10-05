import { Link, useParams } from 'react-router-dom'
import { useLegalDocument } from '@/api/public'
import { PrivacyPage } from './PrivacyPage'

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
      <Prose body={data!.body} />
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
          <p className="mt-2 text-[13px] text-muted-2">Effective {date}</p>
        )}
        <div className="mt-6 space-y-3 text-[14px] leading-relaxed text-ink-soft">
          {children}
        </div>
      </main>
    </div>
  )
}

/**
 * Renders the documented formatting subset, as elements rather than HTML.
 *
 * Supported, and described to the admin in the model's help text: a blank line
 * starts a paragraph, `## ` a heading, `### ` a sub-heading, `- ` a bullet,
 * `**bold**`, and `[text](url)`. Everything else is shown as written — so a
 * stray HTML tag appears as text instead of executing, which is the point.
 */
function Prose({ body }: { body: string }) {
  const blocks: React.ReactNode[] = []
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  let paragraph: string[] = []
  let bullets: string[] = []

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    blocks.push(
      <p key={`p${blocks.length}`}>{inline(paragraph.join(' '))}</p>,
    )
    paragraph = []
  }
  const flushBullets = () => {
    if (bullets.length === 0) return
    blocks.push(
      <ul key={`u${blocks.length}`} className="list-disc space-y-1.5 pl-5">
        {bullets.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>,
    )
    bullets = []
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (line === '') {
      flushBullets()
      flushParagraph()
    } else if (line.startsWith('### ')) {
      flushBullets()
      flushParagraph()
      blocks.push(
        <h3 key={`h3${blocks.length}`} className="pt-3 font-display text-[15px] font-semibold text-ink">
          {inline(line.slice(4))}
        </h3>,
      )
    } else if (line.startsWith('## ')) {
      flushBullets()
      flushParagraph()
      blocks.push(
        <h2 key={`h2${blocks.length}`} className="pt-5 font-display text-[19px] font-semibold text-ink">
          {inline(line.slice(3))}
        </h2>,
      )
    } else if (line.startsWith('- ')) {
      flushParagraph()
      bullets.push(line.slice(2))
    } else {
      flushBullets()
      paragraph.push(line)
    }
  }
  flushBullets()
  flushParagraph()

  return <>{blocks}</>
}

/** `**bold**` and `[text](url)`, as elements. Nothing else is interpreted. */
function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index))
    if (match[1] !== undefined) {
      out.push(<strong key={out.length}>{match[1]}</strong>)
    } else {
      out.push(
        <a
          key={out.length}
          href={match[3]}
          className="text-green hover:underline"
          target={match[3].startsWith('http') ? '_blank' : undefined}
          rel={match[3].startsWith('http') ? 'noreferrer' : undefined}
        >
          {match[2]}
        </a>,
      )
    }
    last = pattern.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
