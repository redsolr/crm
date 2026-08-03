# Design brief — org-management pivot (wishlist item 6)

> **Status: DESIGN, no code** — the triage marked this "dedicated
> design session BEFORE code" because it re-frames the product
> identity, not because it is technically hard.

## The ask (CEO, 2026-08-03)

"Actually make it become the org management idea that we have
initially — all the Linear shit in our web app, now it is here, and
we can use this CRM to do everything with Jurisimus."

## Why it is technically small

The substrate IS Linear-shaped already: `records` (work items) +
record types + workflows + attribute definitions + views + comments +
activities + realtime invalidation. A "run Jurisimus here" surface is
roughly: an `ops` workspace with a task template (`task` type,
`todo → in_progress → in_review → done` workflow, priority/assignee
attributes), a per-workspace-type sidebar (Tasks/Projects instead of
Pipeline/Inbox), and the existing board/table components pointed at
the new type. The Claude↔tasks loop (item 4) plugs straight in —
tasks become the delegation channel instead of overloading sales
commitments.

## The actual decision — product identity

| Option | What | Cost | Risk |
| --- | --- | --- | --- |
| A. Workspace-type switch in THIS app | `ops` workspace next to the CRM workspaces; sidebar adapts per type | ~2 sessions | Muddies "CRM = separate venture" narrative; internal tool scope-creep |
| B. New venture repo from the starter (venture doctrine: one app, one repo) | Copy class-room-shape starter; port board/table | Days; duplicated plumbing | Two internal tools to run; slower |
| C. Defer — keep using CRM commitments for the Claude loop only | Nothing new | 0 | "Linear shit" ask unmet |

**Recommendation: A**, with one guard — the `ops` workspace is
flagged internal-only (never in demos, excluded from reports), so the
external CRM-venture story stays clean while we dogfood org
management on the substrate. If the org-management surface ever finds
its own market, THEN option B (extract as its own venture) applies —
same play as splitting a backend on the second consumer.

## Needs from the founder before code

1. Pick A / B / C (recommendation: A).
2. If A: name the first workspace (`Jurisimus Ops`?) and the v1 task
   fields (priority? assignee? project grouping?).
3. Confirm tasks-for-Claude move from commitments to `task` records
   once this ships (the poller then filters on assignee=Claude
   instead of a title prefix).
