import { PageHeader } from './PageHeader'
import { EmptyState } from './EmptyState'

export function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="rounded-card border border-dashed border-line-deep bg-card">
        <EmptyState icon="construction" title="Coming up next" hint={note ?? 'This screen is being wired to the API.'} />
      </div>
    </div>
  )
}
