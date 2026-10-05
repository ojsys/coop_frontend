import { Link } from 'react-router-dom'

/**
 * Public privacy notice at `/privacy`.
 *
 * Google Play requires a reachable privacy policy URL for any app collecting
 * personal or financial data, plus a documented route for account and data
 * deletion. This page is both.
 *
 * Every statement here is written from what the code actually does — each
 * category maps to a real model field, a real third-party call, or a real
 * client-side cache. Two consequences of that discipline worth preserving if
 * this page is edited:
 *
 *  - The security section claims only what is true. It previously stayed silent
 *    about uploaded documents because `/media/` was served without
 *    authentication; that is now gated behind signed, expiring URLs
 *    (see backend/core/media.py and DEPLOY_CPANEL.md), so the claim below is
 *    accurate. Do not re-broaden it beyond what the code enforces.
 *  - Nothing here is softened to sound better than the system behaves: votes
 *    are not anonymous to the society, the ledger cannot be erased, and
 *    platform staff can access a society's data. Members are entitled to know.
 *
 * This is a factual description, not legal advice. It needs review and sign-off
 * by someone qualified, and the NDPA references confirmed against current
 * guidance, before it is relied on.
 *
 * It is also the **fallback**. Once a `privacy` LegalDocument is published in
 * the Django admin that supersedes this page and this file stops rendering; it
 * exists so the /privacy URL registered with Google Play works before any
 * drafted policy has been pasted in. Keep it accurate until then — especially
 * "Money we hold", which is the only formal disclosure of the disbursement
 * float while the landing page deliberately does not mention it.
 */
export function PrivacyPage() {
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
          Privacy notice
        </h1>
        <p className="mt-2 text-[13px] text-muted-2">Last updated 3 October 2026</p>
        <p className="mt-4 text-[14px] leading-relaxed text-ink-soft">
          This notice covers the CooperativeOS website, the member web app and the
          CooperativeOS Android app. It describes what is collected, who can see
          it, what is kept on your own device, and how to have it deleted.
        </p>

        <Section title="Who is responsible for your data">
          <p>
            CooperativeOS is software operated by <strong>Startup Ripple</strong>. It is
            used by cooperative societies to run their membership, savings,
            contributions, loans and governance.
          </p>
          <p>
            The split matters for your rights.{' '}
            <strong>Your cooperative society decides</strong> what it collects about its
            members and why — it is the controller of those records. Startup
            Ripple provides and maintains the platform and processes that
            information on the society's instructions.
          </p>
          <p>
            So for anything about your own records — a copy, a correction, a
            deletion — <strong>start with your society's officers</strong>, because they
            control them. For anything about the platform itself, contact us at{' '}
            <a className="text-green hover:underline" href="mailto:info@mycooperativeos.com">
              info@mycooperativeos.com
            </a>
            .
          </p>
        </Section>

        <Section title="What we collect">
          <p>
            Only what the service needs. Most is entered by your society's
            officers when they register you, or by you in the app.
          </p>
          <DataTable
            rows={[
              ['Identity', 'Full name, email address, phone number, date of birth, gender, residential address, occupation, and a profile photograph if one is provided.'],
              ['Identification', 'A national identification number, and documents your society asks for: means of identification, passport photograph, proof of address, and the signed membership form.'],
              ['Next of kin', 'The name and phone number of the person you nominate.'],
              ['Bank details', 'Bank name and account number. Used to pay out your savings when you withdraw, and recorded against each payout so there is a lasting record of where money was sent.'],
              ['Financial records', 'Contributions, savings balances, share capital, loans and repayments, dividends, withdrawals, and the double-entry ledger entries behind them.'],
              ['Governance', 'Meeting attendance and how you voted on resolutions. Votes are recorded against your membership so that each member votes once — they are not anonymous to your society.'],
              ['Account security', 'A hashed password (never the password itself) and whether two-factor authentication is enabled.'],
              ['Technical', 'Pages visited, approximate device and browser information, and IP address, used to keep the service working and secure.'],
            ]}
          />
        </Section>

        <Section title="If you only applied to join">
          <p>
            When you ask to join a society through this site, we store your{' '}
            <strong>name, email address, phone number and the message you wrote</strong> so
            its officers can consider the request.
          </p>
          <p>
            No account is created for you at that point. One is created only if an
            officer approves you, and you are then emailed a link to set your own
            password. If your request is declined, the request and the officer's
            note are retained as a record of the decision. To have a declined or
            pending request deleted, email us at the address above.
          </p>
        </Section>

        <Section title="Why we use it">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>To run your membership: record contributions, compute savings and share capital, process loans, and pay dividends.</li>
            <li>To take payments and match them to the right member.</li>
            <li>To tell you about your own account — a payment received, a statement ready, a loan update, a withdrawal paid, a meeting, or a vote opening.</li>
            <li>To let your society's officers meet their record-keeping, audit and regulatory duties.</li>
            <li>To keep the service secure, investigate misuse, and maintain an audit trail of who did what.</li>
          </ul>
          <p>
            We do <strong>not</strong> sell your personal data, and we do not use it for
            advertising or share it with advertisers.
          </p>
        </Section>

        <Section title="Who else sees it">
          <DataTable
            rows={[
              ["Your society's officers", 'Officers of your own society see your membership record and financial history. What each can do depends on their role, sensitive actions need a second officer’s approval, and actions are logged. Societies are kept separate from one another: no society can see another’s members.'],
              ['Startup Ripple staff', 'Our staff can access a society’s data where needed to operate and support the platform. A staff member can also sign in as a user to diagnose a problem, but only with that society’s explicit consent, and every such action is written to the audit trail.'],
              ['Paystack', 'Our payment processor. When you pay, your name, email and the amount are sent to Paystack so the transaction can complete. Card details go to Paystack directly and never pass through our servers.'],
              ['Email delivery', 'An email delivery service sends account email — set-password links, receipts, reminders and notifications. It receives your name and email address.'],
              ['Google Analytics', 'Measures aggregate use of the website. It is configured to send the page path only, never the query string, and we do not send it your name, email or any identifier pointing to you. It can be switched off entirely by the platform administrator.'],
              ['Google Fonts', 'The website loads its typefaces from Google’s font servers, which means your IP address is visible to Google when a page loads.'],
              ['Hosting and backups', 'Our hosting provider stores the database and uploaded files on our behalf.'],
              ['When the law requires', 'We may disclose information where legally obliged, or to establish or defend a legal claim.'],
            ]}
          />
        </Section>

        <Section title="Money we hold">
          <p>
            Your contributions are not held by us. They settle through a
            licensed payment provider straight into your cooperative's own bank
            account, and we record and reconcile those movements.
          </p>
          <p>
            There is one exception. A society that wants to pay loans out
            electronically can deposit a <strong>disbursement float</strong>
            {' '}with us — money its officers move from the society's own
            account, deliberately, so that approving a loan can send it straight
            to the member's bank. That float is the only money we ever hold, and
            it remains the society's own: its officers can see the balance, add
            to it, and withdraw it back to the society's account at any time.
            We hold it only so that approved loans can be paid, and for no other
            purpose, and we do not pay interest on it.
          </p>
          <p>
            A society that does not lend electronically never funds one. If you
            want to know whether yours has, ask an officer — the balance and
            every movement in and out of it are visible to them.
          </p>
        </Section>

        <Section title="What is stored on your device">
          <p>
            Both apps keep data on your own device so they work on a poor
            connection. This stays on the device and is not visible to us.
          </p>
          <DataTable
            rows={[
              ['Sign-in details', 'Your access token, which society you are viewing, and a copy of your name and email, so you are not signed out between visits.'],
              ['Recently viewed data', 'Responses from the app — your savings, statement and open votes among them — are cached for up to 24 hours so those screens still open when you are offline.'],
              ['Payments you start offline', 'If you record a payment with no connection, it is queued on the device and sent when you are back online.'],
            ]}
          />
          <p>
            <strong>Signing out clears your sign-in details.</strong> To remove everything,
            clear site data for this site in your browser, or uninstall the
            Android app. Anyone with unlocked access to your device can see what
            is cached, so lock your phone and sign out on shared devices.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Membership and financial records are kept while you are a member and
            afterwards for as long as your society's obligations require —
            cooperative, tax and audit rules generally mean several years beyond
            the end of membership.
          </p>
          <p>
            Two things are worth being direct about. The{' '}
            <strong>financial ledger is append-only by design</strong>: an entry that is
            wrong is corrected by posting a reversing entry, never by deleting the
            original, because that is what makes the accounts auditable. And the{' '}
            <strong>audit trail records what changed</strong>, keeping before-and-after
            snapshots of edited records. Neither can be erased on request, even
            where other personal details can be.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Under the Nigeria Data Protection Act 2023 you can ask to see the
            personal data held about you, have inaccurate details corrected,
            object to particular uses, or ask for data to be deleted. Because your
            society controls the records, start with its officers; if you cannot
            resolve it there, contact us at{' '}
            <a className="text-green hover:underline" href="mailto:info@mycooperativeos.com">
              info@mycooperativeos.com
            </a>
            . You may also complain to the Nigeria Data Protection Commission.
          </p>
        </Section>

        <Section title="Deleting your account and your data">
          <p>You can ask for your account to be closed and your personal data deleted. There are two routes:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Ask an officer of your cooperative, who can exit your membership and
              remove personal details from your record.
            </li>
            <li>
              Email{' '}
              <a
                className="text-green hover:underline"
                href="mailto:info@mycooperativeos.com?subject=Account%20deletion%20request"
              >
                info@mycooperativeos.com
              </a>{' '}
              from the address on your account, with the subject
              "Account deletion request". We will verify you are the account
              holder and act within 30 days.
            </li>
          </ul>
          <p>
            <strong>Deleted:</strong> your sign-in credentials, contact details, date of
            birth, gender, address, occupation, next-of-kin details, bank details,
            profile photograph and uploaded documents.
          </p>
          <p>
            <strong>Retained, and why:</strong> ledger entries, contribution and loan
            history, and audit records. These are your society's financial
            accounts and are subject to its statutory record-keeping and audit
            duties. Where they must be kept, they are disassociated from your
            contact details as far as the accounts allow. If you have an
            outstanding loan or unpaid balance, records are kept until it is
            settled.
          </p>
          <p>
            Deleting the app from your phone does not delete your records — use
            one of the routes above.
          </p>
        </Section>

        <Section title="How we protect it">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>All traffic between the apps and our servers is encrypted in transit (HTTPS).</li>
            <li>Passwords are stored only as salted hashes, and are never emailed to you — we send a link so you set your own.</li>
            <li>What you can see and do follows your role in your society, and each society's records are isolated from every other society's.</li>
            <li>Your photograph and uploaded documents are not public. They are released only through a short-lived link issued to someone already entitled to view them, so a link that is forwarded or leaks stops working.</li>
            <li>Administrative and money-touching screens require two-factor authentication.</li>
            <li>Payouts and changes to a society's bank details need a second officer's approval — one person acting alone cannot move money out.</li>
            <li>Actions are written to an append-only audit trail.</li>
          </ul>
          <p>
            No service can promise perfect security. If a breach affects your
            personal data we will notify you and the regulator as required.
          </p>
        </Section>

        <Section title="Children">
          <p>
            The service is intended for adult members of cooperative societies and
            is not directed at children under 18. Where a society admits a minor,
            their records are entered and managed by its officers.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If this notice changes materially we will update the date above and,
            where the change affects you, tell you in the app or by email.
          </p>
        </Section>

        <div className="mt-10 border-t border-line pt-6 text-[13px] text-muted">
          Startup Ripple ·{' '}
          <a className="text-green hover:underline" href="mailto:info@mycooperativeos.com">
            info@mycooperativeos.com
          </a>
        </div>
      </main>
    </div>
  )
}

/**
 * Each section is directly linkable by a slug of its heading.
 *
 * This is not decoration: the Play Console is given
 * `/privacy#deleting-your-account-and-your-data` as the app's data-deletion
 * route, so that fragment has to resolve to the right section. Renaming a
 * heading changes its slug and silently breaks any URL pointing at it.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return (
    <section id={id} className="mt-8 scroll-mt-6">
      <h2 className="font-display text-[19px] font-semibold text-ink">{title}</h2>
      <div className="mt-2.5 space-y-3 text-[14px] leading-relaxed text-ink-soft">
        {children}
      </div>
    </section>
  )
}

function DataTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      {rows.map(([label, body]) => (
        <div
          key={label}
          className="grid gap-1 border-b border-line/60 px-4 py-3 last:border-0 sm:grid-cols-[10rem_1fr] sm:gap-4"
        >
          <div className="text-[13px] font-semibold text-ink">{label}</div>
          <div className="text-[14px] leading-relaxed text-ink-soft">{body}</div>
        </div>
      ))}
    </div>
  )
}
