# MCP server — agent access to the CRM

> **What this is**: the CRM's Model Context Protocol endpoint. Any MCP
> client (Claude Code, Claude Desktop, Cursor, …) can read and write
> the pipeline directly — the same six tools the in-app Ask panel
> uses. This is the programmatic door for agent-driven data entry
> (bulk seeding, enrichment, call-note logging) — the Attio-style
> surface, sized for an internal tool.

## Endpoint

| | |
| --- | --- |
| URL (prod) | `https://crm.jurisimus.com/mcp` |
| URL (local dev) | `http://localhost:3100/mcp` |
| Transport | Streamable HTTP (stateless; no SSE, no Redis) |
| Auth | OAuth 2.1 (AuthKit) **or** `Authorization: Bearer $CRM_MCP_TOKEN` |

The public `/mcp` URL is a rewrite (next.config.ts) of the physical
route `src/app/api/mcp/[transport]/route.ts` (mcp-handler's layout).

## Auth — remote-MCP posture (2026-08-06)

Two doors, both verified by `src/server/mcp-auth.ts`; neither env set
⇒ everything 401s (closed-by-default, never open):

1. **OAuth 2.1 (the Cloudflare/Vercel shape).** The server is an
   OAuth *resource server*; our WorkOS **AuthKit** environment is the
   *authorization server* (`WORKOS_AUTHKIT_DOMAIN`, e.g.
   `https://tuneful-labyrinth-88-staging.authkit.app`). Discovery is
   standard: a 401 carries `WWW-Authenticate` pointing at
   `/.well-known/oauth-protected-resource/mcp` (RFC 9728), which names
   the authorization server; clients dynamically register (RFC 7591),
   run the PKCE code flow through the AuthKit login/consent screens,
   and present the resulting access token. Verification is strict:
   JWKS signature, issuer, expiry, and the **RFC 8707 audience
   binding** — the token must be minted for THIS deployment's
   resource (`NEXT_PUBLIC_APP_URL` + `/mcp`); tokens for another
   resource or with no resource binding are rejected. Writes stamp
   the **real authenticated user** as actor (WHO-wrote doctrine).
   Sessions honor AuthKit revocation/expiry (`accessTokenExpiry`).
2. **Service token.** Static bearer in `CRM_MCP_TOKEN` (Vercel prod +
   `.env.local`) — CI and the founder's long-lived `claude mcp`
   registration. Writes stamp `Claude (agent)`, unchanged. Rotate by
   changing the value and redeploying.

WorkOS-side prerequisites for the OAuth door — **DONE 2026-08-07 via
the WorkOS MCP** (crm Staging env): dynamic client registration
enabled (`isAuthkitDynamicClientRegistrationEnabled: true`, verified)
and the resource URIs registered via `setAuthkitOauthResources`
(`https://crm.jurisimus.com/mcp` = default, plus
`https://dev-crm.jurisimus.com/mcp` and `http://localhost:3100/mcp`).
OAuth clients (claude.ai connectors, Cursor, …) can now complete the
full DCR + PKCE flow; the service token keeps working regardless.

## Tools

The registry is `src/server/ask-tools.ts` — single source of truth
shared with the Ask panel. The route adapts the existing JSON-schema
definitions to the SDK's Standard Schema shape mechanically; adding a
tool there publishes it here with no route change.

| Tool | What it does |
| --- | --- |
| `find_crm_record` | Resolve accounts/contacts/opportunities/call notes/commitments by name or id |
| `create_account` | New company record (dedupe-checked) |
| `create_opportunity` | New pipeline deal under an account |
| `update_opportunity` | Stage moves + attribute updates |
| `log_call_note` | Call note linked to its account/opportunity |
| `create_commitment` | A promise made to a firm — lands in the Inbox, ranked by due date |
| `list_commitments` | List commitments by status / title / due window — soonest due first |
| `complete_commitment` | Mark a commitment done or dropped, with an optional timeline note |

## Delegated-work loop (Claude ↔ CRM)

Commitments double as a founder→agent task channel: create a
commitment titled `Claude: <instruction>` (any record — the `Claude
Ops` account exists for tasks that belong to no deal), and a scheduled
Claude Code session polls `list_commitments(query: "Claude:")`, does
the work, replies with `log_call_note` on the same parent, and calls
`complete_commitment`. Prod serves the full 8-tool registry (incl. the
commitment tools) since the 2026-08-07 modern-UI deploy.

### Morning-ops routine (runbook, 2026-08-07 — Route A locked)

Founder decision 2026-08-07: email/calendar reaches the CRM through
the AGENT, not a CRM-owned sync engine ("Route A"). The agent reads
Gmail/Calendar via claude.ai connectors and acts through this /mcp
door; the in-app timeline shows its trail (every write is
agent-attributed). A CRM-owned sync worker ("Route B", Attio-shape
thread→timeline) stays behind the earned-connector trigger.

One **scheduled Claude Code cloud routine** carries the whole loop —
delegated commitments + inbox sweep + calendar prep. Cloud agents get
capabilities only through claude.ai connectors — never by embedding
`CRM_MCP_TOKEN` or Google credentials in a prompt. Founder-interactive
gate (one trip to claude.ai → Settings → Connectors):

1. **Connect three connectors**: Gmail, Google Calendar, and the CRM
   (Add custom connector → `https://crm.jurisimus.com/mcp`, sign in
   with your CRM seat). The ops mailbox is **jadoreran@gmail.com**
   (founder call 2026-08-07) — Gmail/Calendar connect under that
   account, never the infra root. The WorkOS-side prerequisites (DCR
   + resource registration) are DONE (§ Auth above), so the custom
   connector's OAuth flow completes end-to-end.
   STATUS 2026-08-07 (late): **all three connected** — Gmail ✓ +
   Calendar ✓ + crm ✓ (the custom connector completed the full
   DCR + PKCE + AuthKit flow and lists all 8 tools; per-tool
   permissions default to "Needs approval" — reads like
   `find_crm_record` / `list_commitments` are safe to set
   always-allow, keep writes on approval until trust is earned).
   The INTERACTIVE loop is fully runnable in any claude.ai chat.
   The routine-side connector roster still reports EMPTY — web-type
   connectors do not (yet) propagate to Claude Code cloud routines,
   so the caveat below is LIVE for SCHEDULED runs only: run the loop
   interactively until the connectors appear on the Code surface.
2. **Create the routine** (`/schedule` in any Claude Code session, or
   claude.ai/code/routines): daily **06:30 Bangkok (23:30 UTC)** — 30
   minutes BEFORE the digest cron, so the 07:00 digest already
   reflects the agent's writes. All three connectors attached, no
   repo needed. Prompt:

   > You are the CRM morning-ops agent. Do these three sweeps, then
   > end quietly.
   >
   > 1. DELEGATED WORK: call
   >    `list_commitments(query: "Claude:", status: "open")`. Execute
   >    each instruction IF doable with CRM tools + web research +
   >    Gmail drafting alone (research a firm, draft outreach,
   >    summarize pipeline state, enrich records). Write results back
   >    with `log_call_note` on the same parent, then
   >    `complete_commitment` with a short note. If an instruction
   >    needs code, deploys, or anything beyond those bounds, leave it
   >    OPEN and log a call note saying what is missing.
   > 2. INBOX: search Gmail for messages from the last 24h that match
   >    pipeline companies or contacts (resolve with
   >    `find_crm_record`). For each relevant thread: log the exchange
   >    with `log_call_note` on the matching opportunity or account
   >    (quote only what is needed); if a firm replied to outreach,
   >    move the stage with `update_opportunity` (e.g. contacted →
   >    replied); if a promise with a date was made in either
   >    direction, `create_commitment`. When a reply is clearly
   >    needed, CREATE A GMAIL DRAFT — never send.
   > 3. CALENDAR: read today's Google Calendar. For each meeting that
   >    matches a pipeline firm, log a prep note on its opportunity:
   >    recent activity summary, open commitments, and 2-3 suggested
   >    talking points.
   >
   > Hard rules: never send email (drafts only); never delete
   > anything anywhere; never touch systems other than the CRM tools,
   > Gmail, and Calendar; if a sweep finds nothing, skip it silently.
   > Skip any email that looks personal or non-pipeline — when in
   > doubt, leave it alone and do not log it.

CAVEAT (unverified from a cockpit session): connector availability
inside SCHEDULED cloud runs. If the routine can't see the Gmail /
Calendar connectors at runtime, fall back to running the same prompt
from an interactive session each morning while keeping the routine
for the CRM-only sweep (1).

## Connect from Claude Code

OAuth (interactive — sign in with your CRM seat when prompted):

```
claude mcp add -s user -t http crm https://crm.jurisimus.com/mcp
```

Service token (headless — CI, schedulers):

```
claude mcp add -s user -t http crm https://crm.jurisimus.com/mcp \
  --header "Authorization: Bearer <CRM_MCP_TOKEN>"
```

Other OAuth-capable clients (claude.ai connectors, Cursor, …): paste
`https://crm.jurisimus.com/mcp` — discovery does the rest.

## Tests

`src/server/__tests__/mcp-route.test.ts` — route contract (401 +
WWW-Authenticate discovery challenge, service token accepted,
closed-by-default) · `mcp-auth.test.ts` — token verification
(signature/issuer/expiry/audience binding, actor mapping) ·
`mcp-metadata-route.test.ts` — RFC 9728 metadata document.
