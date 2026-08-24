# Features — current capability map

> **What this is**: the living list of what the CRM can do TODAY — for
> humans who forget and sessions that plan. Current state only, not a
> changelog (git history has the story).
>
> **Maintenance rule**: any feature-visible change updates this file in
> the SAME commit — same discipline as threading an actor. Add the row,
> update the row, or move it to "Cut" when a decision kills it.

## Pipeline (`/sales`)

- **Summary tab (Inbox-first landing)** — morning-digest card + ranked follow-up queue + commitment inbox stacked as the default landing view; tab labeled "Summary" (2026-08-08, wording 2026-08-11)
- **Table view** — Attio-style records table: inline cell edit (If-Match versioned), drag-rank with persistence, boundary + insert-between rows, rapid-entry create chip, column sort, filter bar + saved views (create/switch/delete)
- **Kanban board** — stage lanes, drag between stages, closed-stage interception (lost-reason modal)
- **Deal lifecycle** — full funnel; lost-with-reason; "not now" parking with `revisit_due` RESURFACING into the Inbox queue (2026-08-03)
- **Follow-up intelligence** — pure ranking (`followup-ranking.ts`, shared by Summary + digest cron): overdue + no-next-step deals surface, healthy ones hidden
- **Layout tabs** — Inbox | Table | Board strip, drag-reorderable, choice persists per browser

## Records

- **Five record types** — accounts (companies), contacts, opportunities (children of accounts), call notes, commitments — single-tenant workspace on the platform-shaped `records`/`work_items` model
- **Record pages + peek panel** — row click opens peek; expand to full record page; share links (`?peek=`)
- **Activity timeline** — actor-attributed (real seat names; agents stamp their own identity), call notes + commitments land on both record timelines
- **Comments** — with author attribution
- **Custom attributes** — typed definitions per record type, validated writes (CONTINUE-THROUGH semantics)
- **✨ AI-computed columns** — per-attribute `/compute` enrichment with provenance; NEVER clobbers a manual value (loud skip) (2026-08-01)
- **Commitments as delegation channel** — `Claude: <instruction>` titled commitments = founder→agent task queue (poll via `list_commitments`)

## Ask assistant (AI)

- **Ask drawer + `/sales/ask` full page** — streaming SSE chat, drag-resizable drawer, same transcript expands to the Chat tab with history rail (2026-08-03)
- **Jurisimus bridge (inbound, 2026-08-24)** — the platform's Mission Control mirrors demo-request lifecycle events through the /mcp door under its own bearer (`CRM_MCP_BRIDGE_TOKEN`) and actor ("Jurisimus Platform"): landing-form request → company (source inbound) + deal + call note; mark-contacted → note; dismiss → deal lost + note; provision → deal won + note. Account → Integrations card shows connection posture + recent bridge writes. Residual: segment select keys are best-effort mapped from the landing form's firm-size buckets (unknown keys degrade to unset, never fail).
- **Agentic tool loop** — 11 server-side tools: `find_crm_record`, `create_account`, `create_opportunity`, `update_opportunity`, `log_call_note`, `create_commitment`, `list_commitments`, `complete_commitment`, `remember_fact`, `forget_fact`, `list_memories`; visible ✓ tool steps; multi-write narratives ("just finished the call…" → note + stage + follow-up)
- **Agent memory (ChatGPT shape)** — durable facts injected into every Ask send; agent saves/forgets from conversation; founder manages (add/delete) on /account → Assistant memory; **pause toggle** stops injection + agent writes while keeping rows (2026-08-12)
- **Page-context framing** — the current view rides the wire as a `[Viewing: …]` preamble (record pages, pipeline tab), never shown in the transcript
- **Screenshot paste** — Ctrl+V images ride the current send (live-only, not persisted)
- **Agent attribution split** — in-app Ask writes stamp "Ask assistant"; /mcp writes stamp "Claude (agent)" (2026-08-02)
- **Interview mode** — tap-through discovery interview with branching + AI follow-up suggestions → call-note save; Interviews tab with quick-create, resume, history, ⌘K deep-link

## Ambient / capture

- **Morning digest** — 07:00 Bangkok cron (`/api/digest/run`, CRON_SECRET): attention buckets + due commitments + LLM top-3 follow-up drafts; one row per Bangkok date; renders as the Summary-tab card with copy buttons (2026-08-07, cron PROVEN on prod 2026-08-08)
- **Web-push notifications** — env-gated VAPID push, once per digest date; enroll via Summary → Enable notifications; service-worker `push`/`notificationclick`
- **Record-a-call** — MediaRecorder → `/api/transcribe` (gpt-4o-mini-transcribe + extraction) → prefilled call-note draft; audio NEVER stored (2026-08-07)

## Search & navigation

- **Global search** — topbar `/` dropdown: suggestions, grouped record results, fully keyboard-driven; FTS-backed `/api/search`
- **⌘K command palette** — navigate, create records, jump to records, move stages
- **Responsive shell** — <768px drawer sidebar, card lists for tables, full-width panels; wide-viewport (≥1440) screen-centered branch; both are e2e-covered code branches
- **PWA** — installable, manifest + icons + service worker

## Agent door (`POST /mcp`)

- **MCP server** — same 11-tool registry over Streamable HTTP; OAuth 2.1 resource server (AuthKit AS, RFC 9728/8707, DCR) + `CRM_MCP_TOKEN` service bearer; closed when unset (2026-08-06)
- **Standalone Connect** — connector sign-ins go through OUR `/login/connect` page, never a WorkOS-hosted screen; PROVEN against claude.ai (2026-08-08)
- **Route A email/calendar** — the agent reads Gmail/Calendar via claude.ai connectors and acts through /mcp (morning-ops runbook in docs/mcp.md); NO CRM-owned sync engine

## Auth & team

- **WorkOS auth, own UI** — email+password, Google, Apple; custom login page (`authkitProxy` + custom callback); login-error banners; logout
- **Continue-as-last-account card** — brand avatar + provider icon, decode-tolerant cookie (survives the historical double-encoding)
- **Owned invite flow** — CRM-native invites (`/api/invites` + branded `/invite/<code>` accept); WorkOS user provisioned server-side, hosted screens/emails fully bypassed; Team section on /account (2026-08-03)
- **API authorization gate** — `requireApiSession()` on every `/api/*` handler; AST ratchet fails CI on an ungated route; adversarial anonymous-401 real-auth spec (2026-08-08)
- **Onboarding wizard** — welcome → workspace → profile → invite → role → interests → preferences
- **Invitation-only signup** — /signup explains the model, no self-serve account creation

## Realtime collaboration (env-gated)

- **Live data** — every write (UI, Ask, /mcp) fans out an invalidate; clients refetch (coalesced, starvation-proof)
- **Awareness** — topbar avatars, "X is here" record pill, field-claim rings, live named cursors
- **Co-edited live note** — Yjs/TipTap note per record with freeze-into-call-note; fields stay commit-based (2026-08-01)

## Misc surfaces

- **Reports** — pipeline reports reflecting live activity
- **Work board (`/work`)** — internal org-management task board on the shared Board (spaces filter, edit modal) (2026-08-06)
- **Account page** — identity, appearance (light/system/dark), Team invites, Assistant memory, subscription + usage tiles
- **Marketing i18n** — en default + `/th`, two landing variants (classic/prestige) behind a cookie toggle

## Operations (not user-facing)

- CI/CD: gates + mocked e2e + real-auth (incl. real-LLM per push) → pipeline-only Vercel deploys at the exact tested SHA; dev preview dev-crm.jurisimus.com off develop; nightly `llm-behavior.yml` drift alarm
- Nightly Neon→R2 `pg_dump` backups (restore proven); migrate-on-deploy
- Two e2e tiers: mocked (hermetic route mocks) + real-auth (real WorkOS + Postgres, the only honest place for auth claims)

## Residuals / known gaps (deferred row 27 + wishlist)

- No rate limiting anywhere; no in-app roles (every seat equal); no denied-request audit
- DR drill prepared but not run (founder-present); Neon + pasted-key rotations pending
- Cloud-routine sweep unarmed (crm connector not yet in the /schedule roster)
- Push enrollment + smoke records CRM-43/44 deletion = founder to-dos

## Cut / rejected on purpose (don't re-propose)

- **Tier-4 CRDT sync engine** — rejected permanently; fields stay commit-based, keystroke sync belongs to the live note only
- **Platform dependency** — backend swap complete 2026-07-30; zero calls to the Jurisimus platform
- **Route B CRM-owned email/calendar sync** — parked behind deferred row 17's earned trigger
- **WorkOS-hosted auth screens/emails** — everything runs through our own UI
- **Blue "AI rail" styling on the digest card** — neutral border, founder call
- **Terms-acceptance gate** — dropped for this internal tool
