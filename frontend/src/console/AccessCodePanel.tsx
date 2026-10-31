import { useIssueAccessCode, type IssuedAccessCode } from '@/api/mutations'
import type { Member } from '@/api/types'
import { apiErrorMessage } from '@/lib/apiError'
import { dateTime, phone } from '@/lib/format'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { useToast } from '@/ui/toast'

/**
 * Give a member a one-time access code to choose their password.
 *
 * For people with no email, who cannot be sent a set-password or reset link.
 * The code is shown here once; the officer reads it out or writes it down,
 * and the member enters it with their phone in the app or at /access-code.
 */
export function AccessCodePanel({
  member,
  compact = false,
}: {
  member: Pick<Member, 'id' | 'full_name' | 'email' | 'has_password'>
  /** Just the button and, once issued, the code: for tight spaces. */
  compact?: boolean
}) {
  const issue = useIssueAccessCode()
  const toast = useToast()
  const first = member.full_name.split(' ')[0]

  async function run() {
    try {
      await issue.mutateAsync(member.id)
    } catch (err) {
      toast(apiErrorMessage(err, 'Could not issue an access code'), 'error')
    }
  }

  if (issue.data) return <IssuedCode issued={issue.data} name={first} />

  const why = member.has_password === false
    ? `${first} hasn't chosen a password yet${member.email ? '' : ' and has no email for a link'}.`
    : member.email
      ? `If ${first} forgets their password, they can reset it by email, or use a code.`
      : `If ${first} forgets their password, a code lets them choose a new one.`

  return (
    <div className={compact ? '' : 'rounded-lg border border-line bg-paper p-3.5'}>
      {!compact && (
        <div className="mb-2.5 flex items-start gap-2 text-[13px] text-muted">
          <Icon name="key" size={18} className="mt-px shrink-0 text-muted-2" />
          <span>{why}</span>
        </div>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon="key"
        loading={issue.isPending}
        onClick={run}
        className={compact ? 'w-full' : ''}
      >
        Issue access code
      </Button>
    </div>
  )
}

function IssuedCode({ issued, name }: { issued: IssuedAccessCode; name: string }) {
  const spaced = `${issued.code.slice(0, 4)} ${issued.code.slice(4)}`
  return (
    <div className="rounded-lg border border-gold bg-gold-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Access code for {name}
      </div>
      <div className="mt-1.5 select-all font-mono text-3xl font-semibold tracking-[0.15em] text-ink">
        {spaced}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
        Give this to {name} now; it won't be shown again. In the app, or at{' '}
        <span className="font-medium text-ink">{window.location.host}/access-code</span>,
        they enter <span className="font-medium text-ink">{phone(issued.sign_in_with)}</span>{' '}
        and this code, then choose a password.
      </p>
      <p className="mt-1.5 text-xs text-muted">
        Works once, until {dateTime(issued.expires_at)}. Issuing another cancels this one.
      </p>
    </div>
  )
}
