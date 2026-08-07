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

WorkOS-side prerequisites for the OAuth door (dashboard → the crm
Staging environment, or the WorkOS MCP in an interactive session):
**dynamic client registration enabled**
(`isAuthkitDynamicClientRegistrationEnabled`) and the resource URIs
registered via `setAuthkitOauthResources`
(`https://crm.jurisimus.com/mcp`, `https://dev-crm.jurisimus.com/mcp`,
`http://localhost:3100/mcp`). Until both are set, OAuth clients can't
complete the flow; the service token keeps working regardless.

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

### Arming the poller (runbook, 2026-08-07)

The durable poller is a **scheduled Claude Code cloud routine**
(claude.ai → Code → Routines). Cloud agents reach the CRM only through
a claude.ai MCP connector — never by embedding `CRM_MCP_TOKEN` in a
prompt. One founder-interactive step gates it:

1. **Connect the CRM as a claude.ai connector** (Settings →
   Connectors → Add custom connector →
   `https://crm.jurisimus.com/mcp`, sign in with your CRM seat). If
   registration fails, complete the two WorkOS-side residuals first
   (§ Auth above: enable dynamic client registration + register the
   OAuth resources).
2. **Create the routine** (`/schedule` in any Claude Code session, or
   claude.ai/code/routines): daily around 08:00 Bangkok (01:00 UTC),
   CRM connector attached, no repo needed. Prompt:

   > Poll the CRM for delegated work: call
   > `list_commitments(query: "Claude:", status: "open")`. For each
   > result, do what the title instructs IF it is doable with the CRM
   > tools + web research alone (research a firm, draft outreach,
   > summarize pipeline state, enrich records). Write results back
   > with `log_call_note` on the same parent record, then
   > `complete_commitment` with a short completion note. If an
   > instruction needs code, deploys, local files, or anything outside
   > those bounds, leave it OPEN and log a call note explaining what
   > is missing. Never push, deploy, or touch anything outside the
   > CRM. If there are no `Claude:` commitments, end quietly.

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
