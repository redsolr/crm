# Terms-acceptance gate — web-app half (2026-07-12)

> Design authority: `platform/docs/legal/terms-acceptance-gate-spec-2026-07-11.md`
> (§ 4 API contract, § 6 UX, § 10 rollout). Platform implementation map:
> `platform/docs/modules/terms.md`.

## ⚠️ DEPLOY-ORDERING CONSTRAINT

**The platform gate (platform commits `9e954eb2` + `60328be7`, branch
`seat-billing`) and this web-app half MUST ride the same deploy.** The
platform 403s every authenticated `/v1/*` call until acceptance; a
WorkOS-authenticated user has no dev bypass — deployed without this
half's `/accept-terms` screen they are locked out with no way to accept.
Deployed the other way round (web-app first) is safe: the gate screens
simply never trigger against an ungated platform (`/accept-terms`
redirects straight to the app when `acceptance_required` is false).

Rollout gate beyond that: no external account may be gated against
`1.0.0-draft` text — counsel-reviewed `1.0.0` (or a signed pilot
instrument recorded via Mission Control) precedes any external user
(spec § 10).

## What ships in this half

| Piece | Where |
| --- | --- |
| 403 interceptor | `src/lib/api-client.ts` + `src/lib/chat/stream.ts` → `notifyTermsGate403()` (`src/lib/terms/gate-events.ts`) dispatches `terms:acceptance-required` (full gate) or `terms:ai-ack-required` (ai_ack-only 403) |
| Redirect listener + modal host | `src/components/terms/TermsGateListener.tsx`, `AiAckModalHost.tsx` — mounted in `src/app/layout.tsx` |
| Full-screen gate | `src/app/accept-terms/` — owner/member checkbox variants, three key-terms cards, hold screen (`blocked_on_owner`), 409 `terms_version_stale` re-render, EN/TH toggle, sign-out as the only other exit |
| First-AI-use modal | Proactive `ensureAiAcknowledged()` (`src/stores/ai-ack.store.ts`) before chat sends + the 403-event fallback for every other AI surface |
| Persistent AI disclaimer | `src/components/terms/AiDisclaimer.tsx` under the chat input (`ChatBox`) |
| `/legal/terms` · `/legal/privacy` · `/legal/cookies` | Platform drafts rendered verbatim with a DRAFT watermark (`src/lib/terms/legal-content.ts` — GENERATED from `platform/docs/legal/drafts/`); old `/terms`, `/privacy` redirect |
| Demo-request privacy notice | `DemoRequestForm` — notice-not-consent line + `/legal/privacy` link (spec § 6.4) |

## Copy fidelity (load-bearing)

The platform records a SHA-256 `presentation_hash` of the exact copy the
screen rendered. `src/lib/terms/presentations.ts` mirrors the platform's
`TERMS_PRESENTATIONS` verbatim, and
`src/__tests__/terms-presentations.test.ts` recomputes the joined
presentation strings and compares them to the platform's pinned hashes —
cross-repo copy drift is a failing unit test. When the platform revs the
copy: update `presentations.ts`, re-pin the hashes from
`presentationHashFor()`, and regenerate `legal-content.ts` from the new
drafts — one reviewed change.

## Tests

- Unit: `terms-presentations.test.ts` (hash drift), `terms-gate-events.test.ts` (403 fan-out routing).
- Mocked e2e: `e2e/terms-gate.spec.ts` (redirect, can't-skip, owner/member wording, hold screen, stale re-render, ai_ack modal, disclaimer); `e2e/marketing-pages.spec.ts` (/legal pages + redirects). The auth fixture defaults `GET /v1/terms/status` to the fully-accepted state so unrelated suites stay green.
- Integration e2e: `e2e/terms-gate.integration.spec.ts` — dev-login with `skip_terms_acceptance: true` walks the REAL gate: 403 → accept (ledger rows) → ai_ack modal → mock-LLM answer.

## Dev: seeing the gate again after accepting

The ledger is append-only **by database grant** — there is no "reset my
acceptance" and there must never be one. Three sanctioned paths:

1. **View the screen again** (copy/design review — the usual need):
   `/accept-terms?preview=1` renders the live gate regardless of
   acceptance state; `?preview=1&variant=member` shows the member
   wording, `?preview=hold` the owner-hold screen. A repeat accept in
   preview is a server-side idempotent no-op (`recorded: false`).
2. **Exercise the full 403 flow**: throwaway dev login —
   `POST /auth/dev/login` with a fresh email +
   `skip_terms_acceptance: true` (what `e2e/terms-gate.integration.spec.ts`
   does per run). Nothing to clean up.
3. **Re-gate existing accounts** (the product mechanism): a new platform
   registry revision with `reacceptanceRequired` — this is what ships
   with the counsel-approved 1.0.0 text.

## Not this arc

Cookie consent banner (PDPA consent-separation — must never share the
ToS checkbox), the upcoming-version notice banner (registry has a single
revision today), marketing-consent flows, mobile acceptance UI.
