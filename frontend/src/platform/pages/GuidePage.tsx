import { GuideLayout, Steps, Caution, type GuideSection } from '@/ui/GuideLayout'

/**
 * Operating guide for Startup Ripple staff.
 *
 * Written against the surface as it actually is — every screen named here
 * exists in PlatformShell's navigation. Keep the two in step when either
 * changes.
 */

const SECTIONS: GuideSection[] = [
  {
    id: 'orientation',
    title: 'What this surface is',
    icon: 'explore',
    keywords: 'overview start here tenant isolation surfaces console member',
    body: (
      <>
        <p>
          The platform console is Startup Ripple’s own workspace. It is the only
          surface that sees <strong>across every cooperative</strong> — the
          admin console sees one society, and the member portal sees one person.
        </p>
        <p>
          There are three surfaces in total. Which one you land on is decided by
          your account: platform admins land here, officers land in their
          society’s console, and ordinary members land in the member portal.
        </p>
      </>
    ),
  },
  {
    id: 'command-center',
    title: 'Command Center',
    icon: 'dashboard',
    keywords: 'dashboard mrr fleet overview home',
    body: (
      <p>
        The fleet view: societies by status, subscription revenue, and anything
        needing attention. Use it as the morning check — it surfaces problems
        (failed reconciliations, stalled onboardings, provider incidents)
        without you having to open each area.
      </p>
    ),
  },
  {
    id: 'onboarding',
    title: 'Bringing a society on board',
    icon: 'verified_user',
    keywords: 'onboarding signup trial verification kyc exco certificate registration live active pipeline migration',
    body: (
      <>
        <p>
          Societies sign themselves up. The public signup creates the society
          as <strong>Active</strong>, starts its free trial and signs the
          founder into the console as <strong>Chairperson</strong> — nobody on
          the team needs to do anything for it to start keeping its books.
        </p>
        <p>
          What still needs a person is <strong>verification</strong> (its
          KYC). Until it is approved the platform moves no money for the
          society: no online contributions or loan repayments, no settlement
          account, no wallet top-ups and no electronic loan payouts. Cash and
          bank-transfer records work as normal.
        </p>
        <Steps
          items={[
            <>The society's Chairperson uploads a means of ID. A Secretary and Treasurer are optional, since some societies are run by one person; if they are appointed, their IDs show here too.</>,
            <>An officer uploads the certificate of registration and sends it for review. It arrives in <strong>Verification</strong>, and the team is emailed.</>,
            <>Check the IDs match the names and the certificate matches the society. <strong>Approve</strong>, or <strong>Request changes</strong> with a note the officers will read.</>,
          ]}
        />
        <Caution>
          Only <strong>verified</strong> societies appear in the public society
          search. An unverified one can still bring members in through its own
          invite link. If a pilot says “our members can’t find us”, check its
          verification first.
        </Caution>
        <p>
          <strong>Assisted onboarding</strong> is for societies that want help
          migrating their records. It tracks Discovery → Data migration →
          Parallel run → Go-live, but it no longer switches anything on: the
          society is already live.
        </p>
      </>
    ),
  },
  {
    id: 'cooperatives',
    title: 'Cooperatives',
    icon: 'apartment',
    keywords: 'directory suspend reactivate offboard impersonate tenant detail',
    body: (
      <>
        <p>
          The directory of every society, with a detail page per society showing
          its members, plan and activity. Lifecycle actions —{' '}
          <strong>suspend</strong>, <strong>reactivate</strong> and{' '}
          <strong>offboard</strong> — are platform-only and audited.
        </p>
        <p>
          Impersonation lets you see a society’s console as its officers do,
          which is the fastest way to answer a support question. It is recorded,
          and a banner shows while it is active.
        </p>
        <Caution>
          Suspending a society stops it being messaged and hides it from the
          public search. Use it for non-payment or a compliance hold — not as a
          way to pause a conversation.
        </Caution>
      </>
    ),
  },
  {
    id: 'billing',
    title: 'Billing',
    icon: 'receipt_long',
    keywords: 'plans pricing subscriptions invoices mrr tiers',
    body: (
      <>
        <p>
          Plans, subscriptions and invoices. A plan carries a monthly price and
          a member band; a subscription ties one society to one plan.
        </p>
        <p>
          The pricing shown on the public website is served{' '}
          <strong>live from these rows</strong> — only plans marked active
          appear, cheapest first. Change a price here and the site follows with
          no deploy. If the pricing section shows “talk to us”, it means there
          are no active plans.
        </p>
      </>
    ),
  },
  {
    id: 'white-label',
    title: 'White-label domains',
    icon: 'palette',
    keywords: 'domain dns ssl custom cname branding',
    body: (
      <p>
        Societies can reach the platform on their own domain. Add the domain,
        have them point a CNAME at the target shown, then watch the DNS and SSL
        status move to verified. Until both are verified, the domain will not
        serve.
      </p>
    ),
  },
  {
    id: 'platform-settings',
    title: 'Platform Settings',
    icon: 'settings',
    keywords: 'branding logo favicon templates team compliance support email',
    body: (
      <>
        <p>Five tabs, and two of them matter more than people expect:</p>
        <Steps
          items={[
            <><strong>Branding</strong> — your logo and favicon appear on the public site, the sign-in page and outgoing email. The support address here receives every “get in touch” from the website, so make sure it is a real inbox.</>,
            <><strong>Plans &amp; pricing</strong> — drives the public pricing section, as above.</>,
            <><strong>Templates</strong> — editable message templates with <code>{'{{placeholders}}'}</code>.</>,
            <><strong>Team</strong> — who at Startup Ripple has access, and in what role.</>,
            <><strong>Compliance &amp; data</strong> — exports for regulatory requests.</>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'health',
    title: 'System Health',
    icon: 'monitor_heart',
    keywords: 'incidents providers uptime latency paystack sms status',
    body: (
      <p>
        Health of the third parties the platform depends on — payments, SMS,
        email — with a latency history and a log of incidents. When several
        societies report the same failure at once, look here before looking at
        their data.
      </p>
    ),
  },
  {
    id: 'django-admin',
    title: 'The Django admin',
    icon: 'shield_person',
    keywords: 'admin backend superuser 2fa two factor append-only reversal ledger',
    body: (
      <>
        <p>
          At <code>/admin/</code> there is a second, lower-level interface for
          data the console does not expose. Entry is restricted to platform
          admins — ordinary staff accounts cannot open it, because it reads
          across every tenant.
        </p>
        <Steps
          items={[
            <><strong>Two-factor is required to change anything financial.</strong> Contributions, loans, dividends, ledger accounts and memberships are read-only until your account has 2FA enabled (Users → your account → Permissions).</>,
            <><strong>Ledger records cannot be edited.</strong> Journals, ledger entries, votes and audit entries are append-only by design. Correct a posting with the “Post reversing entries” action, which writes a mirror entry and leaves the original visible.</>,
            <><strong>Member data is regulated.</strong> National ID, date of birth, address and bank details sit in collapsed “Sensitive (NDPA)” sections. Treat access as auditable, because it is.</>,
          ]}
        />
        <Caution>
          Never “fix” a wrong figure by editing a row. Every balance in the
          product is derived from the ledger — editing around it makes the
          statements and the accounts disagree, silently.
        </Caution>
      </>
    ),
  },
  {
    id: 'operations',
    title: 'Running the service',
    icon: 'terminal',
    keywords: 'logs errors cron reminders deploy email brevo smtp troubleshooting',
    body: (
      <>
        <p>
          <strong>Errors.</strong> Every API failure — including validation
          rejections that never reach a traceback — is logged with the request
          path, status, user and reason. On the server:{' '}
          <code>tail -f ~/coop/logs/app.log</code>. If a member reports
          something failing, that file usually names the cause outright.
        </p>
        <p>
          <strong>Scheduled reminders.</strong> Arrears and meeting reminders
          are sent by a daily cron job running{' '}
          <code>manage.py send_reminders</code>. Only active societies are
          contacted. Run it with <code>--dry-run</code> to see who would be
          reached without sending anything.
        </p>
        <p>
          <strong>Email.</strong> Outgoing mail goes through Brevo. If mail
          stops arriving, check that the sending address is on a sender domain
          Brevo has validated — a rejection appears in the log rather than
          failing silently.
        </p>
      </>
    ),
  },
]

export function GuidePage() {
  return (
    <GuideLayout
      title="Staff Guide"
      subtitle="How to run CooperativeOS — onboarding, billing, support and operations"
      intro={
        <>
          This guide covers the platform surface. Everything here spans all
          societies, so treat changes with more care than you would inside a
          single society’s console. If you are helping an officer with their own
          screens, the matching guide is in their console under{' '}
          <strong>Guide</strong>.
        </>
      }
      sections={SECTIONS}
    />
  )
}
