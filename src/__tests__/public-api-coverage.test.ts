/**
 * Public-API coverage ratchet.
 *
 * Walks every TypeScript file under `src/` and finds every platform
 * HTTP call in one of these shapes:
 *
 *   1. `fetch(\`${API_V1}/path\`, { method, ... })`  — direct fetch
 *   2. `fetch(\`${API_BASE}/path\`, { method, ... })` — direct fetch unprefixed
 *   3. `this.request("/path", { method, ... })`        — `BaseApiClient` subclass
 *   4. `this.requestUnprefixed("/path", { method })`   — same, unprefixed
 *   5. Generated-client method calls
 *      (`featureRequestsApi.v1XxxGet(...)` etc.) — recognized by import
 *      source `@/lib/generated/api`. These are public-by-construction
 *      because the generator produces them from the public spec.
 *
 * For each call, normalizes (METHOD, path) and classifies:
 *
 *   - **public_spec_match**: the path appears in `openapi/openapi.yaml`
 *     (the synced public OpenAPI spec).
 *   - **first_party_exception**: matches a structured allowlist with a
 *     written reason — currently the four documented `/auth/*` bypass
 *     routes.
 *   - **generated_client**: came through the generated OpenAPI client.
 *   - **unresolved_dynamic_path**: the call shape is recognized but the
 *     path contains an interpolation the AST can't statically resolve.
 *     Counted in the baseline so we can drive it down by adding helper
 *     patterns.
 *   - **violation**: undocumented; the call uses the platform but no
 *     public-spec or lens-map entry covers it. Captured in the baseline
 *     file as the debt record.
 *
 * Compare-against-baseline contract:
 *   - The current violation set is rendered as a stable JSON snapshot.
 *   - The baseline at
 *     `src/__tests__/__baseline__/public-api-coverage-baseline.json` is
 *     the committed debt record.
 *   - Any difference between current and baseline (new violations OR
 *     resolved violations) fails the test. Resolving a violation
 *     requires dropping it from the baseline in the same PR.
 *   - To rebuild from scratch: delete the baseline + run with
 *     `UPDATE_PUBLIC_API_BASELINE=1 npm test -- public-api-coverage`.
 *
 * This mirrors the platform's `route-policy.platform-discipline.spec.ts`
 * pattern from the customer-console hardening sweep — a baseline that
 * starts as a debt record and drains to `[]`.
 */
import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import * as ts from "typescript";
import { parse as parseYaml } from "yaml";

// ── Test config ──────────────────────────────────────────────────────────────

const REPO_ROOT = resolve(__dirname, "..", "..");
const SRC_ROOT = resolve(REPO_ROOT, "src");
const OPENAPI_PATH = resolve(REPO_ROOT, "openapi", "openapi.yaml");
const BASELINE_DIR = resolve(__dirname, "__baseline__");
const BASELINE_PATH = resolve(BASELINE_DIR, "public-api-coverage-baseline.json");

const SKIP_PATH_SEGMENTS = [
  "__tests__",
  "/generated/",
  "node_modules",
  ".next",
];

/**
 * Routes that the consumer app calls but that aren't on the public
 * OpenAPI spec — either because they're outside the /v1/ prefix
 * (auth, health), because they're per-end-user UI plumbing with no
 * external-developer analogue, because their public-lens equivalent
 * is rotted, or because they're awaiting a specific product decision
 * before promotion.
 *
 * Each entry carries a structured shape so a reviewer can answer at
 * a glance:
 *
 *   - `category` (closed enum) — what kind of exception is this?
 *   - `owner` — which team owns the keep-it-first-party decision
 *   - `reason` — freeform; explains the specific call site
 *   - `ticket_or_doc` — where the deferral / decision is recorded
 *   - `review_phase` (closed enum) — when does this get re-reviewed?
 *     - `documented_first_party` → by design; no future review needed
 *     - `awaiting_*` → blocked on a specific product decision; once
 *       that decision lands, the entry should be drained
 *
 * Two structural ratchets defend the list:
 *
 *   1. `category` and `review_phase` are closed-enum string-literal
 *      unions. Adding a new category or phase requires editing the
 *      type — TypeScript rejects unknown values at compile time.
 *   2. `APPROVED_EXCEPTION_COUNT` is hand-set. Adding an entry
 *      without bumping it fails the structure test, forcing the
 *      addition to surface in code review.
 *
 * Adding a new exception is therefore a deliberate, three-line diff
 * (the entry, the count bump, optionally a new enum member) — not a
 * silent expansion of the first-party surface.
 */

type ExceptionCategory =
  /** Mounted outside /v1/; auth/session subsystem (refresh, exchange, sessions, dev-login). */
  | "auth_subsystem"
  /** Bring-your-own-key LLM credentials — per-end-user UI feature. */
  | "byok"
  /** Per-end-user UI plumbing — favorites, layout state, presence, reminders, prefs. */
  | "per_user_ui"
  /** Composite consumer-app UX — sidebar tree, console summary, marketplace, page-trash, invite flow, in-app notifications. */
  | "consumer_app_ux"
  /** Consumer-app billing / payments / usage / subscriptions UX. */
  | "consumer_app_billing"
  /** LLM streaming + chat persistence — flagship surface awaiting public design. */
  | "llm_streaming"
  /** Mounted outside /v1/; infrastructure (LB-style health probes). */
  | "infrastructure";

type ReviewPhase =
  /** By design first-party; no future review needed. */
  | "documented_first_party";

interface FirstPartyException {
  method: string;
  path: string;
  category: ExceptionCategory;
  /** Team identifier; today: always `platform`. Reserved for when teams diverge. */
  owner: string;
  /** Freeform — explains the specific call site, including any historical context. */
  reason: string;
  /** Path to the doc that approves this exception, OR `TBD` if not yet documented. */
  ticket_or_doc: string;
  review_phase: ReviewPhase;
}

const AUDIT_DOC = "docs/platform/public-api-completeness-audit-2026-05-01.md";
const CHAT_DESIGN_DOC = "docs/platform/chat-surface-design.md";

const FIRST_PARTY_EXCEPTIONS: ReadonlyArray<FirstPartyException> = [
  // ── auth_subsystem ──────────────────────────────────────────────────
  // Mounted OUTSIDE /v1/ per the platform `setGlobalPrefix` exclude
  // list. The consumer app legitimately needs to talk to the auth
  // subsystem to maintain session state.
  {
    method: "POST",
    path: "/auth/refresh",
    category: "auth_subsystem",
    owner: "platform",
    reason: "session-token refresh; auth subsystem; outside /v1/ prefix",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/auth/workos/exchange",
    category: "auth_subsystem",
    owner: "platform",
    reason: "WorkOS code → JWT exchange; outside /v1/ prefix",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/auth/sessions",
    category: "auth_subsystem",
    owner: "platform",
    reason: "active-session count for settings UI; outside /v1/ prefix",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/auth/sessions/revoke_all",
    category: "auth_subsystem",
    owner: "platform",
    reason: "logout-everywhere from settings UI; outside /v1/ prefix",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/auth/dev/login",
    category: "auth_subsystem",
    owner: "platform",
    reason:
      "dev-only login bypass for local testing; outside /v1/ prefix; never exposed to production users",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/auth/logout",
    category: "auth_subsystem",
    owner: "platform",
    reason:
      "session invalidation from FE; auth subsystem; outside /v1/ prefix",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/auth/me",
    category: "auth_subsystem",
    owner: "platform",
    reason:
      "current-session probe (cookie auth bootstrap); auth subsystem; outside /v1/ prefix",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/auth/ws_ticket",
    category: "auth_subsystem",
    owner: "platform",
    reason:
      "Hocuspocus collaboration WebSocket auth ticket; short-lived JWT for WS handshake; auth subsystem; outside /v1/ prefix",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },

  // ── byok ────────────────────────────────────────────────────────────
  // The consumer app lets one user attach their own OpenAI/Anthropic
  // key for their own chat sessions. External developers attach
  // provider keys at the org/account level via the platform admin
  // surface, NOT via this per-user route. Same-path public-spec
  // coverage isn't appropriate.
  {
    method: "GET",
    path: "/v1/user/llm_credentials",
    category: "byok",
    owner: "platform",
    reason:
      "BYOK LLM keys; per-end-user consumer-app UI; not platform external surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/user/llm_credentials",
    category: "byok",
    owner: "platform",
    reason:
      "BYOK LLM keys; per-end-user consumer-app UI; not platform external surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/user/llm_credentials/{}/test",
    category: "byok",
    owner: "platform",
    reason:
      "BYOK LLM keys; per-end-user consumer-app UI; not platform external surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "DELETE",
    path: "/v1/user/llm_credentials/{}",
    category: "byok",
    owner: "platform",
    reason:
      "BYOK LLM keys; per-end-user consumer-app UI; not platform external surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },

  // ── per_user_ui ─────────────────────────────────────────────────────
  // Per-end-user UI plumbing — notification preferences, persisted UI
  // layout, favorites bookmarks, drag-to-arrange knowledge-graph
  // layout, reminders inbox, presence heartbeat. Personal navigation
  // aids and UI affordances; not platform-tenant capabilities.
  {
    method: "GET",
    path: "/v1/accounts/me/notification_preferences",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "per-end-user notification UI prefs; consumer-app surface, not external API",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PATCH",
    path: "/v1/accounts/me/notification_preferences",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "per-end-user notification UI prefs; consumer-app surface, not external API",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  // /v1/user_preferences/* — JWT-only consumer-app UX. Settled
  // first-party: onboarding flow + UI layout knobs are the
  // Jurisimus consumer app's own UX, not an external developer
  // surface. SaaS-builder devs build their own onboarding +
  // chrome on top of the platform primitives. The chat-surface
  // `external_user_id` pattern doesn't apply here — these
  // endpoints have no developer-facing equivalent we'd want to
  // expose, so there is no "external user API" to wait on.
  {
    method: "GET",
    path: "/v1/user_preferences/me",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "Jurisimus consumer-app per-end-user UI prefs; not externalized — devs build their own profile UX",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PUT",
    path: "/v1/user_preferences/me",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "Jurisimus consumer-app per-end-user UI prefs; not externalized — devs build their own profile UX",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/user_preferences/onboarding",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "first-run onboarding answers for the Jurisimus consumer app; SaaS-builder devs build their own onboarding",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/user_preferences/ui_layout",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "persisted left-rail / panel sizes for the consumer-app UI shell; not part of the external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PATCH",
    path: "/v1/user_preferences/ui_layout",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "persisted left-rail / panel sizes for the consumer-app UI shell; not part of the external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  // /v1/reminders/* — per-end-user productivity feature.
  {
    method: "GET",
    path: "/v1/reminders",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "consumer-app per-user reminders inbox; productivity UX, not external API",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/reminders",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "consumer-app per-user reminders create; productivity UX, not external API",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/reminders/{}",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "consumer-app per-user reminders detail; productivity UX, not external API",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PUT",
    path: "/v1/reminders/{}",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "consumer-app per-user reminders update; productivity UX, not external API",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PUT",
    path: "/v1/reminders/{}/complete",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "consumer-app reminders mark-complete; productivity UX, not external API",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PUT",
    path: "/v1/reminders/{}/uncomplete",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "consumer-app reminders mark-uncomplete; productivity UX, not external API",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "DELETE",
    path: "/v1/reminders/{}",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "consumer-app reminders delete; productivity UX, not external API",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  // /v1/favorites/* — per-end-user bookmark UX.
  {
    method: "GET",
    path: "/v1/favorites",
    category: "per_user_ui",
    owner: "platform",
    reason: "consumer-app per-user favorites list; personal navigation aid",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/favorites",
    category: "per_user_ui",
    owner: "platform",
    reason: "consumer-app per-user favorites add; personal navigation aid",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "DELETE",
    path: "/v1/favorites/{}",
    category: "per_user_ui",
    owner: "platform",
    reason: "consumer-app per-user favorites remove; personal navigation aid",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "DELETE",
    path: "/v1/favorites/target/{}",
    category: "per_user_ui",
    owner: "platform",
    reason: "consumer-app remove-favorite-by-target; personal navigation aid",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PUT",
    path: "/v1/favorites/reorder",
    category: "per_user_ui",
    owner: "platform",
    reason: "consumer-app favorites drag-reorder UX; personal navigation aid",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  // /v1/knowledge_graph/layout/* — per-user UI layout state for the
  // drag-to-arrange canvas. Persistence of UI affordance positions,
  // not platform data.
  {
    method: "GET",
    path: "/v1/knowledge_graph/layout",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "per-user knowledge-graph drag-to-arrange UI state; consumer-app affordance",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PATCH",
    path: "/v1/knowledge_graph/layout",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "per-user knowledge-graph drag-to-arrange UI state; consumer-app affordance",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "DELETE",
    path: "/v1/knowledge_graph/layout",
    category: "per_user_ui",
    owner: "platform",
    reason: "per-user knowledge-graph layout reset; consumer-app affordance",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "DELETE",
    path: "/v1/knowledge_graph/layout/nodes/{}",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "per-user knowledge-graph node-position reset; consumer-app affordance",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/presence/heartbeat",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "consumer-app presence heartbeat for active-user count; per-end-user UI plumbing",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/presence/status",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "account-menu own presence status (Active/Away + custom status); per-end-user UI plumbing",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PUT",
    path: "/v1/presence/status",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "account-menu set own availability / custom status; per-end-user UI plumbing",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/presence/statuses",
    category: "per_user_ui",
    owner: "platform",
    reason:
      "team-chat surfaces teammates' presence dots (batch status read); per-end-user UI plumbing",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },

  // ── consumer_app_ux ─────────────────────────────────────────────────
  // Composite consumer-app surfaces — invite flow, in-app notifications,
  // console-summary dashboard tile, plugin marketplace UX, page-trash
  // bin, sidebar file-system tree. External integrations build their
  // own composites from granular platform endpoints.
  {
    method: "POST",
    path: "/v1/organizations/{}/invite_links",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app team-management invite-link mint; per audit § 4.2: first-party app flow",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/organizations/{}/invite_links",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app team-management active-invite-links list (InvitePeopleModal); per audit § 4.2: first-party app flow",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "DELETE",
    path: "/v1/organizations/{}/invite_links/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app team-management invite-link revoke (InvitePeopleModal); per audit § 4.2: first-party app flow",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/invite/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app invitation acceptance landing; per audit § 4.2: first-party app flow",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/invite/{}/accept",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app invitation accept action; per audit § 4.2: first-party app flow",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/public/demo_requests",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "landing 'Request a demo' capture (B2B demo-led pivot 2026-07-06); anonymous public-write surface like /v1/public/support — not an external-integrator API",
    ticket_or_doc: "docs/platform/mission-control-spec-2026-07-06.md",
    review_phase: "documented_first_party",
  },
  // /v1/notifications/* — in-app notification inbox + Web Push.
  {
    method: "GET",
    path: "/v1/notifications",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app notification inbox list; external apps host their own notifications",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/notifications/{}/dismiss",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app dismiss-notification action; external apps host their own",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/notifications/vapid-key",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app Web Push VAPID public key; external apps host their own push system",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/notifications/push/subscribe",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app Web Push subscription registration; external apps host their own",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  // /v1/pending_actions/* — agent-write approval queue. Web-app does
  // not consume this surface; the developer-console hosts the approval
  // drawer (relocated 2026-05-28). External developers building agent
  // integrations would dispatch the handler primitives directly, not
  // through the approval-queue UX seam.
  // /v1/organizations/{}/console_summary — customer-console UX
  // composite that bundles consumer-app dashboard concerns. The 13
  // sibling org routes are on the public spec; external devs build
  // their own composites from those granular endpoints.
  {
    method: "GET",
    path: "/v1/organizations/{}/console_summary",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app customer-console landing-page composite; external devs use granular org routes",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  // /v1/plugins/* — marketplace + installation + reviews UX.
  {
    method: "GET",
    path: "/v1/plugins/marketplace",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app plugin-marketplace browse UX; not part of external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/plugins/marketplace/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app plugin-marketplace detail UX; not part of external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/plugins/installations",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app installed-plugins list UX; not part of external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/plugins/{}/install",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app install-plugin action; external integrations use their own provisioning",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "DELETE",
    path: "/v1/plugins/installations/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app uninstall-plugin action; external integrations use their own provisioning",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PUT",
    path: "/v1/plugins/installations/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app plugin-config update UX; external integrations manage their own config",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/plugins/{}/versions",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app plugin-version picker UX; external integrations pin versions directly",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/plugins/{}/reviews",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app plugin-review list UX; reviews are end-user-bound social signal",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/plugins/{}/reviews",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app plugin-review submit UX; reviews are end-user-bound social signal",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  // /v1/pages/* — page-vocabulary trash/restore/permanent/hypotheses/
  // export. The core CRUD endpoints (`/v1/pages`, `/v1/pages/{id}`,
  // `/v1/pages/{id}/move`, `/v1/pages/search`) are on the public spec;
  // these consumer-app-specific subroutes stay first-party.
  {
    method: "GET",
    path: "/v1/pages/trash",
    category: "consumer_app_ux",
    owner: "platform",
    reason: "consumer-app trash-bin view; not part of external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/pages/{}/restore",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app restore-from-trash action; not part of external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "DELETE",
    path: "/v1/pages/{}/permanent",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app permanent-delete action; not part of external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/pages/{}/hypotheses",
    category: "consumer_app_ux",
    owner: "platform",
    reason: "consumer-app hypotheses panel; bespoke research-UI surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/pages/export",
    category: "consumer_app_ux",
    owner: "platform",
    reason: "consumer-app bulk-export download; in-app UX, not external API",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  // /v1/file_system/* — sidebar tree explorer that aggregates
  // folders/pages/tasks into one tree view.
  {
    method: "GET",
    path: "/v1/file_system/nodes",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app sidebar tree (flat node list); external integrations query primitives directly",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/file_system/tree",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app sidebar tree (pre-built hierarchy); external integrations query primitives directly",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  // Chat consumer-UI organization — folder org, starring, tree-of-
  // branches view, consumer history list. Design approved (chat-
  // surface-design.md): these stay first-party while the public
  // primitives ship as `/v1/chats/*`. SaaS-builder devs build their
  // own organization metaphor on top of the public chat primitives.
  {
    method: "PUT",
    path: "/v1/chats/{}/move",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app chat folder organization; public surface uses /v1/chats/* primitives, devs build their own organization metaphor",
    ticket_or_doc: CHAT_DESIGN_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PATCH",
    path: "/v1/chats/{}/star",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app chat starring UX; personal navigation, not a chat primitive",
    ticket_or_doc: CHAT_DESIGN_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/chats/{}/tree",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-UI presentation of branch structure; computable from /v1/chats/{id}/branches by SaaS-builder devs",
    ticket_or_doc: CHAT_DESIGN_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/chats/history",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "consumer-app helper with org-/account-scoped filters; public canonical list is GET /v1/chats",
    ticket_or_doc: CHAT_DESIGN_DOC,
    review_phase: "documented_first_party",
  },
  // /v1/matter_templates/* — the Jurisimus legal-app's workspace-shared
  // matter-template manager (Matter Templates activity-bar view + the
  // New-matter dialog). First-party legal-app config UX (app-plane table);
  // external developers build their own templating on the work_item
  // primitives, so there is no external-developer equivalent to expose.
  {
    method: "GET",
    path: "/v1/matter_templates",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app matter-template list; first-party app config UX, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/matter_templates",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app matter-template create; first-party app config UX, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PATCH",
    path: "/v1/matter_templates/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app matter-template update; first-party app config UX, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PUT",
    path: "/v1/matter_templates/{}/tasks",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app matter-template starter-task spine replace; first-party app config UX, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PUT",
    path: "/v1/matter_templates/{}/questions",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app matter-template intake-question list replace; first-party app config UX (surfaced as Communications quick-questions), not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "DELETE",
    path: "/v1/matter_templates/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app matter-template delete; first-party app config UX, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  // /v1/legal/documents/* — the Jurisimus legal-app's paginated
  // court-ready document editor (app-plane `legal_documents` table;
  // ProseMirror JSON in, native OOXML/PDF export out). First-party
  // legal-app surface like matter_templates — external developers
  // build document tooling on their own storage + the platform's
  // generic primitives, so there is no external-developer equivalent.
  {
    method: "POST",
    path: "/v1/legal/documents",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app document create (Word-like editor); first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/legal/documents",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app document list; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/legal/documents/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app document read; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PUT",
    path: "/v1/legal/documents/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app document save (optimistic concurrency); first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "DELETE",
    path: "/v1/legal/documents/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app document trash; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/legal/documents/{}/export",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app court-ready DOCX/PDF export download; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  // /v1/communication_threads/* + /v1/client_tokens/* + /v1/matter_intake_jobs/*
  // — the Jurisimus legal-app's matter-intake-loop LAWYER surfaces
  // (intake inbox, matter communications panel, the Create Matter reveal;
  // matter-intake-loop spec § 4.1, slice 6). First-party legal-app UX like
  // matter_templates / legal/documents: the communications primitive is
  // projected-source platform data, but THIS consumer-app UI consuming it
  // is first-party — external developers integrate the communications API
  // directly, not through this lawyer console. The anonymous CLIENT surface
  // (`/v1/public/matter_chat/*`) is genuinely public and goes through the
  // runtime-dynamic `publicJson` helper (tracked as unresolved_dynamic_path
  // in the baseline, not here).
  {
    method: "GET",
    path: "/v1/communication_threads",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app intake inbox + matter-thread list; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/communication_threads",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app create native client thread; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/communication_threads/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app thread detail; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/communication_threads/{}/communications",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app matter communications feed; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/communication_threads/{}/communications",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app lawyer outbound reply; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/communication_threads/{}/import",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app LINE chat-export import action; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/communication_threads/{}/client_tokens",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app chat-link list (hash never returned); first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/communication_threads/{}/client_tokens",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app chat-link mint (one-time secret); first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/client_tokens/{}/revoke",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app chat-link revoke; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/communication_threads/{}/create_matter",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app Create Matter trigger (the reveal's money moment); first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/matter_intake_jobs/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app Create Matter reveal job poll (per-section progress); first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/communication_threads/{}/latest_intake_job",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app matter-context panel replay of a linked thread's latest analysis on reopen; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  // Communications activity (slice 4 of the LINE two-way arc): the
  // three-pane "Incoming chats" workspace's read surfaces — a
  // communication's inline media + the matter's document-family lineage.
  // Same first-party legal-app posture as the matter-intake block above.
  {
    method: "GET",
    path: "/v1/communications/{}/attachments",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app chat-window inline media (a communication's attachments); first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/document_families",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app matter-context panel document-family list; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/document_families/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app document-family detail (ordered immutable versions); first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  // /v1/channel_connections/* — the legal-app's self-serve "Connect a
  // channel" settings panel (multi-tenant channel-connections arc,
  // 2026-06-16). A firm (or a Jurisimus operator setting it up FOR them —
  // the white-glove first-customer onboarding) connects its own LINE OA so
  // clients message the firm and land in this workspace's intake inbox.
  // First-party app surface: external developers wire the inbound webhook +
  // communications API directly, not through this settings UI.
  {
    method: "GET",
    path: "/v1/channel_connections",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app Channels settings list; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/channel_connections",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app Connect LINE OA (token validated server-side, secrets sealed); first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/channel_connections/{}/verify",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app re-verify a connected channel's token; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "DELETE",
    path: "/v1/channel_connections/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app disconnect a channel; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  // /v1/legal/matters/{}/graph — the legal-app's matters-lab knowledge-graph
  // view (matter entity/relationship graph). First-party app surface like the
  // matters-lab findings/templates panels; external developers consume the
  // legal analysis APIs directly, not this graph visualization endpoint.
  {
    method: "GET",
    path: "/v1/legal/matters/{}/graph",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app matters-lab knowledge-graph view; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  // /v1/public/matter_chat/* — the legal-app's ANONYMOUS client chat
  // surface (matter-intake-loop spec § 4.2). Token-in-path, no auth — the
  // page a client reaches from a LINE link (`/m/<token>`). Genuinely
  // public platform routes (same anonymous class as the feature-request
  // board's public surface) but NOT part of the external-DEVELOPER OpenAPI
  // spec — they're consumed only by the Jurisimus legal-app's own client
  // page. First-party app surface; external developers integrate the
  // authed communications API, not this anonymous client UX.
  {
    method: "GET",
    path: "/v1/public/matter_chat/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app anonymous client chat: thread + messages projection; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/public/matter_chat/{}/communications",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app anonymous client inbound message; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/public/matter_chat/{}/uploads/presign",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app anonymous client attachment presign (capped); first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/public/matter_chat/{}/attachments",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "legal-app anonymous client attachment finalize; first-party app surface, not external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },

  // ── consumer_app_billing ────────────────────────────────────────────
  // Subscription / usage / billing / payments UX. End-user-bound
  // payment intents, not external-developer billing operations.
  // External developers manage subscriptions through platform admin
  // surfaces (`/v1/organizations/{id}/subscription`, the Stripe
  // portal, etc.).
  {
    method: "GET",
    path: "/v1/subscriptions/plans",
    category: "consumer_app_billing",
    owner: "platform",
    reason:
      "consumer-app plan picker UI; external billing flows go through platform admin API",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PUT",
    path: "/v1/subscriptions/{}",
    category: "consumer_app_billing",
    owner: "platform",
    reason:
      "consumer-app subscription update UX; external flows use Stripe portal / admin API",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/subscriptions/{}/cancel",
    category: "consumer_app_billing",
    owner: "platform",
    reason:
      "consumer-app cancel-subscription UX; external flows use Stripe portal / admin API",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "PUT",
    path: "/v1/subscriptions/{}/seats",
    category: "consumer_app_billing",
    owner: "platform",
    reason:
      "consumer-app seat management (seat-based pricing 2026-07-06); external flows use Stripe portal / admin API",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/usage/budget",
    category: "consumer_app_billing",
    owner: "platform",
    reason:
      "consumer-app usage budget meter; external usage via /v1/api_keys/{id}/usage",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/usage/summary",
    category: "consumer_app_billing",
    owner: "platform",
    reason:
      "consumer-app usage summary widget; external usage via /v1/api_keys/{id}/usage",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/usage/records",
    category: "consumer_app_billing",
    owner: "platform",
    reason:
      "consumer-app usage history; external usage via /v1/api_keys/{id}/usage",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/billing/overview",
    category: "consumer_app_billing",
    owner: "platform",
    reason:
      "consumer-app billing dashboard widget; external flows use Stripe portal",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/billing/pricing",
    category: "consumer_app_billing",
    owner: "platform",
    reason:
      "consumer-app pricing widget; external flows use the public Stripe pricing page",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/payments/create_checkout_session",
    category: "consumer_app_billing",
    owner: "platform",
    reason:
      "consumer-app Stripe checkout flow; not part of external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/payments/create_portal_session",
    category: "consumer_app_billing",
    owner: "platform",
    reason:
      "consumer-app Stripe portal redirect; not part of external developer surface",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },
  // /v1/plans — public pricing-page projection of `subscription_plans`.
  // Renders the marketing-site-style plan picker; the platform's
  // external-developer billing surface (subscriptions / invoices /
  // entitlements) is separate. PaaS-spec drift fix landed in `b4a2867`
  // moved the FE from `/v1/subscriptions/plans` to this public route.
  {
    method: "GET",
    path: "/v1/plans",
    category: "consumer_app_billing",
    owner: "platform",
    reason:
      "public pricing-page projection used by the consumer-app plan picker; external surface is the granular subscription endpoints",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },

  // ── llm_streaming ───────────────────────────────────────────────────
  // (no entries) — `POST /v1/chat/stream` was drained when the FE
  // migrated to `POST /v1/chats/{id}/responses` (native typed events,
  // public per chat-surface-design.md § 2). The public OpenAI-compat
  // wedge is `POST /v1/chat/completions` (chat-surface-design.md § 1).

  // ── infrastructure ──────────────────────────────────────────────────
  // /health/status — mounted OUTSIDE the /v1/ prefix. LB-style
  // probe consumed by ALB target groups + the consumer-app
  // online/offline indicator. Settled first-party: health probes
  // are infrastructure, not part of the v1 platform API surface.
  // External SDK consumers wanting a status check use a
  // status-page service (separate concern), not a versioned API
  // endpoint.
  {
    method: "GET",
    path: "/health/status",
    category: "infrastructure",
    owner: "platform",
    reason:
      "LB-style unprefixed health probe + consumer-app online/offline indicator; infrastructure surface, not part of the versioned v1 platform API",
    ticket_or_doc: AUDIT_DOC,
    review_phase: "documented_first_party",
  },

  // ── Ask-Jurisimus product support (2026-07-03) ─────────────────────
  // Vendor-facing support surfaces for the app's OWN users — never a
  // platform-API capability for external developers (a tenant's app has
  // its own support). Deliberately outside the public OpenAPI spec.
  {
    method: "GET",
    path: "/v1/support/articles",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "in-app Help deflection search over the vendor's support KB; first-party support UX, not a tenant data surface",
    ticket_or_doc: "platform docs/modules/support.md",
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/support/ask",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "in-app Help grounded support answer (vendor-paid, capped); first-party support UX",
    ticket_or_doc: "platform docs/modules/support.md",
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/support/messages",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "in-app Help 'message the team' escalation to the vendor's support inbox; first-party support UX",
    ticket_or_doc: "platform docs/modules/support.md",
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/public/support",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "anonymous landing-page support widget transport (articles/ask/messages via a shared raw-fetch helper; dynamic subpath resolves to the base); marketing-site UX, not a tenant surface",
    ticket_or_doc: "platform docs/modules/support.md",
    review_phase: "documented_first_party",
  },

  // ── Reply snippets (saved replies — Intercom macros, 2026-07-03) ────
  // First-party legal-app composer config (app-plane, like matter
  // templates) — not a platform-API capability for external developers.
  {
    method: "GET",
    path: "/v1/reply_snippets",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "workspace-shared saved replies feeding the Communications composer's `/` menu; first-party app config like matter templates",
    ticket_or_doc: "platform docs/modules/reply-snippets (parity map § Intercom)",
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/reply_snippets",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "create a saved reply from the matter panel's Saved replies card; first-party app config",
    ticket_or_doc: "platform docs/modules/reply-snippets (parity map § Intercom)",
    review_phase: "documented_first_party",
  },
  {
    method: "PATCH",
    path: "/v1/reply_snippets/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "edit a saved reply (endpoint shipped; V0 UI is add/delete — edit is console/API for now); first-party app config",
    ticket_or_doc: "platform docs/modules/reply-snippets (parity map § Intercom)",
    review_phase: "documented_first_party",
  },
  {
    method: "DELETE",
    path: "/v1/reply_snippets/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "delete a saved reply from the matter panel's Saved replies card; first-party app config",
    ticket_or_doc: "platform docs/modules/reply-snippets (parity map § Intercom)",
    review_phase: "documented_first_party",
  },

  // ── Client checklists (matter "what we need from you" lists, 2026-07-06) ──
  // First-party legal-app matter UX (app-plane, like matter templates) —
  // spec: platform docs/platform/client-checklists-spec-2026-07-06.md.
  {
    method: "GET",
    path: "/v1/matter_checklists/presets",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "in-repo checklist presets (engagement letter / KYC / retainer) offered in the matter panel's add flow; first-party legal-app UX",
    ticket_or_doc: "platform docs/platform/client-checklists-spec-2026-07-06.md",
    review_phase: "documented_first_party",
  },
  {
    method: "GET",
    path: "/v1/matter_checklists",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "list a matter's client checklists in the matter panel; first-party legal-app UX",
    ticket_or_doc: "platform docs/platform/client-checklists-spec-2026-07-06.md",
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/matter_checklists",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "create a checklist on a matter (optionally notifying the client chat); first-party legal-app UX",
    ticket_or_doc: "platform docs/platform/client-checklists-spec-2026-07-06.md",
    review_phase: "documented_first_party",
  },
  {
    method: "DELETE",
    path: "/v1/matter_checklists/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "delete a checklist from the matter panel; first-party legal-app UX",
    ticket_or_doc: "platform docs/platform/client-checklists-spec-2026-07-06.md",
    review_phase: "documented_first_party",
  },
  {
    method: "POST",
    path: "/v1/matter_checklists/{}/items",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "append an item to an existing checklist; first-party legal-app UX",
    ticket_or_doc: "platform docs/platform/client-checklists-spec-2026-07-06.md",
    review_phase: "documented_first_party",
  },
  {
    method: "PATCH",
    path: "/v1/matter_checklists/{}/items/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason:
      "lawyer marks an item complete / reopens it (completion may notify the client); first-party legal-app UX",
    ticket_or_doc: "platform docs/platform/client-checklists-spec-2026-07-06.md",
    review_phase: "documented_first_party",
  },
  {
    method: "DELETE",
    path: "/v1/matter_checklists/{}/items/{}",
    category: "consumer_app_ux",
    owner: "platform",
    reason: "delete a checklist item; first-party legal-app UX",
    ticket_or_doc: "platform docs/platform/client-checklists-spec-2026-07-06.md",
    review_phase: "documented_first_party",
  },
];

/**
 * Total approved exception count. Adding an entry to
 * `FIRST_PARTY_EXCEPTIONS` without bumping this number fails the
 * structure test, forcing the addition to surface in code review.
 *
 * Decreasing the count is also a hard signal — if a deferral resolved
 * (e.g. the chat surface design landed), drain its entries and lower
 * this number in the same PR.
 */
const APPROVED_EXCEPTION_COUNT = 134;

// ── Types ────────────────────────────────────────────────────────────────────

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface CallSite {
  file: string;
  line: number;
  shape: "fetch" | "request" | "request_unprefixed" | "generated";
  method: Method | "UNKNOWN";
  /** Normalized path with `{}` for dynamic segments, or null when unresolvable. */
  path: string | null;
}

interface Violation {
  file: string;
  line: number;
  shape: CallSite["shape"];
  method: Method | "UNKNOWN";
  path: string | null;
  classification: "violation" | "unresolved_dynamic_path";
}

interface BaselineDocument {
  version: 1;
  /**
   * One entry per current undocumented call. The ratchet diffs against
   * this on every run; baseline drift in either direction fails CI.
   */
  violations: Violation[];
}

// ── OpenAPI + lens-map loaders ────────────────────────────────────────────────

function loadPublicSpecOperations(): Set<string> {
  const yaml = readFileSync(OPENAPI_PATH, "utf-8");
  const doc = parseYaml(yaml) as {
    paths?: Record<string, Record<string, unknown>>;
  };
  const operations = new Set<string>();
  for (const [path, methods] of Object.entries(doc.paths ?? {})) {
    for (const method of Object.keys(methods)) {
      const upper = method.toUpperCase();
      if (
        upper === "GET" ||
        upper === "POST" ||
        upper === "PUT" ||
        upper === "PATCH" ||
        upper === "DELETE"
      ) {
        operations.add(`${upper} ${path}`);
      }
    }
  }
  return operations;
}

// ── File walker ──────────────────────────────────────────────────────────────

function walkSourceFiles(root: string): string[] {
  const out: string[] = [];
  function visit(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = relative(REPO_ROOT, full).replace(/\\/g, "/");
      if (SKIP_PATH_SEGMENTS.some((s) => rel.includes(s))) continue;
      const st = statSync(full);
      if (st.isDirectory()) {
        visit(full);
      } else if (
        (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
        !entry.endsWith(".d.ts")
      ) {
        out.push(full);
      }
    }
  }
  visit(root);
  return out;
}

// ── AST extraction ───────────────────────────────────────────────────────────

/**
 * Static evaluation of a fetch URL. Recognizes:
 *   - `fetch("/literal", ...)`                — string literal
 *   - `fetch(\`${API_V1}/path\`, ...)`        — template with known prefix
 *   - `fetch(\`${API_BASE}/path\`, ...)`      — same, unprefixed
 *   - `fetch(\`${API_V1}/p/${id}\`, ...)`     — interpolations → `{}`
 *   - `fetch(\`${baseUrl}/path\`, ...)`       — caller-supplied baseUrl;
 *                                               treated as `${API_V1}` (the
 *                                               only call site today is the
 *                                               chat-stream helper which
 *                                               always receives API_V1).
 *
 * Returns null when the URL can't be resolved (computed at runtime,
 * non-template expression, etc.) — the caller classifies as
 * `unresolved_dynamic_path`.
 */
/**
 * Resolve a `BaseApiClient.request("/path", ...)` first-arg expression
 * to a literal path. Subclasses pass the path WITHOUT the `/v1/`
 * prefix — the base class adds it via `${this.baseUrl}${endpoint}`.
 * Same template-literal semantics as `resolveFetchUrl` minus the
 * platform-prefix handling.
 */
function resolveBaseApiClientPath(node: ts.Expression): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) {
    let s = node.head.text;
    for (const span of node.templateSpans) {
      s += "{}";
      s += span.literal.text;
    }
    return s;
  }
  return null;
}

interface ResolvedUrl {
  /** Path after API_V1/API_BASE expansion + interpolation→`{}`. Null if unresolvable. */
  path: string | null;
  /**
   * True if the URL template includes a known platform-prefix token
   * (`${API_V1}`, `${API_BASE}`, `${baseUrl}`). Calls without one of
   * these tokens are non-platform fetches (S3 uploads, external
   * services, Next.js own API routes) and are excluded from the
   * coverage check.
   */
  isPlatformCall: boolean;
}

const NON_PLATFORM_URL: ResolvedUrl = { path: null, isPlatformCall: false };

function resolveFetchUrl(node: ts.Expression): ResolvedUrl {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    // Bare string literals are always non-platform — platform calls
    // route through API_V1 / API_BASE / baseUrl tokens.
    return NON_PLATFORM_URL;
  }
  if (ts.isTemplateExpression(node)) {
    let s = node.head.text;
    let isPlatformCall = false;
    for (const span of node.templateSpans) {
      const exprText = identifierName(span.expression);
      if (exprText === "API_V1" || exprText === "baseUrl") {
        s += "/v1";
        isPlatformCall = true;
      } else if (exprText === "API_BASE") {
        // No prefix — `${API_BASE}/auth/refresh` becomes `/auth/refresh`.
        isPlatformCall = true;
      } else {
        s += "{}";
      }
      s += span.literal.text;
    }
    if (!isPlatformCall) return NON_PLATFORM_URL;
    return { path: s, isPlatformCall: true };
  }
  // `new URL(template, base?)` — common pattern when the caller wants
  // a URL builder for `searchParams.set(...)`. Recurse on the first
  // arg using the same template-resolution logic so platform-prefix
  // tokens still register.
  //
  //   const url = new URL(`${API_V1}/public/${slug}/feature_requests`);
  //   url.searchParams.set("page_size", "100");
  //   await fetch(url.toString(), { ... });
  //
  // Without this branch the walker would silently drop these as
  // non-platform — a real ratchet blind spot flagged by GPT.
  if (
    ts.isNewExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "URL" &&
    node.arguments !== undefined &&
    node.arguments.length >= 1
  ) {
    return resolveFetchUrl(node.arguments[0]);
  }
  // `url.toString()` — when the FE builds a URL via `new URL(...)` and
  // hands the stringified version to fetch. The CallExpression's
  // expression is `url.toString` (PropertyAccessExpression). The
  // outer recursion via resolveFetchPath() looks up `url` in the
  // scope stack, so we just unwrap `.toString()` here.
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "toString"
  ) {
    return resolveFetchUrl(node.expression.expression);
  }
  // Computed expressions (member access, etc.) we can't statically
  // resolve. Conservatively treat as non-platform — a real platform
  // call would have built the URL via one of the known prefix tokens.
  return NON_PLATFORM_URL;
}

function identifierName(expr: ts.Expression): string | null {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return null;
}

/**
 * Extract the `method` property from an options-object argument like
 * `{ method: "POST", body: ..., headers: ... }`. Defaults to `GET`
 * (browser fetch default) when the property is absent.
 */
function resolveMethod(optionsArg: ts.Expression | undefined): Method {
  if (optionsArg === undefined) return "GET";
  if (!ts.isObjectLiteralExpression(optionsArg)) return "GET";
  for (const prop of optionsArg.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      ts.isIdentifier(prop.name) &&
      prop.name.text === "method" &&
      (ts.isStringLiteral(prop.initializer) ||
        ts.isNoSubstitutionTemplateLiteral(prop.initializer))
    ) {
      return prop.initializer.text.toUpperCase() as Method;
    }
  }
  return "GET";
}

/**
 * Normalize a resolved URL/path to its OpenAPI-template shape:
 *   - drop query string
 *   - strip ${API_V1} / ${API_BASE} prefixes if any leaked through
 *   - replace `{}` placeholders with `{id}`-style names by reading the
 *     OpenAPI spec at lookup time (we keep `{}` here; matcher does the
 *     normalization on the spec side)
 */
function normalizePath(path: string): string {
  // Drop query string.
  const noQuery = path.split("?")[0];
  // Strip trailing `{}` when it isn't a path-segment placeholder. The
  // walker emits `{}` for every interpolation it can't statically
  // resolve, including conditional query-string suffixes like
  // `\`/v1/foo${query ? '?' + query : ''}\``. Without this strip, those
  // come out as `/v1/foo{}` and look like a violation against the spec
  // entry `/v1/foo`. The convention here: if `{}` is at the end of the
  // path AND the previous character is not `/`, treat it as a
  // query-string-shaped interpolation and drop it. A real path-segment
  // placeholder is always preceded by `/` (`/v1/foo/{}`).
  return noQuery.replace(/(?<!\/)\{\}$/, "");
}

/**
 * Convert an OpenAPI path like `/v1/notes/{id}` to the matcher shape
 * `/v1/notes/{}`. Path-param names don't matter for equivalence.
 */
function specPathToMatcherShape(specPath: string): string {
  return specPath.replace(/\{[^}]+\}/g, "{}");
}

// ── Walker ───────────────────────────────────────────────────────────────────

interface FileScan {
  file: string;
  isGeneratedClientImport: boolean;
  callSites: CallSite[];
}

function scanFile(filePath: string): FileScan {
  const text = readFileSync(filePath, "utf-8");
  const sf = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const callSites: CallSite[] = [];
  let isGeneratedClientImport = false;

  // Scope stack for resolving identifier first-args back to their const
  // initializer. The walker handles the common pattern in API-client
  // wrappers:
  //
  //   const endpoint = `/search/graph/entities/${encodeURIComponent(id)}`;
  //   await this.request<unknown>(endpoint, { method: "GET" });
  //
  // Without scope tracking, the walker would classify the call as
  // `unresolved_dynamic_path` because `endpoint` is an Identifier, not
  // a string/template literal. Tracking same-scope `const` declarations
  // lets us recurse through one level of indirection. Cycle-safe via
  // depth limit. Only tracks `const` (semantically immutable).
  const scopeStack: Array<Map<string, ts.Expression>> = [new Map()];

  function lineOf(node: ts.Node): number {
    return sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  }

  function lookupConst(name: string): ts.Expression | undefined {
    for (let i = scopeStack.length - 1; i >= 0; i--) {
      const found = scopeStack[i].get(name);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  function resolveRequestPath(
    arg: ts.Expression,
    depth: number,
  ): string | null {
    if (depth > 3) return null;
    const direct = resolveBaseApiClientPath(arg);
    if (direct !== null) return direct;
    if (ts.isIdentifier(arg)) {
      const init = lookupConst(arg.text);
      if (init !== undefined) return resolveRequestPath(init, depth + 1);
    }
    return null;
  }

  function resolveFetchPath(arg: ts.Expression, depth: number): ResolvedUrl {
    if (depth > 3) return NON_PLATFORM_URL;
    const direct = resolveFetchUrl(arg);
    if (direct.path !== null || direct.isPlatformCall) return direct;
    if (ts.isIdentifier(arg)) {
      const init = lookupConst(arg.text);
      if (init !== undefined) return resolveFetchPath(init, depth + 1);
    }
    return NON_PLATFORM_URL;
  }

  function visit(node: ts.Node): void {
    // Detect imports from the generated client. Files that import from
    // `@/lib/generated/api` get their generated-client method calls
    // tagged as public-by-construction.
    if (ts.isImportDeclaration(node)) {
      const mod =
        ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text;
      if (typeof mod === "string" && mod.startsWith("@/lib/generated/api")) {
        isGeneratedClientImport = true;
      }
    }

    // Push a fresh scope on function-like boundaries so a `const url`
    // in one helper doesn't bleed into a sibling helper. Pop after
    // descent.
    const isFunctionLike =
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node);
    if (isFunctionLike) {
      scopeStack.push(new Map());
    }

    // Track `const X = <init>` in the current scope. Walker visits
    // top-to-bottom so by the time we hit a call site, every const
    // declared above it in the same scope is in the map.
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      scopeStack[scopeStack.length - 1].set(
        node.name.text,
        node.initializer,
      );
    }

    if (ts.isCallExpression(node)) {
      // Shape 1+2: fetch(url, options?)
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "fetch"
      ) {
        if (node.arguments[0] === undefined) {
          ts.forEachChild(node, visit);
          if (isFunctionLike) scopeStack.pop();
          return;
        }
        const resolved = resolveFetchPath(node.arguments[0], 0);
        // Skip non-platform fetches entirely (uploads to S3, external
        // services, Next.js own API routes). These don't go through
        // the platform contract.
        if (!resolved.isPlatformCall) {
          ts.forEachChild(node, visit);
          if (isFunctionLike) scopeStack.pop();
          return;
        }
        const method = resolveMethod(node.arguments[1]);
        callSites.push({
          file: relative(REPO_ROOT, filePath).replace(/\\/g, "/"),
          line: lineOf(node),
          shape: "fetch",
          method,
          path: resolved.path === null ? null : normalizePath(resolved.path),
        });
      }
      // Shape 3+4: this.request / this.requestUnprefixed
      else if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
        (node.expression.name.text === "request" ||
          node.expression.name.text === "requestUnprefixed")
      ) {
        if (node.arguments[0] === undefined) {
          ts.forEachChild(node, visit);
          if (isFunctionLike) scopeStack.pop();
          return;
        }
        // BaseApiClient.request paths are always platform calls — the
        // class is the platform-call wrapper. Resolve the URL with a
        // synthetic API_V1/API_BASE prefix depending on which method.
        const isUnprefixed = node.expression.name.text === "requestUnprefixed";
        const path = resolveRequestPath(node.arguments[0], 0);
        const method = resolveMethod(node.arguments[1]);
        callSites.push({
          file: relative(REPO_ROOT, filePath).replace(/\\/g, "/"),
          line: lineOf(node),
          shape: isUnprefixed ? "request_unprefixed" : "request",
          method,
          path:
            path === null
              ? null
              : isUnprefixed
                ? normalizePath(path) // path already starts with `/auth/...`
                : normalizePath(`/v1${path}`),
        });
      }
    }

    ts.forEachChild(node, visit);

    if (isFunctionLike) {
      scopeStack.pop();
    }
  }

  visit(sf);
  return { file: relative(REPO_ROOT, filePath), isGeneratedClientImport, callSites };
}

// ── Classifier ───────────────────────────────────────────────────────────────

interface ClassifierContext {
  /** Set of `${METHOD} ${matcher-normalized public-spec path}`. */
  publicSpecMatcherKeys: Set<string>;
  exceptionMatcherKeys: Set<string>;
}

function buildClassifierContext(): ClassifierContext {
  const publicSpecOperations = loadPublicSpecOperations();
  const publicSpecMatcherKeys = new Set<string>();
  for (const op of publicSpecOperations) {
    const [method, path] = op.split(" ");
    publicSpecMatcherKeys.add(`${method} ${specPathToMatcherShape(path)}`);
  }
  const exceptionMatcherKeys = new Set<string>(
    FIRST_PARTY_EXCEPTIONS.map(
      (e) => `${e.method} ${specPathToMatcherShape(e.path)}`,
    ),
  );
  return {
    publicSpecMatcherKeys,
    exceptionMatcherKeys,
  };
}

/**
 * Map a call site to one of: pass / unresolved / violation.
 *
 * - Generated-client calls are NOT inspected here — the file-level
 *   `isGeneratedClientImport` flag already excluded them upstream.
 * - `requestUnprefixed` paths are matched against the exception list
 *   directly (they don't carry the `/v1/` prefix).
 * - `request` and `fetch` paths are matched against the public spec
 *   first, then the exception list as a fallback (the auth-sessions
 *   exceptions actually go through `requestUnprefixed`, but
 *   recognizing them here too costs nothing).
 */
function classifyCallSite(
  site: CallSite,
  ctx: ClassifierContext,
): "pass" | "unresolved" | "violation" {
  if (site.path === null) return "unresolved";

  const matcherPath = specPathToMatcherShape(site.path);
  const key = `${site.method} ${matcherPath}`;

  if (ctx.publicSpecMatcherKeys.has(key)) return "pass";
  if (ctx.exceptionMatcherKeys.has(key)) return "pass";

  return "violation";
}

// ── Baseline I/O ─────────────────────────────────────────────────────────────

function loadBaseline(): BaselineDocument {
  if (!existsSync(BASELINE_PATH)) {
    return { version: 1, violations: [] };
  }
  return JSON.parse(readFileSync(BASELINE_PATH, "utf-8")) as BaselineDocument;
}

function writeBaseline(doc: BaselineDocument): void {
  if (!existsSync(BASELINE_DIR)) {
    mkdirSync(BASELINE_DIR, { recursive: true });
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + "\n", "utf-8");
}

function violationKey(v: Violation): string {
  return `${v.file}:${v.line} ${v.shape} ${v.method} ${v.path ?? "<unresolved>"}`;
}

function sortViolations(vs: Violation[]): Violation[] {
  return [...vs].sort((a, b) => violationKey(a).localeCompare(violationKey(b)));
}

// ── The test ────────────────────────────────────────────────────────────────

describe("Public API coverage ratchet", () => {
  it("matches the committed baseline", () => {
    const ctx = buildClassifierContext();
    const files = walkSourceFiles(SRC_ROOT);

    const violations: Violation[] = [];
    for (const file of files) {
      const scan = scanFile(file);
      // Skip files that exclusively import the generated client +
      // make calls through it. We don't extract those calls — they're
      // public-by-construction.
      if (scan.callSites.length === 0) continue;
      for (const site of scan.callSites) {
        const verdict = classifyCallSite(site, ctx);
        if (verdict === "pass") continue;
        violations.push({
          file: site.file,
          line: site.line,
          shape: site.shape,
          method: site.method,
          path: site.path,
          classification:
            verdict === "unresolved" ? "unresolved_dynamic_path" : "violation",
        });
      }
    }

    const sorted = sortViolations(violations);

    if (process.env.UPDATE_PUBLIC_API_BASELINE === "1") {
      writeBaseline({ version: 1, violations: sorted });
      console.log(
        `[public-api-coverage] wrote baseline with ${sorted.length} entries to ${relative(REPO_ROOT, BASELINE_PATH)}`,
      );
      return;
    }

    const baseline = loadBaseline();
    const baselineSorted = sortViolations(baseline.violations);

    const currentKeys = new Set(sorted.map(violationKey));
    const baselineKeys = new Set(baselineSorted.map(violationKey));

    const newViolations = sorted.filter((v) => !baselineKeys.has(violationKey(v)));
    const resolvedViolations = baselineSorted.filter(
      (v) => !currentKeys.has(violationKey(v)),
    );

    if (newViolations.length > 0 || resolvedViolations.length > 0) {
      const lines: string[] = [];
      if (newViolations.length > 0) {
        lines.push(
          `\n${newViolations.length} NEW violation(s) — consumer-app code introduced platform calls not covered by the public spec or exception list:\n`,
        );
        for (const v of newViolations) {
          lines.push(`  + ${violationKey(v)}`);
        }
        lines.push(
          "\nFix options: (a) the call has a public-spec equivalent — adjust the URL; (b) the route should be in the public spec — register the path publicly in the platform; (c) the route is intentionally first-party — add a structured FIRST_PARTY_EXCEPTIONS entry with a written reason.",
        );
      }
      if (resolvedViolations.length > 0) {
        lines.push(
          `\n${resolvedViolations.length} baseline entry(ies) NO LONGER VIOLATE — drain them from ${relative(REPO_ROOT, BASELINE_PATH)} in this same PR:\n`,
        );
        for (const v of resolvedViolations) {
          lines.push(`  - ${violationKey(v)}`);
        }
        lines.push(
          "\nQuick path: re-run with `UPDATE_PUBLIC_API_BASELINE=1 npm test -- public-api-coverage` to regenerate the baseline.",
        );
      }
      throw new Error(lines.join("\n"));
    }
  });
});

// Structural ratchet on FIRST_PARTY_EXCEPTIONS. Three checks:
//
//   1. Count gate — adding an entry without bumping
//      APPROVED_EXCEPTION_COUNT fails. Forces the addition into the
//      diff a reviewer sees.
//   2. Required-field gate — `reason`, `ticket_or_doc`, and `owner`
//      must be non-empty. The TypeScript types make them required but
//      not non-empty; runtime check closes the gap.
//   3. Closed-enum gate — belt-and-suspenders runtime check that
//      `category` and `review_phase` only carry values from the
//      declared unions. Defends against a future `as`-cast that would
//      bypass compile-time enforcement.
describe("FIRST_PARTY_EXCEPTIONS structure", () => {
  it("matches the approved exception count", () => {
    expect(FIRST_PARTY_EXCEPTIONS.length).toBe(APPROVED_EXCEPTION_COUNT);
  });

  it("every entry has non-empty reason, ticket_or_doc, and owner", () => {
    const errors: string[] = [];
    for (const entry of FIRST_PARTY_EXCEPTIONS) {
      const tag = `${entry.method} ${entry.path}`;
      if (entry.reason.trim().length === 0) {
        errors.push(`${tag}: empty reason`);
      }
      if (entry.ticket_or_doc.trim().length === 0) {
        errors.push(`${tag}: empty ticket_or_doc`);
      }
      if (entry.owner.trim().length === 0) {
        errors.push(`${tag}: empty owner`);
      }
    }
    expect(errors).toEqual([]);
  });

  it("category and review_phase are within the declared closed enums", () => {
    const validCategories = new Set<ExceptionCategory>([
      "auth_subsystem",
      "byok",
      "per_user_ui",
      "consumer_app_ux",
      "consumer_app_billing",
      "llm_streaming",
      "infrastructure",
    ]);
    const validReviewPhases = new Set<ReviewPhase>([
      "documented_first_party",
    ]);
    const errors: string[] = [];
    for (const entry of FIRST_PARTY_EXCEPTIONS) {
      const tag = `${entry.method} ${entry.path}`;
      if (!validCategories.has(entry.category)) {
        errors.push(`${tag}: unknown category "${entry.category}"`);
      }
      if (!validReviewPhases.has(entry.review_phase)) {
        errors.push(`${tag}: unknown review_phase "${entry.review_phase}"`);
      }
    }
    expect(errors).toEqual([]);
  });
});
