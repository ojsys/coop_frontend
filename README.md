# CooperativeOS — Backend (Financial Core)

The system-of-record backend for CooperativeOS: a multi-tenant SaaS giving
African cooperatives a digital operating layer for membership, contributions,
and financial reporting.

This repository implements the **Phase 0 (Foundations), Phase 1 (Financial
Core), and most of Phase 2 (Governance & Reach)** backend from the PRD:

- **Multi-tenancy** — shared schema with strict row-level scoping. Every
  tenant-owned model carries a `cooperative` FK and is filtered automatically
  by a tenant-aware manager bound per request. Fail-closed: no tenant bound →
  no rows.
- **Identity & RBAC** — global `User`, per-cooperative `Role` (Chairperson /
  Secretary / Treasurer / Member) and `Membership`; permissions never cross
  cooperative boundaries.
- **Double-entry, append-only ledger** — the financial heart. Every posting is
  a balanced `Journal` of `LedgerEntry` lines (debits == credits); rows are
  immutable once written; corrections are made by posting a *reversing* entry;
  balances are always **derived**, never stored.
- **Contributions** — recording a contribution posts a balanced journal
  (`Dr settlement asset / Cr member funds`). Money is modelled as settling into
  the cooperative's **own** account — the platform never custodies funds.
- **PSP webhooks + reconciliation** — Paystack/Flutterwave webhooks are
  ingested idempotently (dedup on `provider + event_id`) with signature
  verification, routed to the right cooperative via its settlement subaccount,
  and reconciled against expected contributions — classifying each as
  `matched` / `unmatched` / `partial` / `duplicate` / `ignored`. A member's
  PSP payment is a PENDING contribution that a matched webhook confirms and
  posts to the ledger. Idempotency guarantees a replayed webhook never
  double-posts.
- **Governance & voting** — meetings, resolutions, and tamper-evident voting.
  Default one-member-one-vote, optionally weighted by share capital; votes are
  append-only, with eligibility (active member) and voting-window enforcement;
  tallies and outcomes are derived from the immutable ballots.
- **Communications** — announcements fanned out across in-app / email / SMS /
  WhatsApp respecting per-member channel preferences and opt-outs, plus
  transactional notifications.
- **Immutable audit log** — append-only who/what/when/before/after for financial
  and administrative actions (reversals, PSP ingestion, governance, broadcasts).
- **Reports & dashboards** — society dashboard (collections, savings, arrears,
  participation, 6-month trend, reconciliation), contribution summary, arrears
  report, and **PDF member statements** (reportlab).
- **REST API** (DRF, token auth) + a demo seed + a full test suite (49 tests)
  covering financial integrity, tenant isolation, ledger immutability, every
  reconciliation outcome, voting integrity, audit immutability, and reporting.

## Tech stack

Django 5.2 · Django REST Framework · SQLite (dev) / PostgreSQL (prod) · pytest.

## Quick start

The Django backend lives in `backend/` (alongside sibling `frontend/` and
`mobile/` apps). Run all backend commands from there:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo      # demo tenant + logins + data
.venv/bin/python manage.py runserver
```

Demo logins created by `seed_demo`:

| Who | Email | Password |
|---|---|---|
| Platform super-admin | `admin@startupripple.co` | `adminpass` |
| Cooperative Secretary | `secretary@imole.coop` | `coop1234` |

## Settings & environments

Settings live in a package split by environment, so it's always clear which
config is which:

| Module | Used for | Defaults |
|---|---|---|
| `config/settings/base.py` | Shared config (never selected directly) | apps, middleware, DRF, PSP keys |
| `config/settings/dev.py` | Local development | `DEBUG=True`, SQLite, console email, insecure dev key |
| `config/settings/prod.py` | Production | `DEBUG=False`, PostgreSQL, SMTP email, HSTS/secure cookies; **all secrets from env** |

Which module is loaded:

- `manage.py` and the test runner default to **`config.settings.dev`** — the
  quick start above needs no extra configuration.
- `config/wsgi.py` / `config/asgi.py` (what gunicorn/uvicorn import) default to
  **`config.settings.prod`**.
- Override anytime with `DJANGO_SETTINGS_MODULE=config.settings.prod`.

`prod` refuses to start unless the required environment variables are set:
`DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `POSTGRES_DB`, `POSTGRES_USER`,
`POSTGRES_PASSWORD` (plus optional `POSTGRES_HOST`/`POSTGRES_PORT`,
`CORS_ALLOWED_ORIGINS`, and `EMAIL_*`). See `.env.example`.

## API tour

```bash
# 1. Get a token
curl -s -X POST localhost:8000/api/v1/auth/token/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"secretary@imole.coop","password":"coop1234"}'

# 2. Use it (single-cooperative users have their tenant implied; multi-coop
#    users select one with the X-Cooperative-Id header)
TOKEN=...   ;   AUTH="Authorization: Token $TOKEN"

curl -s localhost:8000/api/v1/me/                   -H "$AUTH"
curl -s localhost:8000/api/v1/members/              -H "$AUTH"
curl -s localhost:8000/api/v1/members/2/statement/  -H "$AUTH"
curl -s localhost:8000/api/v1/accounts/             -H "$AUTH"   # derived balances
```

### Key endpoints (`/api/v1/`)

| Endpoint | Purpose |
|---|---|
| `POST auth/token/` | Obtain an auth token |
| `me/` | Current user profile |
| `cooperatives/` | Directory; `POST` provisions a tenant (platform admin only); `PATCH {id}/` edits the society profile (coop admin) |
| `members/` · `members/{id}/statement/` | Membership CRUD (create/edit/status) + dated statement |
| `roles/` | Role CRUD, scoped to the society (privileged members only) |
| `members/import/` | Bulk member CSV import (per-row error report) |
| `member-documents/` | KYC/supporting document upload per member (multipart) |
| `contribution-types/` | Configure what members pay into (create/edit/activate) |
| `ledger-entries/export/` · `contributions/export/` | CSV exports |
| `meetings/` · `attendances/` · `resolutions/` | Governance CRUD + minutes + attendance + voting |
| `reports/trial-balance/` · `income-statement/` · `balance-sheet/` | Financial statements from the ledger (+ `-csv`) |
| `reports/arrears-csv/` · `contribution-summary-csv/` · `send-arrears-reminders/` | Report exports + dues reminders |
| `savings-products/` · `savings-goals/` | Savings plans + per-member goals (ledger-derived progress) |
| `dividends/` · `dividends/{id}/post_to_ledger/` | Surplus distribution (pro-rata to share capital, posts journals) |
| `loan-products/` · `loans/` · `loans/{id}/{approve,reject,disburse,repay}/` | Loans & credit (ledger-posting) |
| `approvals/` · `approvals/{id}/{approve,reject}/` | Maker-checker for sensitive actions |
| `me/profile/` (GET/PATCH) · `me/documents/` | Member self-service: own profile/KYC + photo + documents (scoped to caller) |
| `me/loans/` (list + apply) · `me/savings-goals/` · `me/dividends/` | Member's own loans (apply→pending), savings goals (CRUD), dividend allocations |
| `me/loan-products/` · `me/savings-products/` | Read-only product catalogues for members |
| `contributions/record/` | Record a contribution (cash/manual) → posts a journal |
| `contributions/initiate/` | Start a PSP payment → PENDING, returns a reference |
| `contributions/{id}/reverse/` | Reverse a contribution (correction) |
| `accounts/` · `journals/` · `ledger-entries/` | The immutable ledger (read-only) |
| `provider-accounts/` | A coop's PSP settlement subaccounts |
| `webhooks/paystack/` · `webhooks/flutterwave/` | Inbound PSP webhooks (signature-verified) |
| `payment-events/` · `payment-events/summary/` | Settlements + reconciliation health |
| `payment-events/{id}/rematch/` | Re-run matching for an exception |
| `meetings/` · `resolutions/` | Governance; resolutions have `open/`, `close/`, `vote/`, `results/` |
| `announcements/` · `announcements/{id}/send/` | Broadcast across channels |
| `notifications/` | The member's in-app notifications |
| `audit-logs/` | Immutable audit trail (read-only) |
| `reports/dashboard/` · `reports/arrears/` · `reports/contribution-summary/` | Aggregations |
| `reports/statement-pdf/?membership=` | Download a member's PDF statement |

### Platform-admin endpoints (Startup Ripple · `is_platform_admin` only)

Cross-tenant operational surfaces backing the platform dashboard. Live in the
`platform_admin` app; none are tenant-scoped.

| Endpoint | Purpose |
|---|---|
| `cooperatives/{id}/suspend\|reactivate\|offboard/` | Tenant lifecycle (audit-logged) |
| `cooperatives/{id}/impersonate/` | Consent-gated, audit-logged support session (mints a token for a privileged official) |
| `cooperatives/{id}/health-check/` | Read-only per-tenant data diagnostics |
| `support-tickets/` · `support-tickets/{id}/close/` | Per-cooperative support ticket CRUD |
| `reference/` | Nigerian states + LGAs, cooperative types, white-label CNAME target |
| `plans/` | Subscription plan CRUD |
| `invoices/next-number/` | Auto-generated next `INV-YYYY-N` |
| `onboarding-items/{id}/advance/` | Advance stage; reaching Go-live activates the tenant |
| `domains/{id}/verify/` | Verify DNS/SSL; serializer exposes the exact CNAME record to add |
| `incidents/` · `{id}/resolve/` | Platform incident log (CRUD) |
| `provider-status/{id}/record/` | Append a latency/status sample (history) |
| `notification-templates/` · `{id}/preview/` | Editable email/SMS templates + sample-render preview |
| `platform/profile/` | Platform-owner profile & defaults (GET/PATCH singleton) |
| `platform/analytics/?months=` · `analytics/export/` | Revenue/growth/funnel/cohort analytics + CSV |
| `platform/fleet-health/` · `payment-monitor/` · `audit-stream/` | Cross-tenant health, payment monitor, audit feed |
| `platform/export/` | Cooperative directory CSV export |
| `subscriptions/` | Which plan each cooperative pays for (CRUD) |
| `invoices/` · `invoices/{id}/mark-paid/` | Billing documents (CRUD + settle) |
| `onboarding-items/` · `onboarding-items/{id}/advance/` | Onboarding pipeline (CRUD + stage machine) |
| `domains/` · `domains/{id}/verify/` | White-label custom domains (CRUD + DNS/SSL verify) |
| `provider-status/` | External provider health registry (CRUD) |
| `platform-team/` | Startup Ripple team members (CRUD; `invite_email` provisions an admin) |
| `platform/overview/` | Headline KPIs (live coops, members, MRR, reconciliation) |
| `platform/billing/` | MRR, outstanding/overdue, plan-tier breakdown |
| `platform/analytics/` | Feature adoption, churn watchlist, coops-by-state, NRR |
| `platform/attention/` | Actionable alerts (overdue invoices, pending DNS, churn, degraded providers) |
| `platform/health/` | Provider statuses + system metrics (from real payment data) |

Seed the platform-ops demo data (plans, billing, onboarding, domains, health,
team, plus extra cooperatives) with:

```bash
.venv/bin/python manage.py seed_platform   # also runs inside seed_demo
```

## Multi-tenancy model

`core/` holds the tenancy machinery:

- `context.py` — thread-local "active cooperative" + `use_tenant()` context
  manager (for commands, tasks, tests).
- `models.py` — `TenantScopedModel` base + `TenantManager` (scoped `objects`,
  unscoped `all_objects` escape hatch).
- `tenancy.py` / `middleware.py` / `views.py` — resolve the tenant from the
  authenticated user + `X-Cooperative-Id` header, bind it for the request
  (works for both session and DRF token auth), and always clear it afterward.

## Tests

```bash
cd backend
.venv/bin/python -m pytest
```

Covers (PRD §17): debits == credits per posting, derived balances, reversals
never mutate originals, append-only immutability, cross-cooperative isolation
at both the model and HTTP-API layers, and webhook idempotency / signature
verification / every reconciliation outcome.

## Frontend

The React client lives in [`frontend/`](frontend/) — one app, three surfaces
(Admin Console, Member PWA, Platform Command Center) sharing a design system and
this API. It reproduces the `CooperativeOS.html` design prototype. The member
surface is a responsive, installable PWA with offline read + sync-on-reconnect
writes. See [`frontend/README.md`](frontend/README.md) to run it alongside this
backend.

A native-app **Flutter spike** lives in [`mobile/`](mobile/) — a first member
slice against this same API, plus a PWA-vs-native decision doc
([`mobile/README.md`](mobile/README.md)).

## Payments (Paystack)

Money never touches the platform — it settles into each cooperative's **own**
Paystack subaccount. A member starts *and finishes* the payment in-app, and it
registers immediately (member app, admin console and platform all at once):

1. Member taps **Pay** → `POST contributions/initiate/` creates a PENDING
   contribution and calls Paystack **`/transaction/initialize`** (amount in kobo,
   the coop's `subaccount`, the contribution's `psp_reference`, and a
   `callback_url`), returning an `authorization_url`.
2. The client opens the **real Paystack checkout** — the on-page **Inline modal**
   on web (Paystack's own iframe; card/bank/USSD are entered inside it, never on
   our page), or an in-app **WebView** on mobile — and the member pays.
3. On return, the client calls `POST contributions/verify/` → Paystack
   **`/transaction/verify`** → on success **`confirm_contribution`** posts the
   balanced journal to the ledger **right away**, so the member sees their
   updated balance and the money is recorded platform-wide.
4. The signed **`charge.success`** webhook (`webhooks/paystack/`) is a backup:
   idempotent, it re-confirms nothing that's already posted.

**Going live:** copy `.env.example` → `.env`, add your Paystack **test** keys
(`PAYSTACK_SECRET_KEY=sk_test_…`), and restart the server. The real hosted
Paystack checkout then appears (redirect on web, in-app WebView on mobile) and
the balance updates **only after a genuine `/transaction/verify` success**. Keep
`PAYSTACK_USE_SUBACCOUNT=false` to test a plain charge; turn it on once real
subaccount codes are stored on `ProviderAccount`.

**Dev without a key:** a local **test checkout** stands in for Paystack — the
member still has to complete it before anything posts, so the whole flow (checkout
→ pay → verify → balance) is testable end-to-end with no credentials. If the key
is present but Paystack rejects a charge, the reason is surfaced to the member
(`payment_error`) instead of failing silently.

**Cash contributions** are different by design: there is no member self-service
checkout — the collection officer (Treasurer) records them from the console via
`contributions/record/`, which confirms and posts immediately. That's the
intended delay: whoever collects the cash registers it.

Configured via env (never commit live keys):

```bash
PAYSTACK_SECRET_KEY=sk_test_xxx      # dev default 'sk_test_dev' skips the live call
PAYSTACK_BASE_URL=https://api.paystack.co
PAYSTACK_CALLBACK_URL=https://your.app/paystack/return   # optional
```

To go live for a cooperative: set a real test/live secret key, and store the
coop's real Paystack **subaccount code** on its `ProviderAccount`. With the dev
placeholder key, `initiate` still creates the PENDING contribution and returns
`authorization_url: null` (confirm it manually via a simulated webhook in tests).

## Not yet built (next phases)

Live SMS/USSD delivery (Termii / Africa's Talking — currently stubbed behind a
provider interface), Celery/Redis for async digests & reminders, and the
remaining Phase 3 platform-analytics endpoints (churn-risk, cohort retention,
MAU/NRR, invoices, provider/system health) the frontend still renders from marked
sample data. Cross-tenant headline analytics are live via
`/api/v1/platform/overview/`. See `CooperativeOS_PRD_and_Implementation_Plan.md`.
