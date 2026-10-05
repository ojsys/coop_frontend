import { useMemo, useState, type ReactNode } from 'react'
import { PageHeader } from './PageHeader'
import { Icon } from './Icon'

export interface GuideSection {
  id: string
  title: string
  icon: string
  /** Plain-text terms used by the filter — the body is JSX and not searchable. */
  keywords?: string
  body: ReactNode
}

/**
 * Two-column reference layout: a sticky list of topics beside the articles.
 *
 * Deliberately static content compiled with the app rather than rows in a
 * database. A guide that lives beside the code cannot describe a screen that
 * no longer exists, and it needs no editor, no permissions and no migration.
 * If staff ever need to edit it without a deploy, the section list is the seam
 * to move into the database.
 */
export function GuideLayout({
  title,
  subtitle,
  intro,
  sections,
}: {
  title: string
  subtitle: string
  intro?: ReactNode
  sections: GuideSection[]
}) {
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    return sections.filter((s) =>
      `${s.title} ${s.keywords ?? ''}`.toLowerCase().includes(q),
    )
  }, [query, sections])

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Topics */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="mb-3 flex items-center gap-2 rounded-md border border-line bg-card px-3 py-2">
            <Icon name="search" size={17} className="text-muted-2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted-2"
            />
          </div>

          <nav className="space-y-0.5">
            {visible.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-ink-soft transition hover:bg-sand-deep"
              >
                <Icon name={s.icon} size={17} className="text-muted-2" />
                {s.title}
              </a>
            ))}
            {visible.length === 0 && (
              <p className="px-3 py-2 text-[13px] text-muted">
                Nothing matches “{query}”.
              </p>
            )}
          </nav>
        </aside>

        {/* Articles */}
        <div className="min-w-0 space-y-4">
          {intro && !query && (
            <div className="rounded-[15px] border border-line bg-green-50/60 p-5 text-[14px] leading-relaxed text-ink-soft">
              {intro}
            </div>
          )}

          {visible.map((s) => (
            <section
              key={s.id}
              id={s.id}
              // Offset so the heading isn't hidden under the sticky header
              // when an anchor is followed.
              className="scroll-mt-20 rounded-[15px] border border-line bg-card p-6"
            >
              <h2 className="flex items-center gap-2.5 font-display text-[19px] font-semibold text-ink">
                <span className="flex size-8 items-center justify-center rounded-lg bg-green-50 text-green">
                  <Icon name={s.icon} size={18} />
                </span>
                {s.title}
              </h2>
              <div className="guide-body mt-3 space-y-3 text-[14px] leading-relaxed text-ink-soft">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

/** A numbered procedure. Steps are the thing people come to a guide for. */
export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-green text-[11px] font-bold text-paper">
            {i + 1}
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ol>
  )
}

/** A caution. Used sparingly, so it keeps its weight. */
export function Caution({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-gold/40 bg-gold-50/60 px-3.5 py-3 text-[13px] leading-relaxed text-ink-soft">
      <Icon name="warning" size={18} className="mt-0.5 shrink-0 text-gold-deep" />
      <div>{children}</div>
    </div>
  )
}
