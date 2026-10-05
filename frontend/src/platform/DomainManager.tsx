import { useState } from 'react'
import { Card, CardHeader } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Badge } from '@/ui/Badge'
import { Avatar } from '@/ui/Avatar'
import { Field } from '@/ui/Field'
import { CooperativeSearchSelect } from '@/ui/CooperativeSearchSelect'
import { useToast } from '@/ui/toast'
import { apiErrorMessage } from '@/lib/apiError'
import { useDomains, useReference } from '@/api/hooks'
import { useDomainsCrud } from '@/api/mutations'
import type { Domain } from '@/api/types'

const DNS_MEANING: Record<string, string> = {
  pending: "We haven't detected the DNS record yet — add it, then Verify.",
  verified: 'DNS is correctly pointed to us.',
  failed: "The record wasn't found or was wrong — double-check and retry.",
}
const SSL_MEANING: Record<string, string> = {
  awaiting: 'The HTTPS certificate is issued automatically once DNS verifies.',
  issued: 'A valid HTTPS certificate is active.',
  failed: 'Certificate issuance failed — verify DNS first.',
}

function Copyable({ label, value }: { label: string; value: string }) {
  const toast = useToast()
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-card px-3 py-2">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-2">{label}</div>
        <div className="truncate font-mono text-[13px] text-ink">{value}</div>
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value)
          toast('Copied')
        }}
        className="shrink-0 rounded-md p-1.5 text-muted-2 transition hover:bg-sand hover:text-ink"
        title="Copy"
      >
        <Icon name="content_copy" size={16} />
      </button>
    </div>
  )
}

export function HowItWorks() {
  const [open, setOpen] = useState(false)
  return (
    <Card className="!bg-green-50 !border-green-100">
      <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen((o) => !o)}>
        <Icon name="help" size={20} className="text-green" />
        <span className="flex-1 font-display text-[15px] font-semibold text-ink">How custom domains work</span>
        <Icon name={open ? 'expand_less' : 'expand_more'} size={20} className="text-green" />
      </button>
      {open && (
        <ol className="mt-3 space-y-2 text-[13px] text-ink-soft">
          <li><strong>1. Add the domain</strong> the cooperative wants (e.g. <span className="font-mono">my.unitycoop.ng</span>).</li>
          <li><strong>2. Point it to us:</strong> in their domain provider (GoDaddy, Namecheap, Whogohost…), add the <span className="font-mono">CNAME</span> record we show for that domain.</li>
          <li><strong>3. Verify:</strong> once DNS propagates (minutes to a few hours), click <strong>Verify</strong>. We confirm the record and issue an HTTPS certificate automatically.</li>
          <li><strong>4. Done:</strong> members can now reach their cooperative on its own branded web address.</li>
        </ol>
      )}
    </Card>
  )
}

function DomainSetupCard({ domain }: { domain: Domain }) {
  const { action, remove, update } = useDomainsCrud()
  const toast = useToast()
  const verified = domain.dns_status === 'verified'

  async function verify() {
    try {
      await action.mutateAsync({ id: domain.id, action: 'verify' })
      toast(`${domain.domain} verified — HTTPS issued`)
    } catch (err) {
      toast(apiErrorMessage(err, 'Verification failed — check the DNS record'), 'error')
    }
  }

  return (
    <div className="rounded-card border border-line bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Icon name="language" size={20} className="text-muted-2" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium text-ink">{domain.domain}</span>
              {domain.is_primary && <Badge tone="green">Primary</Badge>}
            </div>
            <div className="text-xs text-muted-2">{domain.cooperative_name}</div>
          </div>
        </div>
        <button onClick={() => remove.mutate(domain.id)} className="text-muted-2 transition hover:text-danger" title="Remove domain">
          <Icon name="delete" size={18} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
        <span className="flex items-center gap-1.5" title={DNS_MEANING[domain.dns_status]}>
          <Badge tone={verified ? 'green' : domain.dns_status === 'failed' ? 'danger' : 'gold'} dot>DNS: {domain.dns_status}</Badge>
        </span>
        <span className="flex items-center gap-1.5" title={SSL_MEANING[domain.ssl_status]}>
          <Badge tone={domain.ssl_status === 'issued' ? 'green' : domain.ssl_status === 'failed' ? 'danger' : 'gold'} dot>SSL: {domain.ssl_status}</Badge>
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted">{DNS_MEANING[domain.dns_status]}</p>

      {!verified && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-ink-soft">Add this DNS record at the cooperative's domain provider:</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Copyable label="Type" value={domain.verification.record_type} />
            <Copyable label="Host / Name" value={domain.verification.host} />
            <Copyable label="Points to (target)" value={domain.verification.target} />
          </div>
          <p className="text-xs text-muted-2">{domain.verification.instructions}</p>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {!verified && (
          <Button size="sm" icon="verified" onClick={verify} loading={action.isPending && action.variables?.id === domain.id}>
            Verify DNS
          </Button>
        )}
        {!domain.is_primary && (
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              try {
                await update.mutateAsync({ id: domain.id, is_primary: true })
                toast('Set as primary domain')
              } catch (err) {
                toast(apiErrorMessage(err, 'Could not set primary'), 'error')
              }
            }}
          >
            Make primary
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Full white-label domain manager. When `cooperativeId` is given it is scoped to
 * that tenant (Configuration tab); otherwise it spans all coops (White-label page)
 * and the add form includes a searchable cooperative picker.
 */
export function DomainManager({ cooperativeId }: { cooperativeId?: number }) {
  const { data: allDomains = [] } = useDomains()
  const { data: reference } = useReference()
  const { create } = useDomainsCrud()
  const toast = useToast()
  const [pickCoop, setPickCoop] = useState<number | null>(null)
  const [domain, setDomain] = useState('')

  const domains = cooperativeId
    ? allDomains.filter((d) => d.cooperative === cooperativeId)
    : allDomains

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const coop = cooperativeId ?? pickCoop
    if (!coop) {
      toast('Select a cooperative', 'error')
      return
    }
    if (!domain.trim()) return
    try {
      await create.mutateAsync({
        cooperative: coop,
        domain: domain.trim().toLowerCase(),
        is_primary: domains.filter((d) => d.cooperative === coop).length === 0,
      })
      toast('Domain added — now add the DNS record and verify')
      setDomain('')
      setPickCoop(null)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not add domain'), 'error')
    }
  }

  return (
    <div className="space-y-4">
      <HowItWorks />

      <Card>
        <CardHeader
          title="Add a custom domain"
          subtitle={`Point it at ${reference?.white_label.cname_target ?? 'our platform'} to go live`}
        />
        <form onSubmit={add} className="space-y-3">
          {!cooperativeId && (
            <Field
              label="Cooperative"
              // The picker renders a list of buttons, which must not sit inside
              // a label element: Safari forwards their taps to the search input
              // instead. It selects on onMouseDown to dodge that; with the
              // wrapper fixed, onClick would work, and keyboard users with it.
              interactive
            >
              <CooperativeSearchSelect value={pickCoop} onChange={setPickCoop} />
            </Field>
          )}
          <div className="flex gap-2">
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="input flex-1"
              placeholder="my.cooperative.ng"
            />
            <Button type="submit" icon="add_link" size="md" loading={create.isPending}>Add</Button>
          </div>
        </form>
      </Card>

      {domains.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Avatar name="?" size={40} />
            <p className="text-sm font-medium text-ink">No custom domains yet</p>
            <p className="max-w-md text-[13px] text-muted">
              Add a domain above. We'll show the exact DNS record to copy into the cooperative's
              domain provider — no technical knowledge needed. Until then, members use the default
              CooperativeOS address.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {domains.map((d) => (
            <DomainSetupCard key={d.id} domain={d} />
          ))}
        </div>
      )}
    </div>
  )
}
