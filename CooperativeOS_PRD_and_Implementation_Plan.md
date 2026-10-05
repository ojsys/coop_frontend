# CooperativeOS — Product Requirements Document & Implementation Plan

**Product:** CooperativeOS
**Owner:** Startup Ripple
**Document type:** PRD + Implementation Plan
**Version:** 1.0 (Draft)
**Status:** For internal review
**Author:** Jonah Onah
**Date:** June 2026

> **Source basis:** This document operationalises the *CooperativeOS Business Case Analysis*. The business case answers *why* and *how big*; this document answers *what we build*, *how it behaves*, and *in what order we ship it*.

---

## Part A — Product Requirements Document

### 1. Overview

CooperativeOS is a multi-tenant SaaS platform that gives African cooperatives a digital operating layer for membership, contributions/savings, governance, financial reporting, and member communication. Each cooperative is an isolated tenant; members access their own records through a mobile-first portal; leaders run administration from a web console.

**Core product principle — "ledger first, custodian only on request":** CooperativeOS is the *system of record* for cooperative finances. Collections move through licensed Payment Service Providers (Paystack / Flutterwave) into each cooperative's **own** bank account; CooperativeOS records, reconciles and reports on those movements, and collected money never passes through the platform. This is both an engineering decision (auditability via double-entry) and a regulatory one (see §10).

The single, deliberate exception is the **disbursement wallet**: a society that wants to pay loans out electronically funds a float with the platform, because an outbound transfer can only draw on a balance held at the PSP. That float is the society's own money — visible, toppable-up and withdrawable on demand — and a society that does not lend electronically never funds one. Holding it is nevertheless a custodial activity and carries licensing obligations; §10 must be read with that in mind.

### 2. Goals and Non-Goals

**Goals (first 12 months)**
- Replace manual member registers, contribution books, and paper reporting for small/medium cooperatives (50–5,000 members).
- Give every member self-service visibility into their own contributions, savings, and statements.
- Give leaders a reconciled, audit-ready financial picture with minimal manual bookkeeping.
- Be usable by low-digital-literacy members (PWA + SMS/USSD fallbacks, plain-language UI).
- Establish recurring subscription revenue per the business-case pricing tiers.

**Non-Goals (explicitly out of scope for V1)**
- Holding or pooling member funds in a platform-owned wallet.
- Acting as a lender, microfinance bank, or deposit-taking institution.
- The marketplace and community-investment layers (Phase 3+ — see roadmap).
- Full double-entry accounting suite replacement (we produce statements and audit trails, not a general ledger competitor to QuickBooks).

### 3. Success Metrics (KPIs)

| Category | Metric | V1 Target |
|---|---|---|
| Adoption | Paying cooperatives onboarded | 50 (Year 1) |
| Activation | % of onboarded coops with ≥1 reconciled contribution cycle | ≥ 80% |
| Member reach | Member-portal monthly active users / total members | ≥ 40% |
| Financial integrity | Reconciliation accuracy (matched PSP-to-ledger) | ≥ 99.5% |
| Operational | Median time-to-onboard a cooperative (data + training) | ≤ 5 working days |
| Retention | 12-month cooperative logo retention | ≥ 85% |
| Trust | Member-reported "I can see my contributions" (survey) | ≥ 90% agree |

### 4. Personas and Roles

| Persona | Role in product | Primary needs |
|---|---|---|
| **Cooperative Admin / Secretary** | Tenant administrator | Onboard members, configure contribution types, run reports, manage meetings |
| **Treasurer / Financial Secretary** | Finance role | Record/reconcile contributions, generate statements, view dashboards |
| **Chairperson / Executive** | Governance role | Approve resolutions, oversee voting, view performance dashboards |
| **Member** | End user | See own contributions/savings, get statements, vote, receive announcements |
| **Field/Onboarding Officer (Startup Ripple)** | Platform-side | Assisted onboarding, data migration, training |
| **Platform Super-Admin (Startup Ripple)** | Internal | Tenant provisioning, billing, support, health monitoring |
| **Regulator / Auditor (read-only, future)** | External oversight | Compliance and audit-readiness views |

RBAC is role-based and **scoped per tenant** — a user's permissions never cross cooperative boundaries.

### 5. User Stories (representative, by module)

**Membership**
- As an Admin, I can register a member with name, phone, ID, and share capital, so the register is digital and searchable.
- As a Member, I can complete digital onboarding from my phone via an invite link or USSD code.

**Contributions & Savings**
- As a Treasurer, I can record a contribution (cash, transfer, or PSP) against a member and contribution type, and the member's balance updates immediately.
- As a Member, I can view a dated statement of all my contributions and savings and download it as PDF.
- As a Treasurer, I can reconcile a batch of PSP settlements against expected contributions and see unmatched items flagged.

**Governance**
- As a Chairperson, I can schedule a meeting, attach an agenda, and record attendance and resolutions.
- As a Member, I can cast a vote on a resolution within a voting window and see results after close.

**Reporting & Communication**
- As an Admin, I can generate a financial summary dashboard for a period and export it.
- As an Admin, I can broadcast an announcement to all members via in-app, SMS, and/or email.

### 6. Functional Requirements (by module)

#### 6.1 Cooperative & Member Management
- Tenant (cooperative) profile: name, registration number, type, state/LGA, base currency, branding.
- Member CRUD with bulk CSV/Excel import (for migration) and validation.
- Digital onboarding via invite link, QR, or USSD short code.
- Member statuses: prospective, active, suspended, exited; with effective dates.
- Share-capital tracking per member.

#### 6.2 Savings & Contributions (Ledger core)
- Configurable **contribution types** (e.g., monthly dues, building fund, target savings) with frequency and expected amount.
- **Append-only double-entry ledger**: every posting writes immutable debit/credit entries; balances are *derived*, never edited in place. Corrections are made by reversing entries, preserving the audit trail.
- Record contributions via: manual entry (cash), bank-transfer confirmation, or PSP webhook (Paystack/Flutterwave).
- Per-member and per-coop statements (on-screen + PDF), filterable by period and type.
- Arrears tracking and contribution-status indicators.

#### 6.3 Payments & Reconciliation
- PSP integration (Paystack + Flutterwave) for inbound collections into the **cooperative's own** settlement account/subaccount.
- Webhook ingestion with idempotency and signature verification.
- Reconciliation engine: match settlements ↔ expected contributions; surface unmatched/partial/duplicate items for manual resolution.
- Multi-currency support (display + base-currency normalisation) consistent with prior Startup Ripple builds.

#### 6.4 Governance
- Meeting scheduling, agenda, attendance capture (incl. proxy attendance).
- Resolution lifecycle: draft → open for vote → closed → recorded.
- Voting: one-member-one-vote (configurable to weighted by share capital), with eligibility checks, voting windows, and tamper-evident result logs.

#### 6.5 Financial Reporting & Audit
- Dashboards: total contributions, savings growth, arrears, membership trends, period comparisons.
- Standard reports: contribution summary, member statement, arrears report, period financials.
- Immutable **audit log** of all administrative and financial actions (who, what, when, before/after).
- Exports: PDF and Excel.

#### 6.6 Communication & Engagement
- Announcements (in-app) with optional fan-out to SMS, email, and WhatsApp/USSD.
- Transactional notifications (contribution received, statement ready, meeting reminder, vote open).
- Per-member channel preferences and opt-outs.

#### 6.7 Platform Administration (Startup Ripple internal)
- Tenant provisioning and lifecycle.
- Subscription/billing management mapped to pricing tiers.
- Support tooling, impersonation-with-consent for assisted onboarding, and tenant health metrics.

### 7. Non-Functional Requirements

| Area | Requirement |
|---|---|
| **Mobile-first** | Primary member experience is a responsive PWA; works on low-end Android and intermittent connectivity (offline read + queued writes). |
| **Low-connectivity reach** | SMS and USSD fallbacks for members without smartphones (via Termii / Africa's Talking). |
| **Performance** | Member-facing reads < 1.5s on 3G for typical pages; statements paginated. |
| **Availability** | 99.5% target for V1; graceful degradation when PSP/SMS providers are down. |
| **Security** | Encryption in transit (TLS) and at rest for PII/financial data; tenant data isolation enforced at the query layer; signed PSP webhooks; rate limiting; 2FA for admin/finance roles. |
| **Data protection** | NDPA 2023 compliance: lawful basis, data-subject rights, retention policy, breach process. |
| **Auditability** | All financial postings immutable; full audit log; reconciliation traceable end-to-end. |
| **Localisation** | Naira default; multi-currency; plain-language labels; future translation support for major Nigerian/African languages. |
| **Scalability** | A tenant must operate identically at 50 and 5,000 members (the business case's explicit scalability gap). |

### 8. System Architecture & Tech Stack

**Recommended stack (aligned to your existing toolchain):**
- **Backend:** Django 5.x + Django REST Framework (Python).
- **Frontend:** React 18 (admin console) + PWA member portal (React or progressive enhancement).
- **Database:** PostgreSQL (with row-level tenant scoping); PostGIS only if geo features are later needed.
- **Async/queue:** Celery + Redis for digests, reminders, reconciliation jobs, webhook processing.
- **Payments:** Paystack + Flutterwave SDKs.
- **Messaging:** Termii / Africa's Talking (SMS + USSD), SMTP (Brevo) for email, WhatsApp Business API (Phase 2+).
- **Deployment:** Docker on a VPS / cloud VM (recommended over cPanel/Passenger for this build, because Celery workers + Redis + webhook reliability are awkward under shared cPanel hosting). Keep cPanel as a fallback only for the smallest single-tenant pilots.

**Multi-tenancy approach:** Start with **shared schema + strict row-level tenant scoping** (a `cooperative_id` foreign key on every tenant-owned model, enforced via a base queryset/manager and middleware). This is the fastest path to MVP and is adequate for the target scale. Revisit `django-tenants` (schema-per-tenant) only if a large institutional client demands hard isolation.

**Key architectural decisions**
1. **Double-entry, append-only ledger** as the financial core — non-negotiable for trust and audit.
2. **PSP money lands in the cooperative's own account/subaccount** — platform never custodies funds.
3. **Idempotent webhook ingestion** — every PSP event processed exactly once.
4. **Derived balances** — never store a mutable "balance" field as source of truth.

### 9. Core Data Model (key entities)

```
Cooperative (tenant)
  ├─ id, name, reg_no, type, state, lga, base_currency, branding, status

User
  ├─ id, name, phone, email, national_id, auth credentials

Membership            # User ↔ Cooperative
  ├─ id, user_id, cooperative_id, member_no, role, status,
  │  share_capital, joined_at, exited_at

Role / Permission     # RBAC, scoped per cooperative

ContributionType
  ├─ id, cooperative_id, name, frequency, expected_amount, active

LedgerEntry           # append-only, double-entry
  ├─ id, cooperative_id, membership_id, account, debit, credit,
  │  currency, reference, posted_at, reversal_of (nullable)

Contribution          # business-level posting that creates ledger entries
  ├─ id, cooperative_id, membership_id, type_id, amount, channel,
  │  status, psp_reference, recorded_by, occurred_at

PaymentEvent          # raw PSP webhook record (idempotency key)
  ├─ id, provider, event_id, payload, processed, matched_contribution_id

Meeting / Agenda / Attendance / Resolution / Vote

Announcement / Notification / ChannelPreference

AuditLog              # immutable: actor, action, entity, before, after, at
```

### 10. Regulatory & Compliance Considerations

> **Not legal advice.** Cooperative and financial regulation in Nigeria is fact-specific and evolving; have a qualified Nigerian lawyer review the model before launch — particularly anything touching money movement. The notes below are to inform design, not to substitute for counsel.

- **Stay software-only on funds.** By design CooperativeOS records and reconciles but does not hold member funds. Routing collections into the **cooperative's own** PSP subaccount/bank account is what keeps the product clearly on the "infrastructure software" side and away from deposit-taking/BOFIA and securities exposure flagged in your risk section.
- **Cooperative law.** Cooperatives are governed under the Nigerian cooperative framework (federal Act and state cooperative laws); the platform supports compliance/reporting but does not register or regulate societies.
- **Data protection (NDPA 2023).** Treat member PII and financial records as regulated personal data: lawful basis, consent capture during onboarding, data-subject access/erasure handling, retention schedule, and a breach-response process.
- **AML/CFT.** If any future feature introduces custody or value transfer, SCUML registration and MLPPA 2022 obligations may be triggered — defer such features until reviewed. (Relevant background: your prior AML/CFT framework work.)
- **Audit trail as a compliance asset.** The immutable ledger + audit log directly support the "audit readiness" value proposition for regulators and development partners.

### 11. Risks & Mitigations (engineering view)

| Risk | Impact | Mitigation |
|---|---|---|
| Misreconciled or disputed balances erode trust | High | Append-only double-entry ledger; reconciliation engine; no in-place balance edits |
| Tenant data leakage across cooperatives | High | Enforced row-level scoping + tests that assert isolation on every endpoint |
| Low digital literacy → low adoption | High | PWA + SMS/USSD fallback, plain language, assisted onboarding, training |
| PSP/SMS provider downtime | Medium | Provider abstraction layer + retries + manual-entry fallback |
| Scope creep into custody/lending | High (regulatory) | Hard guardrail: V1 is record-and-reconcile only; legal review gates Phase 3 |
| Data migration errors from paper records | Medium | Validated bulk import, dry-run preview, reconciliation against opening balances |

### 12. Release Phasing (product view)

- **Phase 0 — Foundations:** infra, auth, multi-tenancy, RBAC, member DB.
- **Phase 1 — MVP (financial core):** member management, contribution types, double-entry ledger, PSP collection + reconciliation, statements, dashboards, announcements.
- **Phase 2 — Governance & reach:** meetings/voting/resolutions, loans/SACCO module (record-only), member PWA + offline, SMS/USSD, richer reporting/audit exports.
- **Phase 3 — Ecosystem:** marketplace, cooperative federations/multi-coop, institutional dashboards, investment layer (subject to legal review).

---

## Part B — Implementation Plan

### 13. Delivery Approach

Two-week sprints, trunk-based development, CI from day one, and a **pilot-led rollout**: build the MVP against 2–3 real friendly cooperatives so requirements are validated against actual registers and contribution cycles rather than assumptions. Field feedback gates each phase.

### 14. Team & Roles (lean startup configuration)

| Role | Responsibility | Notes |
|---|---|---|
| Product/Tech Lead | PRD ownership, architecture, code review | You |
| Backend Engineer(s) | Django/DRF, ledger, reconciliation, integrations | 1–2 |
| Frontend Engineer | React admin console + PWA member portal | 1 |
| Designer (part-time) | Mobile-first, plain-language, low-literacy UX | fractional |
| QA / Test (can be shared) | Test automation, financial-integrity tests, UAT | shared |
| Field/Onboarding Lead | Pilot recruitment, migration, training | Startup Ripple side |

### 15. Phased Roadmap & Sprint Breakdown

> Indicative timeline assuming a small team; compress/expand to your actual headcount.

#### Phase 0 — Foundations (Sprints 1–2, ~4 weeks)
- Repo, CI/CD, Dockerised dev + staging environments.
- Auth (email/phone + OTP), 2FA for privileged roles.
- Multi-tenancy: `cooperative_id` scoping, base manager/middleware, isolation tests.
- RBAC roles and permissions scaffold.
- Member & Cooperative models + bulk import (CSV/Excel) with validation.
- **Exit criteria:** a cooperative can be provisioned and its members imported and listed, fully isolated from other tenants.

#### Phase 1 — MVP Financial Core (Sprints 3–7, ~10 weeks)
- ContributionType configuration.
- **Double-entry ledger** with derived balances and reversal-based corrections.
- Manual contribution entry (cash) + bank-transfer confirmation.
- Paystack + Flutterwave inbound collection into coop subaccounts.
- Idempotent webhook ingestion + signature verification.
- Reconciliation engine with unmatched/partial/duplicate flagging.
- Member statements (screen + PDF) and core dashboards.
- Announcements (in-app + email via Brevo).
- **Exit criteria:** a pilot cooperative runs one full contribution cycle end-to-end with ≥99.5% reconciliation and members can view accurate statements.

#### Phase 2 — Governance & Reach (Sprints 8–12, ~10 weeks)
- Meetings, agendas, attendance, resolutions, voting (one-member-one-vote + optional weighted).
- Loans/SACCO module — **record-and-track only** (no platform-issued credit).
- Member PWA with offline read + queued writes.
- SMS + USSD onboarding/notifications (Termii / Africa's Talking).
- Arrears reporting, audit-log exports, Excel exports.
- **Exit criteria:** a cooperative runs a digital meeting with recorded vote, and non-smartphone members receive SMS/USSD notifications.

#### Phase 3 — Ecosystem (post-MVP, scoped after pilot learnings)
- Cooperative marketplace.
- Federations / multi-coop and institutional dashboards (NGOs, state agencies).
- Investment/community-ownership layer — **gated on legal review**.
- Advanced analytics and impact-measurement views for development partners.

### 16. Data Migration Plan (per cooperative)

1. Collect existing register + contribution records (paper/Excel).
2. Map to import template; validate (duplicates, missing IDs, malformed amounts).
3. Dry-run import to staging; produce reconciliation report against stated opening balances.
4. Cooperative leaders sign off on opening balances.
5. Production import; lock opening balances as the ledger's genesis entries.
6. Parallel run for one cycle (paper + system) before going system-only.

### 17. Testing & Quality Strategy

- **Unit tests** (pytest): models, ledger postings, permission scoping.
- **Financial-integrity tests:** assert debits == credits per posting, derived balances match expected, reversals never mutate originals.
- **Tenant-isolation tests:** every endpoint asserts no cross-cooperative data access.
- **Integration tests:** PSP webhook flows (incl. duplicate/out-of-order/late events), reconciliation matching.
- **UAT:** with pilot cooperatives each phase.
- **Security review** before handling live money: auth, webhook signatures, rate limits, PII encryption.

### 18. Deployment & Operations

- Dockerised services: web (Django/Gunicorn), worker (Celery), Redis, PostgreSQL (managed DB preferred), reverse proxy (Nginx/Caddy) with TLS.
- Environments: dev → staging → production; secrets via env vars (no secrets in repo), per your existing practice.
- Backups: automated daily PostgreSQL backups + tested restore; financial data retention per NDPA policy.
- Monitoring: uptime, error tracking (e.g., Sentry), webhook success/failure dashboards, reconciliation-exception alerts.
- Runbooks: PSP outage, SMS outage, webhook replay, manual reconciliation.

### 19. Pricing → Tier Mapping (from business case)

| Tier | Coop size | Monthly | Feature gating |
|---|---|---|---|
| Small | 50–500 | ₦5,000–₦15,000 | Membership, contributions/ledger, statements, announcements |
| Medium | 500–5,000 | ₦20,000–₦50,000 | + Governance, SMS/USSD, advanced reporting, audit exports |
| Large / Institutional | 5,000+ / federations | Custom | + Multi-coop, institutional dashboards, priority support, SLAs |
| Setup / onboarding | — | ₦50,000–₦500,000 one-off | Migration, training, customisation |

### 20. Definition of Done (MVP launch gate)

- ✅ A cooperative can be provisioned, migrated, and isolated.
- ✅ One full contribution cycle reconciles at ≥99.5%, money landing in the coop's own account.
- ✅ Members can self-serve accurate statements on a phone.
- ✅ Immutable audit log and ledger in place; no in-place balance edits possible.
- ✅ NDPA basics (consent, retention, access/erasure) implemented.
- ✅ 2FA on finance/admin roles; signed webhooks; tenant-isolation tests green.
- ✅ Legal review completed on the "no custody" model.

---

## Appendix — Open Questions to Resolve Before Build

1. **Voting model default:** one-member-one-vote, or weighted by share capital? (Affects governance schema.)
2. **PSP subaccount mechanics:** confirm Paystack/Flutterwave split/subaccount setup so funds settle to each coop's account, not a platform account.
3. **Loans module scope:** record-only ledger of externally-issued loans, or do some target SACCOs expect interest/schedule computation in V1?
4. **USSD priority:** is USSD a Phase 1 must-have for the pilot cohort, or can SMS-only suffice initially?
5. **Pilot cohort:** which 2–3 cooperatives validate the MVP, and what are their current record formats (for migration tooling)?
6. **Hosting decision:** VPS/cloud Docker (recommended) vs. cPanel for the very first pilots?
