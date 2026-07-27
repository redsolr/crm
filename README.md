# crm-web — internal CRM

The company's internal CRM (ADR-001: platform `docs/platform/adr-001-crm-internal-product-2026-07-13.md`).
**Not customer-facing.** One CRM workspace per product's GTM motion; the sidebar switches
between them. Runs entirely on the platform backend's `/v1/*` primitives — this repo has
no backend, no database, no marketing surface. The landing page is a redirect to `/sales`.

Bootstrapped as a stripped copy of `web-app@8a33948` (auth flow, API client, stores, UI kit,
and the `(sales)` CRM face); the web-app's `(sales)` route group is scheduled for removal
once this app is the daily tour CRM (see platform `docs/deferred-decisions.md`).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router, Turbopack) — port **3100** |
| Language | TypeScript (strict) |
| UI | React 19 + Tailwind 4 |
| State | Zustand (client) + TanStack Query (server) |
| Auth | WorkOS AuthKit (shared sandbox app with web-app; own redirect URI) |
| Backend | Jurisimus platform (`localhost:8080` dev / `api.jurisimus.com` prod) |
| Testing | Jest (unit) + Playwright (E2E, mocked + integration tiers) |

## Quick Start

```bash
npm install
cp .env.example .env.local   # fill in WorkOS credentials (see .env.example notes)
npm run dev                  # http://localhost:3100
```

UI work without auth or a backend:

```bash
npm run dev:mock
```

## Prerequisites for real login (once)

1. Platform backend running (`D:\Jurisimus\platform`: `bun run docker:up && bun run start:dev`).
2. `http://localhost:3100/callback` registered as a redirect URI in the WorkOS dashboard
   (same sandbox app as web-app).
3. Backend CORS already allows `http://localhost:3100` in non-production
   (`src/config/cors.config.ts`); production origins go through `CORS_ALLOWED_ORIGINS`.

## Deployment note

crm-web is a pure frontend — it can deploy anywhere (e.g. Vercel) as long as it is served
from a `jurisimus.com` subdomain (auth cookies are scoped to `.jurisimus.com`), the origin
is added to the backend's `CORS_ALLOWED_ORIGINS`, and the callback URL is registered in
WorkOS.

## Tests

```bash
npm run lint && npm run tsc:check
npm test                     # unit
npm run test:e2e             # mocked Playwright (owns port 3100 for the run)
npm run test:e2e:integration # real backend (requires Docker + platform dev server)
```
