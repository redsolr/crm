# Realtime collaboration — presence, live data, co-edited notes

> **What this is**: the CRM's multiplayer layer, entirely self-hosted —
> no Liveblocks/Pusher/vendor. A single Cloudflare Worker
> (`realtime/`) carries three surfaces:
>
> 1. **Live data** — any committed write (UI, Ask panel, `/mcp` agent)
>    fans out an invalidate event; every open client refetches within
>    ~a second. No refresh, ever.
> 2. **Awareness** — who's online (topbar avatars), who's viewing which
>    record ("Nan is here" pill), who holds which field (claim ring +
>    "Nan is editing…"), live named cursors on record pages.
> 3. **Co-edited live notes** — a Yjs/TipTap document per record
>    (keystroke-level, Google-Docs style, carets included). "Freeze
>    into call note" converts the shared text into a normal call note
>    and clears the pad for the next call.
>
> **Feature-gated**: with `REALTIME_URL`/`REALTIME_SECRET` unset the
> entire layer is a no-op — the app behaves exactly as before. The
> worker can be deployed (or be down) independently of the app.

## Architecture

```
crm write paths ──POST /broadcast/ws_crm──▶ CrmRoom (Durable Object)
  (bearer REALTIME_SECRET)                   │  presence roster
browser ◀─wss /room/ws_crm?token=…──────────┤  cursor relay
  (HMAC token from /api/realtime/session)    │  invalidate fan-out
browser ◀─wss /doc/:recordId?token=…──▶ YDocRoom (Durable Object)
  (y-websocket protocol, TipTap client)      one per live note,
                                             state persisted in DO
                                             storage
```

- **Worker** (`realtime/`): `CrmRoom` = one hibernated-WebSocket room
  per workspace (presence + cursors + broadcast). `YDocRoom` = one per
  co-edited doc, speaking the standard y-websocket protocol
  (y-protocols sync + awareness); merged Yjs state persists to DO
  storage on every update, so notes survive hibernation/eviction.
  Hibernation keeps an idle room at ~zero cost; both classes are
  SQLite-backed so the **Cloudflare free plan** covers them.
- **Server** (`src/server/realtime.ts`): HMAC token mint (payload.sig
  over base64url JSON, 1h TTL) + fire-and-forget `broadcastInvalidate`
  called from `insertWorkItem`, attribute upserts, work-item
  PATCH/DELETE/bulk, and ask-tools stage moves — so agent writes
  propagate live too.
- **Session door** (`GET /api/realtime/session`): session-authed; hands
  the browser its socket URL + token (204 = feature off). Under
  `MOCK_AUTH` a `crm-mock-user` cookie can differentiate test
  identities (never active in production auth).
- **Client** (`src/lib/realtime/`): one WebSocket in `CrmShell`
  (reconnect w/ backoff, 30s keepalive answered by the DO
  auto-responder without waking it), Zustand store, TanStack
  invalidation on `invalidate`. UI: `PresenceAvatarStack` (topbar),
  `RecordPresenceLayer` (pill + cursors), field claims in
  `AttributeFieldEditor`, `LiveNotePanel` (TipTap + Collaboration +
  CollaborationCaret over `y-websocket`).
- **Colors**: deterministic hash user-id → palette, computed
  independently in worker and client (`peer-color.ts` mirrors
  `colorFor` in the worker — keep in sync).

## Deploy runbook (founder, one-time)

```bash
cd D:\App\crm\realtime
npx wrangler login                      # browser OAuth into your Cloudflare account
npx wrangler deploy                     # prints https://crm-realtime.<acct>.workers.dev
npx wrangler secret put REALTIME_SECRET # paste a long random string

cd D:\App\crm                           # same secret + URL into Vercel prod
npx vercel env add REALTIME_URL production    # https://crm-realtime.<acct>.workers.dev
npx vercel env add REALTIME_SECRET production # the same secret
npx vercel --prod                       # redeploy so the env lands
```

Optional: route `rt.jurisimus.com` to the worker in the Cloudflare
dashboard and use that as `REALTIME_URL`. Rotate by changing the
secret in both places. Local dev: `npm run dev` inside `realtime/`
(uses `.dev.vars`, gitignored) + start the app with
`REALTIME_URL=http://localhost:8788 REALTIME_SECRET=<same>`.

## Conflict model (deliberate)

Record FIELDS are commit-based (blur/save) with `If-Match` optimistic
concurrency — same as Attio/Salesforce; field claims make collisions
visible before they happen, last save wins, the loser's screen
corrects within a second. Keystroke-level merging (Yjs CRDT) is used
ONLY where simultaneous writing is real: the live note. Do not add
keystroke sync to form fields.

## Tests

- `src/server/__tests__/realtime.test.ts` — token contract (payload +
  HMAC + TTL + email-local-part fallback), env gating no-op,
  record-route path parsing.
- Two-browser proofs (presence/cursors/claims/live-stage +
  co-edit/freeze/clear) run against `wrangler dev` — see the
  2026-08-01 handoff for the scripted walkthroughs.
