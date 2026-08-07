# Jurisimus Frontend Documentation

> **For LLMs**: Start here. This index links to all technical documentation. For full system architecture, read [Architecture](#architecture) below. For backend API contracts, read the platform at `D:\Jurisimus\platform\docs\index.md`. For mobile app, read `D:\Jurisimus\mobile\docs\index.md`.

**What**: Next.js frontend for Jurisimus — AI-powered workspace for knowledge workers with chat, project management, notes, and research.

**Stack**: Next.js 15 / React 19 / TypeScript / Zustand / TanStack Query / Tiptap / Tailwind 4 / WorkOS AuthKit / dnd-kit / Playwright

---

## Documentation

### Core Systems

| Document | What it covers |
|----------|---------------|
| [Authentication](./authentication.md) | WorkOS custom UI, OAuth, token exchange, session management, middleware |
| [Landing Page](./landing-page.md) | Marketing site architecture, color palette, components, theme |
| [Component Reference](./components/index.md) | All UI components, shared hooks, Zustand stores, props, usage examples — **check before building new UI** |

### Feature Docs

Full index: **[Feature Index](./features/index.md)**

| Feature | Docs |
|---------|------|
| Chat & Research | [View](./features/chat.md) |
| Document Editor | [View](./features/editor.md) |
| Tasks & Backlog | [View](./features/tasks.md) |
| Sprints | [View](./features/sprints.md) |
| Epics | [View](./features/epics.md) |
| Settings | [View](./features/settings.md) |
| Overlay System | [View](./features/overlay-system.md) |
| Backlog Drag-and-Drop | [View](./features/backlog-dnd.md) |
| Account & User Menus | [View](./features/menus.md) |
| Mobile Screens | [View](./features/mobile.md) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.5 (App Router, Turbopack) |
| Language | TypeScript 5 (strict) |
| UI | React 19 + Tailwind 4 + Framer Motion |
| State | Zustand 5 (client state) + TanStack Query 5 (server state) |
| Auth | WorkOS AuthKit (`@workos-inc/authkit-nextjs` + `@workos-inc/node`) |
| Editor | Tiptap 3 (15+ extensions) |
| Drag & Drop | @dnd-kit (core + sortable) |
| UI Primitives | Radix UI (dropdown, popover) |
| Classnames | clsx |
| Testing | Playwright 1.55 (E2E) + Jest 30 (unit) |

---

## Project Structure

```
web-app/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root: AuthKitProvider → QueryProvider → AuthSync
│   │   ├── (marketing)/        # Landing page (/) — forces light theme
│   │   ├── (auth)/             # Login, callback, logout, onboarding
│   │   └── (workspace)/        # Auth-protected routes
│   │       └── (views)/        # AppLayout-wrapped routes
│   │           ├── research/   # /research — AI chat (main feature)
│   │           ├── explorer/   # /explorer — file management
│   │           ├── team/       # /team — members, orgs, groups
│   │           ├── settings/   # /settings — overlay page
│   │           ├── pricing/    # /pricing — overlay page
│   │           └── contact/    # /contact — overlay page
│   ├── components/             # See docs/components/index.md for full reference
│   │   ├── auth/               # Login/signup form components
│   │   ├── chat/               # Chat interface (20+ components)
│   │   ├── document-editor/    # TipTap rich text editor
│   │   ├── explorers/          # File tree, context builder
│   │   ├── key-findings/       # Key findings panel
│   │   ├── landing/            # Marketing site
│   │   ├── layout/             # AppLayout, ActivityBar, TopBar, menus
│   │   ├── main-window/        # Project management views (board, backlog, sprint)
│   │   ├── mobile/             # Mobile-specific screens
│   │   ├── onboarding/         # Onboarding flow
│   │   ├── research/           # Research chat views
│   │   ├── settings/           # Settings sections + form primitives
│   │   ├── sharing/            # Share dialog, grants, member search
│   │   ├── sidebar/            # Sidebar sub-components
│   │   ├── sync/               # State sync components
│   │   ├── team/               # Team management (members, orgs, groups)
│   │   ├── ui/                 # Generic UI primitives
│   │   └── icons/              # SVG icon components
│   ├── stores/                 # Zustand stores (13 stores — see components/index.md)
│   ├── queries/                # TanStack Query hooks (by domain)
│   ├── lib/                    # API clients, utilities
│   ├── hooks/                  # Shared React hooks (27 hooks — see components/index.md)
│   └── styles/                 # CSS (globals.css, workspace.css, landing.css)
├── docs/                       # This documentation
│   ├── components/             # Component reference with props & usage
│   └── features/               # Per-feature deep-dive docs
├── e2e/                        # Playwright E2E tests
└── package.json
```

---

## Architecture

### Three-Panel Layout (VS Code-style)

```
┌──────────┬───────────────────────┬──────────────┐
│ Activity │     Main Content      │  Right Panel  │
│   Bar    │                       │  (optional)   │
│          │ - Chat (/research)    │ - Findings    │
│ [icons]  │ - Editor (/p/:id)    │ - Chat        │
│          │ - Settings (overlay)  │ - Member detail│
│          │ - Pricing (overlay)   │               │
│ [account]│ - Help (overlay)     │               │
└──────────┴───────────────────────┴──────────────┘
```

**Layout Component**: `src/components/layout/AppLayout.tsx`

### Overlay System

Settings, Pricing, and Help render as overlay views in the main content area. See [Overlay System docs](./features/overlay-system.md).

- Managed by `useLayoutUI` store (`overlayView` state)
- URL sync via `useOverlayRouting` hook
- Back button in shared `overlay-back-bar` (AppLayout)
- Sidebar panel hides when overlay is open

### Data Flow

```
Backend API (localhost:8080) ← authTokenManager.getAuthHeaders()
         ↓
   TanStack Query hooks (src/queries/)
         ↓
   React components (render server state)
         ↓
   Zustand stores (client-only state: auth, UI, layout)
```

**Design principles:**
- Components read from stores directly — no prop drilling
- Server state stays in TanStack Query — stores hold client-only UI state
- Cross-domain actions live in one store (e.g. `WorkspaceEditorStore` handles tabs + context builder)

---

### Realtime collaboration (2026-08-01)

Self-hosted multiplayer on a Cloudflare Durable Object worker
(`realtime/`): live cross-user cache invalidation, presence
(avatars / "X is here" / field claims / cursors), and Yjs/TipTap
co-edited live notes with a freeze-into-call-note flow. Client half
lives in `src/lib/realtime/` (one socket in CrmShell, Zustand store)
+ `src/components/presence/`. Entirely env-gated
(`REALTIME_URL`/`REALTIME_SECRET`). Full architecture + deploy
runbook: [docs/realtime.md](./realtime.md).

### LLM seam (OpenAI, 2026-08-02)

Every paid model call rides `src/server/llm.ts` (OpenAI; default
`gpt-5.4-mini`, `CRM_ASK_MODEL` override): the Ask agentic loop
(`server/ask.ts` — SSE grammar in `src/lib/chat/stream.ts` is
provider-agnostic), attribute enrichment `/compute`, interview
suggest `/api/responses`, and call transcription (below). Fails
loudly without `OPENAI_API_KEY` — never add a silent fallback
(billing discipline).

### Record-a-call (2026-08-07)

The opportunity detail header's Record button captures the call in
the browser (MediaRecorder); Stop streams the audio through
`POST /api/transcribe` — speech-to-text (`TRANSCRIBE_MODEL`, default
`gpt-4o-mini-transcribe`) plus an `ASK_MODEL` extraction pass
(`src/server/transcribe.ts`, client-injected and DB-free) — and
`CreateCallNoteModal` opens PREFILLED (signal-coded summary,
transcript appended, outcome guess). The founder reviews and saves;
the model never writes the record. Audio is never stored
(transcript-only by design). The route is exempt from the
Idempotency-Key gate: pure compute, no server-side write.

### Ambient digest (2026-08-07)

The morning digest is the CRM's first ambient loop: a Vercel cron
(vercel.json, 00:00 UTC = 07:00 Bangkok) calls `GET /api/digest/run`
(bearer `CRON_SECRET`, closed-by-default like /mcp). The run composes
"what deserves attention today" with the SAME deterministic neglect
ranking the Summary tab uses (`src/lib/sales/followup-ranking.ts` —
extracted pure so page and push can never disagree), plus open
commitments due; drafts follow-up messages for the top 3 actionable
deals through the LLM seam (`src/server/digest.ts`, strict-JSON
response, failures surfaced in `drafts_error` — never silent); persists
one `digests` row per Bangkok date; and web-pushes a one-line summary
(once per date — re-runs refresh the payload but never re-notify).

Web push rides the serwist service worker (`src/app/sw.ts` push +
notificationclick handlers; prod-only — dev has no SW) and a
`push_subscriptions` table (migration 0007). Env-gated like realtime:
no `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` ⇒ no enable affordance, no
push leg; the digest still composes and renders in-app. The Summary
tab's `SalesDigestCard` shows the newest digest's drafts
(copy-and-send) and this browser's notification toggle
(`use-push-notifications.ts`). Keys: `npx web-push generate-vapid-keys`.

### AI chat surfaces (Chat tab + drawer, 2026-08-03)

One conversation, two mounts of `AskConversation` over the shared
`useAskPanel` store: the **drawer** (topbar "Ask AI" pill / Ctrl+J —
frames the current view via `use-page-context.ts`) and the **Chat
tab** — the ChatGPT-shape full page at `/sales/ask` (sidebar
"Chat"): `AskHistoryRail` (new chat, persisted conversations, delete)
beside transcript + composer. Persistence is `chats` +
`chat_messages` (`src/server/chats.ts`); the rail rides the
platform-era client contracts, now served in-repo:
`GET /api/chats/history` · `GET /api/chats/:id/messages` ·
`DELETE /api/chats/:id` (+ `POST /api/chats`,
`POST /api/chats/:id/responses` from the original swap). Reopening a
chat hydrates the store (`hydrateConversation` +
`toAskTranscript`); tool steps are live-only and never persisted.

### Testing layers (2026-08-03)

Three layers, split by WHAT can break — see CLAUDE.md § Definition of
Done for the command list:

1. **Deterministic** (jest + mocked Playwright): UI, wire contracts,
   tool-step plumbing. Journey specs walk real sales flows end to end
   — `chat-ops.spec.ts` (narrative → agent writes → views change, via
   `setupSalesHandlers(...).agentWrites` + ask.handlers `onSend`),
   `precall-prep.spec.ts`, `ask-chat-tab.spec.ts`.
2. **Real stack** (real-auth tier): real WorkOS + Postgres, LLM off —
   incl. `deal-lifecycle.real-auth.spec.ts` (full funnel + lost +
   not-now revisit resurfacing).
3. **Real model** (`real-llm.real-auth.spec.ts`, triple-gated on
   `RUN_REAL_LLM_E2E` + `OPENAI_API_KEY` + real-auth creds): grounded
   read, single write w/ attribution, /mcp split, enrichment, and the
   multi-write narrative — asserted by OUTCOMES on the wire only,
   never wording or tool order. Locally: `npm run test:e2e:real-llm`.
   Nightly drift alarm: `.github/workflows/llm-behavior.yml` re-runs
   it with `--retries=2` (04:30 Bangkok) so a silent model update
   behind the alias reds a scheduled run, not a code push.

## TanStack Query Hooks

### Chat (`src/queries/chat/`)

| Hook | Purpose |
|------|---------|
| `useChatQuery` | Full chat lifecycle: send, stream, tool execution, usage validation |
| `useChatBranchQuery` | Branch creation, branch tree |
| `useResearchChatsQuery` | Chat history: list, rename, delete, group by date |

### Settings & Account (`src/queries/settings/`)

| Hook | Purpose |
|------|---------|
| `useAccountDataQuery` | Subscription + usage summary |
| `useUsageDisplayQuery` | Computed usage display (percent, cost, limits) |
| `usePreferencesQuery` | User preferences (role, tone, length) |
| `useProfileMutation` | Update user profile (name) |
| `useSessionCountQuery` | Active session count + revoke all |

### Other Domains

| Directory | Hooks |
|-----------|-------|
| `queries/auth/` | `useAuthSync` — WorkOS → Backend token exchange |
| `queries/documents/` | `useDocumentQuery`, `useDocumentsQuery` |
| `queries/folders/` | `useFoldersQuery` — folder tree, CRUD |
| `queries/project-management/` | `useProjectsQuery`, `useTasksQuery` |
| `queries/views/` | `useProjectBacklogQuery`, `useProjectBoard` |
| `queries/workspace/` | `useWorkspaceQuery`, `useAccountDataQuery` |
| `queries/team/` | `useAccountMembersQuery`, member CRUD mutations |

### Chat Send Flow

```
User types → ChatBox.onSend(message, model)
  → useChatQuery.sendMessage()
    → validatePermission(model) — POST /accounts/:id/usage/validate
    → createChat() if needed — POST /chat
    → startChatStream() — POST /chat/stream (SSE)
      → Parses events (message_start, content_block_delta, etc.)
      → appendToLastAssistantMessage() on each delta
    → On complete: invalidate query keys
```

### Chat Branching

Conversations fork at any message via Parent Reference Model:
- `parentChatId` + `branchedFromMessageId`
- Branch creation copies messages up to branch point
- Multi-level branching supported

---

## API Clients

All API clients extend `BaseApiClient` (`lib/api-client.ts`) which handles auth headers, 401 auto-logout, 204 No Content, and 404/409 errors.

| Client | File | Key Endpoints |
|--------|------|---------------|
| Chat | `lib/chat/` (barrel: `lib/chatApi.ts`) | `/chat/stream`, `/chat`, `/chat/:id/messages`, `/chat/:id/branch`. Split into `client.ts` (CRUD), `stream.ts` (SSE state machine), `schemas.ts` (Zod runtime contracts mirroring backend `chat.response.dto.ts`), `permissions.ts` (`useChatPermissions`), `breadcrumbs.ts` (Sentry), `types.ts` (request types) |
| Findings | `lib/findingsApi.ts` | `/findings`, `/findings/:id`, `/findings/trash`, `/findings/export` |
| Finding Sets | `lib/findingSetsApi.ts` | `/finding-sets`, `/finding-sets/:id/findings` |
| Account | `lib/accountApi.ts` | `/accounts/:id`, `/accounts/:id/subscription`, `/accounts/:id/usage/summary` |
| Usage | `lib/usageApi.ts` | `/usage/summary`, `/usage/limits`, `/billing/overview`, `/billing/pricing` |
| Preferences | `lib/preferencesApi.ts` | `/user-preferences/me`, `/auth/sessions`, `/auth/sessions/revoke-all`, `/users/:id` |
| Tasks | `lib/tasksApi.ts` | `/tasks`, `/tasks/:id`, `/tasks/:id/move`, `/tasks/:id/subtasks` |
| Pages | `lib/pagesApi.ts` | `/pages`, `/pages/:id`, `/pages/:id/hypotheses` |
| File System | `lib/fileSystemApi.ts` | `/file-system/nodes`, `/file-system/tree`, `/folders`, `/pages` |
| Reminders | `lib/remindersApi.ts` | `/reminders`, `/reminders/:id` |
| Blocks | `lib/blockApi.ts` | `/pages`, `/blocks`, `/spaces`, `/spaces/:id/sources` |
| Instructions | `lib/instructionApi.ts` | `/instructions`, `/templates`, `/folders/:id/instructions` |
| Team | `lib/teamApi.ts` | `/accounts/:id/members`, `/organizations`, `/teams`, `/groups`, `/accounts/:id/invite-links` |

To add a new API client: extend `BaseApiClient`, add methods, export a singleton.

---

## E2E Testing

Two-tier strategy. See `e2e/` directory.

| Tier | When | Backend? | Speed | What it tests |
|------|------|----------|-------|---------------|
| Mocked | Every PR (CI) | No | ~30s | UI behavior, component interactions, error states |
| Integration | Pre-deploy / nightly | Yes (Docker) | ~2min | Full stack: FE → API → DB → LLM mock → SSE → FE |

---

## Local Development

```bash
npm run dev          # Dev server (Turbopack, port 3000)
npm run build        # Production build
npm run lint         # ESLint
npm run test:e2e     # Tier 1: mocked E2E
```

### Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `WORKOS_CLIENT_ID` | WorkOS client ID |
| `WORKOS_API_KEY` | WorkOS API key (server-side) |
| `WORKOS_COOKIE_PASSWORD` | Session cookie encryption (32+ chars) |
| `NEXT_PUBLIC_STRIPE_PUB_KEY` | Stripe publishable key (optional) |
| `MOCK_AUTH` | Disable auth for E2E/dev (server-only, `npm run dev:mock`) |
