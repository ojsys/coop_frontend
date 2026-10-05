import { PageHeader } from '@/ui/PageHeader'
import { DomainManager } from '../DomainManager'

export function WhiteLabelPage() {
  return (
    <div>
      <PageHeader
        title="White-label & Custom Domains"
        subtitle="Let each cooperative run on its own branded web address"
      />
      <DomainManager />
    </div>
  )
}
