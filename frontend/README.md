# CooperativeOS — Frontend

React + TypeScript client for the CooperativeOS backend. One app, three surfaces,
one design system, all wired to the DRF API (`/api/v1`).

| Surface | Route | Who | What |
|---|---|---|---|
| **Admin Console** | `/console` | Cooperative officials (Chair / Secretary / Treasurer) | Society dashboard, members, ledger & contributions, contribution types, reconciliation, governance, reports & audit, announcements, settings |
| **Member App (PWA)** | `/app` | Every member | Savings, statement (+PDF), contribute (PSP), vote, announcements, profile |
| **Platform Command Center** | `/platform` | Startup Ripple super-admins | Cross-tenant overview, cooperatives directory + detail, provisioning wizard, billing, white-label, onboarding, analytics, system health, settings |

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 (custom `@theme`) · React Router ·
TanStack Query · axios · Recharts. Fonts: Bricolage Grotesque / Hanken Grotesk /
IBM Plex Mono; Material Symbols Rounded icons.

## Run it (with the backend)

```bash
# 1. Backend on :8000  (from the repo root)
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo
.venv/bin/python manage.py runserver

# 2. Frontend on :5173  (this directory)
npm install
npm run dev
```

Vite proxies `/api` → `http://localhost:8000`, so the browser makes same-origin
requests and the token + `X-Cooperative-Id` headers flow straight through.

Open http://localhost:5173 and sign in with a seeded account:

| Who | Email | Password | Lands on |
|---|---|---|---|
| Cooperative Secretary | `secretary@imole.coop` | `coop1234` | `/console` |
| Platform Super-Admin | `admin@startupripple.co` | `adminpass` | `/platform` |

The landing surface is chosen from the enriched `/me/` response: platform admins →
`/platform`; anyone holding an official role → `/console`; plain members → `/app`.
Multi-cooperative users get a society switcher in the header that swaps the active
`X-Cooperative-Id`.

## Architecture

```
src/
  api/         axios client (token + tenant interceptors), typed hooks, mutations
  auth/        AuthContext, route guards, login
  ui/          shared design-system primitives (Card, StatTile, Table, Charts, …)
  lib/         formatting (naira, dates, statement math)
  console/     Surface 1 — Admin Console (shell + pages)
  member/      Surface 2 — Member App (phone shell + pages)
  platform/    Surface 3 — Platform Command Center (shell + pages + mockData)
```

Design tokens live in `src/theme.css` (`--color-green`, `--color-gold`,
`--radius-card`, fonts, …) — feature code never hard-codes hex.

## Sample vs. live data

Every screen is wired to a real endpoint where one exists. The platform surface
is backed by a real cross-tenant aggregation endpoint
(`GET /api/v1/platform/overview/`, platform-admin only): the Command Center
headline tiles + contributions chart + recently-provisioned, the
cooperatives-by-state chart, MRR (derived from each tenant's actual plan tier),
platform reconciliation, and the billing tier counts are all **live**.

A few panels still have **no backing API** (churn-risk model, cohort retention,
MAU / NRR / activation, invoices, white-label domains, onboarding pipeline,
provider & system health) — they arrive with the rest of the Phase 3 platform
backend. Those render a **Sample** badge and draw from
`src/platform/mockData.ts`; swap them for live hooks as the endpoints land.

## Scripts

- `npm run dev` — dev server (`:5173`)
- `npm run build` — typecheck + production build to `dist/`
- `npm run preview` — serve the production build
- `node scripts/shot.mjs <email> <pass> <coopId|-> <path> <out.png>` — Playwright
  screenshot helper used for visual verification against `CooperativeOS.html`.

## Responsive member app

The member surface (`/app`) is designed for every screen size:

- **Phone** — full-screen with a bottom tab bar.
- **Tablet & desktop** — a left sidebar + a centred, comfortably-sized content
  column on the paper canvas (a real responsive web app, not a shrunken phone).

The console and platform surfaces are desktop-first admin consoles.

## Offline (PWA)

The member app is an installable PWA with a service worker (`vite-plugin-pwa`,
active in the production build only).

**Offline reads** — the app shell + fonts are precached and GET `/api` reads use
a **NetworkFirst** strategy, so a member who has opened the app before can still
view their savings and statement with no connection. The last-known profile is
persisted so the app boots (and stays signed in) offline; sign-out only happens
on a real `401`, never on a network drop.

**Offline writes** — voting and contributing while offline are captured in a
persisted **outbox** (`src/api/outbox.ts`), shown in a sync banner, and replayed
automatically on reconnect. Replays are **idempotent**: votes dedupe on the
unique-ballot constraint, and contributions carry a client-generated
`psp_reference` that the backend `initiate_contribution` dedupes on — so a replay
can never double-apply.

Verify it:

```bash
npm run build && npm run preview      # SW only runs in the production build
node scripts/offline-check.mjs        # offline READ: cached savings/statement render
node scripts/offline-write-check.mjs  # offline WRITE: vote offline → reconnect → syncs
```

> **Caveat:** cached API responses are keyed by URL, so on a *shared* device a
> signed-out user's data could be read from cache until it expires (24h). Fine
> for the target personal-phone use; before multi-user devices, clear the
> `coop-api` cache on logout.

## Not yet built

A native mobile app (a Flutter spike lives in `../mobile/` — see its README),
and live endpoints behind the remaining Phase 3 platform analytics panels.
