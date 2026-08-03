# Design brief — personal notes (wishlist item 5)

> **Status: DESIGN, no code.** Founder review needed on the two
> decisions at the bottom; everything else is settled by the
> substrate.

## The ask (CEO, 2026-08-03)

"Very to take personal note and can share in with other while can let
ai able to use it as well" — quick personal notes, shareable with
teammates, and usable as AI grounding.

## Shape on the substrate

- **`note` record type** (memory workflow: `active` / `archived`),
  optional `parent_id` to any record — a note can be free-standing or
  attached to a deal/company.
- **Body = TipTap doc** — the live-note editor infra from the
  realtime arc is reusable as-is (solo editing works without the
  worker; co-editing lights up wherever REALTIME_URL is configured).
- **`visibility` attribute**: `private` (default) | `shared`.
  - `private` = author-only. This is the CRM's FIRST per-user data —
    every list/search/AI query needs an actor-aware filter
    (`visibility = shared OR created_by_id = actor`). One seam in
    the work-items list path covers UI + search + AI.
  - `shared` = every seat reads it.
- **AI grounding**: a `search_notes` ask-tool with the same
  actor-aware filter — the Ask assistant grounds on shared notes plus
  the ASKING user's private notes, never on someone else's private
  notes. The `/mcp` door (agent actor) sees shared notes only.
- **UI**: "Notes" entry in the sidebar Records section; list + editor
  panel; share toggle in the note header; notes attached to a record
  also surface on that record's timeline rail.

## Estimate

One focused session: type + seed, actor-filter seam, list/editor UI,
share toggle, `search_notes` tool, jest + mocked e2e + a real-auth
two-seat visibility spec (adversarial: teammate must NOT see my
private note — testing-discipline pattern).

## Founder decisions needed

1. **Private notes as AI grounding for their author** — recommended
   YES (the Ask panel acts on your behalf), but it means the
   assistant's answers differ per asking user. OK?
2. **Team-visibility granularity** — v1 proposes binary
   private/shared (every seat). Per-person sharing waits until a
   real second teammate exists. OK?
