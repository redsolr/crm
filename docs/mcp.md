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
| Auth | `Authorization: Bearer $CRM_MCP_TOKEN` |

The public `/mcp` URL is a rewrite (next.config.ts) of the physical
route `src/app/api/mcp/[transport]/route.ts` (mcp-handler's layout).

## Auth

Static bearer token in the `CRM_MCP_TOKEN` env var (Vercel prod +
`.env.local`). Unset ⇒ the endpoint answers 401 to everything —
closed-by-default, never open. Rotate by changing the value and
redeploying. If the endpoint ever serves third parties, upgrade to
OAuth (mcp-handler ships `withMcpAuth` + RFC 9728 protected-resource
metadata) — a static secret is the internal-tool posture, not the
multi-tenant one.

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
`complete_commitment`. Until the founder pushes/deploys this build,
prod serves only the original six tools — the poller falls back to
`find_crm_record` for discovery and leaves completion to the founder's
inbox tick.

## Connect from Claude Code

```
claude mcp add -s user -t http crm https://crm.jurisimus.com/mcp \
  --header "Authorization: Bearer <CRM_MCP_TOKEN>"
```

## Tests

`src/server/__tests__/mcp-route.test.ts` — auth contract (401 without /
with wrong / with no configured token) + tools/list serving every
ask-tool.
