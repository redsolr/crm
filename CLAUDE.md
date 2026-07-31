> **Platform**: Windows 11 — use PowerShell syntax for all commands (e.g. `$env:VAR="value"; command`). No bash, no `export`.

# Claude Code — Jurisimus Frontend

> **Key References** — read these for full context before major changes:
>
> - **[docs/index.md](./docs/index.md)** — Architecture, data flow, API clients, query hooks, testing
> - **[docs/components/index.md](./docs/components/index.md)** — All UI components with props, usage examples, stores, hooks
> - **[docs/authentication.md](./docs/authentication.md)** — WorkOS auth flow, middleware, token exchange

## Rules

### Ask, Don't Investigate The User's Machine

Be autonomous on **code work** — edits, refactors, fixing related bugs surfaced mid-task, deleting dead code, running `tsc`/`jest`/`build`. Don't propose plans or ask "want me to go ahead?".

But the moment a problem is **environmental** (something outside the repo: which process owns a port, how the dev server was started, what env vars are set, why a server is stale, whether a background task is yours), **stop and ask one specific question** instead of poking at the user's system. The user knows their own machine and would rather answer one question than have Claude run `Get-Process`, `taskkill`, kill PIDs, restart servers, or otherwise touch their environment.

Examples that require asking first, not investigating:
- "Which process is on port 3000? Was it started with mock auth?"
- "Should I kill this background server / restart it?"
- "Is this failing test a known flake or did I cause it?"
- Any read-only process inspection (`Get-Process`, `tasklist`, `lsof`) — even read-only is "poking at their machine".

The line: **code = autonomous, environment = ask.**

### Check Before Building

**Before creating any new component, hook, utility, or API client**, check [docs/components/index.md](./docs/components/index.md). Duplicating existing code is a bug. Key things that already exist:

- `BaseApiClient` (`lib/api-client.ts`) — every API client extends this. Never write raw `fetch` + auth headers.
- `authService` (`lib/authTokenManager.ts`) — get/set JWT, `getAuthHeaders()`. Never read `localStorage` for tokens directly.
- `API_BASE` (`lib/api-base.ts`) — backend URL. Never use `process.env.NEXT_PUBLIC_API_URL` directly.
- `formatDate` (`lib/date-constants.ts`) — date formatting. Never write your own.
- `formatRelativeTime` (`lib/format-time.ts`) — relative timestamps. Never duplicate.
- `useResizePanel` + `PANEL_SIZES` — resizable panels. Add a preset, don't hardcode sizes.
- `useClickOutside` — close on outside click / Escape. Never write manual `mousedown` listeners.
- `clsx` — className composition (installed). Use instead of template literal concatenation.

### Code Quality

- **Never swallow errors** — Every `catch` must `console.error` the actual error with context. Never empty catches or generic alerts without logging. Use `console.warn` for expected/recoverable errors.
- **No lint suppression** — Never use `eslint-disable` comments. Fix the underlying issue.
- **No hardcoded colors** — Use theme CSS variables (`var(--theme-*)`, `var(--ctx-*)`). Check `globals.css` for available variables.
- **Semantic class names** — Root element: kebab-case component name. Children: `{component}-{element}`. State: `is-active`, `is-expanded`.

### Definition of Done

**A task is not done until all of the following pass locally:**

```bash
npx tsc --noEmit       # 0 errors across the entire project
npm test               # all Jest unit tests pass
npm run build          # next build succeeds
```

**Any TypeScript or test error is a hard blocker — no exceptions.** It does not matter whether:
- The error is in a file you didn't touch (e.g. a test broken by a previous session's refactor)
- The error appears unrelated to your change
- The error is "pre-existing" — if `tsc`, `jest`, or `next build` reports it during your task, **you fix it before declaring done**

If you discover an error mid-task, treat it like any other bug: investigate, fix at the root, add the fix to your PR. The bar is "every command in the Definition of Done block exits clean," not "the bits I personally introduced are clean." A regression that snuck in through one session becomes invisible if every subsequent session ignores it.

**Shortcuts that are never acceptable:**
- Pushing with a failing test and adding a TODO
- Suppressing TypeScript errors with `// @ts-ignore` or `as any` to make the build pass
- Commenting out tests to unblock CI
- Declaring done when `tsc`, `jest`, or `next build` reports any error, regardless of which file

**Before any production deploy, additionally run both e2e tiers:**

```bash
npm run test:e2e            # mocked Playwright (UI behavior)
npm run test:e2e:real-auth  # REAL WorkOS login + real Postgres, no mocks
```

The real-auth tier (e2e/*.real-auth.spec.ts — the ONLY specs without
MOCK_AUTH) exists because mocked tests structurally cannot catch a
missing or wrongly-shaped real route: that class shipped three
production bugs on 2026-07-31 (org-bootstrap deadlock, usage-summary
404, views 404). It drives the actual email+password login against the
crm WorkOS Staging env (credentials in `.env.local`: `E2E_WORKOS_*` +
`E2E_WORKOS_TEAMMATE_*` — synthetic users, no real mailboxes), sweeps
every app surface with a zero-404 tripwire, runs the sales loop with
saved-view persistence, exercises the `/mcp` agent door, and proves
two-seat attribution. Prereqs: docker Postgres on :5440, migrated +
seeded (`npm run db:seed`).

### Debugging

**When the user says to debug**: Add `console.log` statements to trace the issue. Do NOT guess or theorize — instrument the code and let the logs reveal the problem.

## Critical Gotchas

### WorkOS Auth — Critical Rules

**proxy.ts** — DO NOT wrap, rename, or change the export pattern. Must remain `export default authkitProxy({...})`. Any wrapping breaks the OAuth callback cookie flow. Only safe change: toggle `middlewareAuth.enabled` via env var.

**OAuth routes** (`login/google`, `login/apple`) — Use `workos.userManagement.getAuthorizationUrl({ provider })` for direct provider redirects. Do NOT use `getSignInUrl()` — that redirects through the WorkOS hosted login page.

**Callback** (`callback/route.ts`) — Uses a custom handler with `authenticateWithCode` + `saveSession`, NOT `handleAuth`. The v3 `handleAuth` requires PKCE state that only `getSignInUrl()` sets. Since we use `getAuthorizationUrl()` (direct provider), the callback must exchange the code manually.

**These three are coupled**: `getAuthorizationUrl` (routes) + custom `authenticateWithCode` callback + plain `authkitProxy` proxy. Changing any one breaks the others.

### Backend identity (team attribution, swap step 6 — DONE 2026-07-31)

Every write route resolves WHO is writing via `src/server/actor.ts`
`currentActor()` (reads the AuthKit session headers the proxy attaches).
Records carry real `created_by_id`/`created_by_name`, comments carry
`author_name`/`author_email`, activities carry real actors. Session-less
callers (MOCK_AUTH, unit tests) fall back to the `usr_local`
placeholder; AI writes (Ask tools + `/mcp`) stamp `Claude (agent)`
(`AGENT_ACTOR_ID`, `actor_type: "agent"`). New write paths MUST thread
an actor — never reintroduce a hardcoded author.

Known team gaps (queued, don't build unprompted): no cross-user cache
invalidation (teammates see new records on refresh, not live); author
names not yet displayed in timeline/comments UI; no in-app roles (every
seat is equal until the first non-founder joins).

### MCP server (`POST /mcp`)

The agent door — the 5 Ask-panel sales tools over Streamable HTTP,
bearer-authed via `CRM_MCP_TOKEN`, closed when unset. Tool registry is
`src/server/ask-tools.ts` (single source; the route only adapts). Full
doc: [docs/mcp.md](./docs/mcp.md).

### Mock Auth (`MOCK_AUTH=true`)

Server-only env var that bypasses WorkOS auth entirely. No `.next` cache issues (unlike the old `NEXT_PUBLIC_E2E_MODE`).

- `npm run dev:mock` — dev server without WorkOS
- `npm run test:e2e` — Playwright sets it automatically
- `npm run dev` — real WorkOS auth (default)

Two layers cooperate when `MOCK_AUTH=true`:
1. `proxy.ts` — `middlewareAuth.enabled` is `false` (no redirect to login)
2. `layout.tsx` — mounts `E2EAuthInit` instead of `AuthKitProvider`

**DO NOT** wrap, rename, or change the export pattern of `proxy.ts`. Only the `enabled` config flag is safe to toggle. Any wrapping breaks the OAuth callback flow.

### E2E Mock Layer Conventions

The Playwright mock layer (`e2e/handlers/*.ts`, `e2e/fixtures/auth.fixture.ts`) was rebuilt 2026-05-25 — see `docs/handoff/2026-05-25-e2e-mocks-restored.md` for the full incident write-up. **Honor these conventions or your mocks will silently never intercept**:

- **URL prefix**: every mock that targets a platform API call MUST include `/v1/` — use `API_V1` (= `${API_BASE}/v1`) from `e2e/handlers/shared.ts`, not `API_BASE`. Routes excluded from `/v1/` on the platform — `/auth/*`, `/oauth/*`, `/health*`, `/mcp/*`, `/payments/webhooks/*`, `/subscriptions/webhook/*`, `/collaboration` — stay at `API_BASE` directly.
- **Field names**: snake_case end-to-end on the wire (Stripe v2 discipline). Exceptions inline-documented in the relevant handler:
  - **Sharing**: `principalId` / `principalType` / `shareId` stay camelCase.
  - **Search**: `sourceType` / `matchedBy` / `totalResults` stay camelCase.
  - **Findings**: mixed — `sourceType` / `chatId` camel but `account_id` / `created_at` snake (legacy mismatch).
  - **Favorites**: `targetId` / `targetType` camel, `created_at` snake.
  - **UI Layout**: `panelWidths` camel (FE Zod doesn't transform).
- **Cascading mocks**: when one handler needs to defer to another, use `await route.fallback()`, NEVER `route.continue()`. `continue()` sends the request to the actual network — `fallback()` tries the next-registered matching route. The pre-rewrite code used `continue()` and every "deferral" was actually a real-server hit.
- **Envelope shapes**: cursor lists use `{ data, has_more, next_page_url, previous_page_url }`. Single-entity creates wrap: `{ work_item }`, `{ iteration }`, `{ folder }`, `{ page }`. Bare arrays for `/v1/organizations`, `/v1/notifications`, `/v1/favorites`, `/v1/plans`. The `/v1/projects/:id/envs` shape is `{ envs }` (not the cursor shape — narrow surface).
- **Pinning env**: when a test creates a new project + needs work-item-type lookups to find the templated `task`, send `Jurisimus-Env-Id` header pointing at the new project's prod env. Without it the JWT's bound env is used and templated rows are out of tenant scope. See `e2e/full-stack.integration.spec.ts` `apiFetchV1Env` for the pattern.

When in doubt, read `e2e/backlog.spec.ts` — it's the canonical green example (11/11).

### Marketing i18n & Landing Variants

The marketing surface (not the app shell) is localized and currently ships two landing designs:

- **Dictionaries**: `src/lib/i18n/` — `locales.ts` (en default at `/`, th at `/th`), `dictionary.ts` (shape), `dictionaries/{en,th}.ts`. Both dictionaries `satisfies Dictionary`, so a missing key in either locale is a **tsc error** — copy changes must land in both files in the same PR. Thai copy is machine-drafted and needs native review before being promoted/advertised.
- **Landing variants**: the root page branches server-side on the `jurisimus-landing-variant` cookie (`src/lib/landing-variant.ts`). `classic` = `(marketing)/LandingPageClient.tsx` (velvet), `prestige` = `src/components/landing-v2/` (ivory/oxblood, quiet-luxury). A public `VariantTogglePill` writes the cookie — temporary while the redesign is evaluated. To promote prestige: flip `DEFAULT_LANDING_VARIANT`, remove the pill usage, delete the classic tree.
- **Prestige theme**: `--lx-*` tokens scoped to `[data-landing="prestige"]` in `src/styles/landing-v2.css`, bridged to Tailwind in `globals.css` `@theme inline`. Fonts (Fraunces + Noto Serif Thai / IBM Plex Sans Thai) load only inside the prestige subtree via `landing-v2/fonts.ts`; Thai faces lazy-load by unicode-range — no per-locale font logic.
- **Crawlers**: `src/app/robots.ts` (never add a bare `/` to disallow — it blocks the whole site), `src/app/sitemap.ts` (locale hreflang alternates), `src/app/llms.txt/route.ts` + `llms-full.txt` (content in `src/lib/llms-content.ts` — keep honest to shipped capabilities).
- **E2E**: `e2e/landing-v2.spec.ts` covers robots/sitemap/llms, variant toggle, `/th`, hreflang, language switcher. Use role-based locators for hero text — `getByText` collides with Next's route announcer after client-side navigation.

### Store Pattern

Components read from Zustand stores directly — never receive editor/UI state as props. `ChatSidebar`, `TopBar`, `KeyFindingsPanel` etc. all call stores internally. Server state lives in TanStack Query, stores hold client-only UI state.

### External Repos

Repos outside this directory are **read-only reference**:
- **Backend**: `D:\Jurisimus\platform\` — read for API specs, data models. Do not start/stop backend code.
- **Mobile**: `D:\Jurisimus\mobile\` — read for feature parity, shared API contracts.
