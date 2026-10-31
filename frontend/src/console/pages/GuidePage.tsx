import { GuideLayout, Steps, Caution, type GuideSection } from '@/ui/GuideLayout'

/**
 * Operating guide for cooperative officers.
 *
 * Written against the console as it actually is — every screen named here
 * exists in ConsoleShell's navigation. Keep the two in step when either
 * changes.
 */

const SECTIONS: GuideSection[] = [
  {
    id: 'start',
    title: 'Getting started',
    icon: 'explore',
    keywords: 'overview roles permissions officers secretary treasurer chairperson 2fa',
    body: (
      <>
        <p>
          This console runs <strong>your society only</strong>. You cannot see
          another society’s members or money, and they cannot see yours.
        </p>
        <p>
          What you can do depends on your role. Chairperson, Secretary and
          Treasurer are <em>privileged</em> roles: they can manage members,
          post to the ledger and decide approvals. Ordinary members see only
          their own records, in the member portal.
        </p>
        <Caution>
          Roles that touch money should have two-factor authentication enabled.
          If your society handles real contributions, treat that as required
          rather than optional.
        </Caution>
      </>
    ),
  },
  {
    id: 'members',
    title: 'Members',
    icon: 'group',
    keywords: 'register add member import csv kyc documents photo member number share capital phone no email access code password sign in',
    body: (
      <>
        <p>
          Your register. Each member has a member number unique to your society,
          assigned automatically in sequence when they are added, plus a role,
          share capital, and optionally a photo and KYC documents.
        </p>
        <Steps
          items={[
            <><strong>Add one at a time</strong> with “Add person”, using a phone number, an email, or both. Either one signs them in. Someone with an email is sent a link to set their own password; you never choose or send a password for them.</>,
            <><strong>No email?</strong> Most farmers and traders have only a phone. After adding them, give them an <strong>access code</strong>: eight digits, shown to you once, which they enter with their phone number in the app or on the sign-in page to choose a password. It works once, for 72 hours.</>,
            <><strong>Or import a CSV</strong> to bring a paper register across in bulk. Each row needs a phone or an email. Bulk import does <em>not</em> send welcome emails, so you can migrate quietly and invite people later.</>,
            <><strong>Open a member</strong> to see their statement, savings, loans and documents in one place.</>,
          ]}
        />
        <p>
          A member who forgets their password and has no email asks you for a
          new access code: open them, choose <strong>Edit</strong>, then{' '}
          <strong>Issue access code</strong>. Members marked “No password yet”
          have not signed in for the first time. Only the Chairperson can issue a
          code for another officer.
        </p>
        <Caution>
          Identity documents and dates of birth are regulated personal data
          under the NDPA. Upload only what your society genuinely needs, and
          remember every view is recorded in the audit log.
        </Caution>
      </>
    ),
  },
  {
    id: 'join-requests',
    title: 'Join requests',
    icon: 'person_add',
    keywords: 'applications approve decline admit new member self signup waiting',
    body: (
      <>
        <p>
          People who found your society on the public site and asked to be
          admitted. Nothing is created until you decide — an applicant has no
          account and no access while their request is waiting.
        </p>
        <Steps
          items={[
            <><strong>Admit</strong> — they get the next member number automatically, and only then are their account and membership created. Applicants choose a password when they ask, so they can sign in with their phone straight away. Anyone who didn’t is emailed a link to set one, or, with no email, you give them an access code.</>,
            <><strong>Decline</strong> — no account is created, and you can record a private reason. They are free to apply again later.</>,
          ]}
        />
        <p>
          Officers are emailed when a request arrives, so it does not depend on
          somebody remembering to check this screen.
        </p>
      </>
    ),
  },
  {
    id: 'contribution-types',
    title: 'Contribution types',
    icon: 'savings',
    keywords: 'dues levies target savings mandatory voluntary frequency gl account',
    body: (
      <p>
        What members pay into — monthly dues, a building fund, target savings.
        Each type has a frequency, an expected amount (or none, for “any
        amount”), and the ledger account it credits. Set these up before
        recording contributions, since every payment is recorded against a type.
      </p>
    ),
  },
  {
    id: 'ledger',
    title: 'Ledger & contributions',
    icon: 'account_balance',
    keywords: 'record payment double entry journal reversal correction cash transfer balance',
    body: (
      <>
        <p>
          Recording a contribution does two things at once: it notes the
          business event, and it posts a balanced double-entry journal. The
          member is emailed a receipt automatically.
        </p>
        <p>
          Balances are never stored — they are always summed from the ledger.
          That is why the figures on a statement and in the accounts cannot
          drift apart.
        </p>
        <Caution>
          <strong>Corrections are made by reversal, never by editing.</strong>{' '}
          Use “Void” on a contribution to post a mirror entry. The original
          stays visible, which is exactly what an auditor needs to see. Nothing
          in the ledger can be quietly changed — by anyone, including us.
        </Caution>
      </>
    ),
  },
  {
    id: 'reconciliation',
    title: 'Reconciliation',
    icon: 'sync_alt',
    keywords: 'paystack webhook settlement matched unmatched partial duplicate psp payment',
    body: (
      <>
        <p>
          Payments made online settle into <strong>your society’s own
          account</strong> and arrive here to be matched against the expected
          contribution. Most match automatically; the exceptions need a person.
        </p>
        <Steps
          items={[
            <><strong>Unmatched</strong> — money arrived with no expected contribution. Usually a member paying without starting from the app.</>,
            <><strong>Partial</strong> — the reference matched but the amount differs.</>,
            <><strong>Duplicate</strong> — a settlement for something already confirmed. Safe to ignore once checked.</>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'loans',
    title: 'Loans & credit',
    icon: 'request_quote',
    keywords: 'loan product apply approve disburse repayment schedule instalment arrears outstanding',
    body: (
      <>
        <p>
          Define loan products (rate, maximum, term), then take applications
          against them. A loan moves through pending → approved → disbursed →
          repaid.
        </p>
        <Steps
          items={[
            <><strong>Approve</strong> the application — this is a decision, not a payment.</>,
            <><strong>Disburse</strong> — this moves money and builds the repayment schedule.</>,
            <><strong>Record repayments</strong> as they arrive. Each one posts to the ledger, fills the earliest unpaid instalment first, and emails the member a receipt.</>,
          ]}
        />
        <p>
          Interest is flat: a one-off charge spread evenly across the term, so
          members repay a fixed amount each month.
        </p>
      </>
    ),
  },
  {
    id: 'approvals',
    title: 'Approvals',
    icon: 'fact_check',
    keywords: 'maker checker segregation duties two person authorise dual control',
    body: (
      <>
        <p>
          Sensitive actions — approving and disbursing loans, posting dividends
          — are submitted by one officer and approved by a{' '}
          <strong>different</strong> one. The person who submitted cannot
          approve their own request.
        </p>
        <p>
          Officers are emailed when something is waiting, because a control that
          depends on someone remembering to look is not a control.
        </p>
      </>
    ),
  },
  {
    id: 'governance',
    title: 'Governance',
    icon: 'how_to_vote',
    keywords: 'meetings attendance minutes resolutions voting proxy quorum agm',
    body: (
      <>
        <p>
          Schedule meetings, record attendance (including proxies), and put
          resolutions to a vote. Voting is one-member-one-vote by default, or
          weighted by share capital if a resolution opts in.
        </p>
        <p>
          Votes are permanent once cast. Each ballot stores the weight it was
          cast at, so a later change in someone’s shares cannot rewrite a past
          result. Members are reminded about meetings automatically.
        </p>
      </>
    ),
  },
  {
    id: 'dividends',
    title: 'Dividends',
    icon: 'paid',
    keywords: 'surplus distribution declaration allocation share capital pro rata rate approval reverse',
    body: (
      <>
        <p>
          The page shows how much surplus is available — income less expenses,
          less dividends already paid. A dividend can only come from that, never
          from members' savings or share capital.
        </p>
        <p>
          Declare one for a period either as a rate on share capital (say 10%)
          or as a fixed total shared in proportion to each member's shares. It
          is saved as a draft: check the allocations, download them for the AGM
          if you need to, then send it for approval. A different officer
          approves it on the Approvals page, and only then is it added to each
          member's savings and each member told.
        </p>
        <p>
          A posted dividend is never deleted. If it was wrong, reverse it with a
          reason: the money comes back out of members' savings by a mirror entry,
          and members are told. Reversal is refused if a member has already
          withdrawn their dividend.
        </p>
      </>
    ),
  },
  {
    id: 'reports',
    title: 'Reports & audit',
    icon: 'summarize',
    keywords: 'statement pdf arrears export csv audit log trail financials',
    body: (
      <>
        <p>
          Member statements as PDFs (carrying your society’s logo), arrears
          reports, CSV exports and the audit log — who did what, when, and what
          changed.
        </p>
        <p>
          The audit log cannot be edited or deleted by anyone. That is the point
          of it: it is evidence for your members, your auditor and your
          regulator.
        </p>
      </>
    ),
  },
  {
    id: 'announcements',
    title: 'Announcements',
    icon: 'campaign',
    keywords: 'broadcast message email sms whatsapp opt out channels notify',
    body: (
      <p>
        Send a message to all members or to one role, across in-app, email and
        SMS. Members who have opted out of a channel are skipped automatically —
        in-app always reaches them. The reach figure afterwards tells you how
        many were actually contacted.
      </p>
    ),
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: 'settings',
    keywords: 'society profile branding logo favicon contact statement footer bank account roles payment provider',
    body: (
      <>
        <p>Where your society is configured:</p>
        <Steps
          items={[
            <><strong>Society profile</strong> — name, type, location, and the bank account shown to members paying by transfer.</>,
            <><strong>Branding</strong> — your logo and favicon. Once uploaded they appear in this console, in the member app and at the top of PDF statements. PNG, JPG or WebP; SVG is not supported.</>,
            <><strong>Contact details</strong> — printed at the foot of statements, so members know how to reach you.</>,
            <><strong>Roles</strong> — which permissions each role carries.</>,
            <><strong>Payment provider</strong> — the settlement account collections arrive in.</>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'money',
    title: 'How money actually works here',
    icon: 'verified_user',
    keywords: 'custodian funds safety wallet float security trust ledger disbursement withdraw',
    body: (
      <>
        <p>
          <strong>Your members’ contributions never pass through us.</strong>{' '}
          They settle through a licensed provider directly into your society’s
          own bank account. This system records, reconciles and reports on those
          movements — for collections it is the book, not the vault.
        </p>
        <p>
          There is one exception, and it is worth understanding before you
          explain it to members. If you want to pay loans out electronically,
          you fund a <strong>disbursement wallet</strong> — money you move from
          your own account to ours, on purpose, so that approving a loan can
          send it straight to the member’s bank. That float is the only money we
          ever hold. It stays yours: you can see the balance, top it up, and
          withdraw it back to your own account whenever you want.
        </p>
        <p>
          So: contributions are never ours to lose. A lending float is ours to
          hold only for as long as you choose to leave it with us — and if you
          never lend electronically, you never fund one, and we never hold a
          naira of yours.
        </p>
      </>
    ),
  },
]

export function GuidePage() {
  return (
    <GuideLayout
      title="Guide"
      subtitle="How to run your society on CooperativeOS"
      intro={
        <>
          A reference for officers. Search above, or work through it once in
          order — the sections follow the menu on the left. Anything involving
          money is designed so that mistakes are <em>correctable</em> rather
          than hidden, which is why nothing in the ledger can be edited.
        </>
      }
      sections={SECTIONS}
    />
  )
}
