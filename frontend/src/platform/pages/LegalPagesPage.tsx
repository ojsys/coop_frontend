import { useState } from 'react'
import { type LegalDoc, useDeleteLegalDoc, useLegalDocs, useSaveLegalDoc } from '@/api/legal'
import { LegalProse } from '@/marketing/LegalProse'
import { PageHeader } from '@/ui/PageHeader'
import { Card } from '@/ui/Card'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Icon } from '@/ui/Icon'
import { Modal } from '@/ui/Modal'
import { QueryState } from '@/ui/QueryState'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { dateTime, longDate } from '@/lib/format'

/**
 * Policy pages — Terms and Conditions, the Privacy Notice and anything else
 * the legal team publishes — edited here without a deployment. What is typed
 * is plain text with a few marks, previewed exactly as the public page shows
 * it. Every save is in the audit log.
 */

const FORMAT_HINT = [
  ['## Heading', 'a section heading'],
  ['### Sub-heading', 'a smaller heading'],
  ['- item', 'a bullet'],
  ['**bold**', 'bold text'],
  ['[text](https://…)', 'a link — or (/privacy) for a page of this site'],
  ['blank line', 'a new paragraph'],
]

function publicPath(slug: string) {
  return slug === 'terms' || slug === 'privacy' ? `/${slug}` : `/legal/${slug}`
}

export function LegalPagesPage() {
  const { data = [], isLoading, isError } = useLegalDocs()
  // null: closed; 'new': a blank page; a document: editing it.
  const [editing, setEditing] = useState<LegalDoc | 'new' | null>(null)

  return (
    <div>
      <PageHeader
        title="Legal pages"
        subtitle="Terms and Conditions, the Privacy Notice and other policies — edited here, live on the site when published."
        actions={<Button icon="add" onClick={() => setEditing('new')}>New page</Button>}
      />
      <QueryState isLoading={isLoading} isError={isError} minHeight={200}>
        <div className="space-y-3">
          {data.length === 0 && (
            <Card><p className="text-sm text-muted">No legal pages yet.</p></Card>
          )}
          {data.map((doc) => (
            <Card key={doc.id} onClick={() => setEditing(doc)} className="cursor-pointer transition hover:border-green">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-green-50 text-green">
                    <Icon name="gavel" size={20} />
                  </span>
                  <div>
                    <div className="font-display text-[15px] font-semibold text-ink">{doc.title}</div>
                    <div className="font-mono text-[12px] text-muted">{publicPath(doc.slug)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[13px] text-muted">
                  {doc.effective_date && <span>Effective {longDate(doc.effective_date)}</span>}
                  <span>Edited {dateTime(doc.updated_at)}</span>
                  <Badge tone={doc.published ? 'green' : 'neutral'} dot>{doc.published ? 'Published' : 'Draft'}</Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </QueryState>
      {editing && <Editor doc={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function Editor({ doc, onClose }: { doc?: LegalDoc; onClose: () => void }) {
  const toast = useToast()
  const save = useSaveLegalDoc()
  const remove = useDeleteLegalDoc()
  const [form, setForm] = useState({
    title: doc?.title ?? '',
    slug: doc?.slug ?? '',
    body: doc?.body ?? '',
    effective_date: doc?.effective_date ?? '',
    published: doc?.published ?? false,
    order: doc?.order ?? 0,
  })
  const [view, setView] = useState<'write' | 'preview'>('write')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await save.mutateAsync({ id: doc?.id, ...form, effective_date: form.effective_date || null })
      toast(form.published ? 'Saved — live on the site' : 'Saved as a draft')
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not save the page'), 'error')
    }
  }

  async function onDelete() {
    if (!doc) return
    try {
      await remove.mutateAsync(doc.id)
      toast('Page deleted')
      onClose()
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not delete the page'), 'error')
    }
  }

  return (
    <Modal open onClose={onClose} title={doc ? `Edit ${doc.title}` : 'New legal page'} width={980}>
      <form onSubmit={submit}>
        <div className="max-h-[74vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-[1fr_200px_170px]">
            <Field label="Title">
              <input required value={form.title} onChange={(e) => set('title', e.target.value)} className="input" />
            </Field>
            <Field
              label="Web address"
              hint={doc?.fixed ? 'Wired into the site; cannot change.' : undefined}
            >
              <div className="flex items-center rounded-md border border-line bg-paper pl-2.5 focus-within:border-green">
                <span className="font-mono text-[13px] text-muted-2">/</span>
                <input
                  required
                  disabled={doc?.fixed}
                  value={form.slug}
                  onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  className="w-full bg-transparent px-1 py-2 font-mono text-[13px] outline-none disabled:text-muted"
                  placeholder="refund-policy"
                />
              </div>
            </Field>
            <Field label="Effective date" hint="Optional.">
              <input type="date" value={form.effective_date} onChange={(e) => set('effective_date', e.target.value)} className="input" />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex gap-1.5">
                {(['write', 'preview'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                      view === v ? 'bg-green text-paper' : 'bg-sand-deep text-ink-soft hover:bg-sand'
                    }`}
                  >
                    {v === 'write' ? 'Write' : 'Preview'}
                  </button>
                ))}
              </div>
              {doc?.published && (
                <a href={publicPath(doc.slug)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-green hover:underline">
                  View live page <Icon name="open_in_new" size={14} />
                </a>
              )}
            </div>

            {view === 'write' ? (
              <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                <textarea
                  required
                  value={form.body}
                  onChange={(e) => set('body', e.target.value)}
                  rows={22}
                  className="input font-mono text-[13px] leading-relaxed"
                  placeholder="Paste or write the text here."
                />
                <div className="rounded-lg border border-line bg-sand/40 p-3 text-[12px]">
                  <div className="mb-2 font-semibold text-ink">Formatting</div>
                  <ul className="space-y-1.5 text-muted">
                    {FORMAT_HINT.map(([mark, what]) => (
                      <li key={mark}>
                        <code className="rounded bg-sand-deep px-1 py-0.5 font-mono text-[11px] text-ink-soft">{mark}</code>{' '}
                        {what}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-muted">HTML is not interpreted — tags would show as text.</p>
                </div>
              </div>
            ) : (
              <div className="min-h-[420px] rounded-lg border border-line bg-paper px-6 py-5">
                <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{form.title || 'Untitled'}</h1>
                {form.effective_date && <p className="mt-1 text-[13px] text-muted-2">Effective {longDate(form.effective_date)}</p>}
                <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-ink-soft">
                  <LegalProse body={form.body} />
                </div>
              </div>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} className="mt-0.5 accent-green" />
            <span>
              Published
              <span className="block text-[13px] text-muted">
                Visible at {publicPath(form.slug || 'your-page')} and linked in the site footer. Leave off while the text is still a draft.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          {doc && !doc.fixed ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-ink-soft">Delete this page?</span>
                <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>No</Button>
                <Button type="button" variant="danger" size="sm" loading={remove.isPending} onClick={onDelete}>Delete</Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" icon="delete" onClick={() => setConfirmDelete(true)}>Delete page</Button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" loading={save.isPending}>Save</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
