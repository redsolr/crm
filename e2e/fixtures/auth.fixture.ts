/**
 * Playwright fixture providing an authenticated page.
 *
 * Strategy:
 * 1. addInitScript injects JWT into localStorage BEFORE any page JS runs
 * 2. Route handlers intercept auth API calls (WorkOS exchange, /auth/me)
 * 3. Additional handlers intercept sidebar/background API calls with empty data
 *
 * Requires: MOCK_AUTH=true on the dev server to bypass WorkOS auth.
 *
 * URL discipline (2026-05-22):
 *   Every platform API call goes through `BaseApiClient` with
 *   `baseUrl = ${API_BASE}/api`. Mocks MUST intercept with the `/api/`
 *   prefix or `page.route` will silently never match. Previously these
 *   mocks lived at `${API_BASE}/<path>` (no `/api/`) which made the entire
 *   mock layer dead — tests were passing on empty-state UI because the
 *   FE's real fetches hit nothing.
 *
 *   Routes outside `/api/` (per `platform/src/main.ts` exclude list):
 *   `/auth/*`, `/oauth/*`, `/.well-known/*`, `/mcp/*`,
 *   `/payments/webhooks/*`, `/subscriptions/webhook/*`,
 *   `/collaboration`, `/health`, `/health/*`. Use `API_BASE` directly
 *   for those.
 */

import { test as base, Page } from "@playwright/test";
import { TEST_USER, TEST_TOKEN, API_BASE, API_ROOT } from "../handlers/shared";
import { setupAuthHandlers } from "../handlers/auth.handlers";
import { setupUsageHandlers } from "../handlers/usage.handlers";

export const test = base.extend<{
  authedPage: Page;
}>({
  // Playwright's fixture callback is conventionally named `use`, but that
  // name trips `react-hooks/rules-of-hooks` (React 19's `use()` hook), so
  // it's bound as `provide` here — same positional argument, no suppression.
  authedPage: async ({ page }, provide) => {
    // Forward browser console + page errors to the Node test output so
    // failing specs surface the underlying client error without a manual
    // `page.evaluate()` round-trip. Cheap to keep on permanently.
    page.on("console", (msg) => {
      const t = msg.type();
      if (t === "error" || t === "warning") {
        console.log(`[browser:${t}] ${msg.text()}`);
      }
    });
    page.on("pageerror", (err) => {
      console.log(`[browser:pageerror] ${err.message}`);
    });

    // Inject token + user data into localStorage before any page JS runs.
    // E2EAuthInit component reads these to hydrate the Zustand auth store.
    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem("friendly_fortnight_token", token);
        localStorage.setItem("e2e-auth-user", JSON.stringify(user));
        // Set dark theme for workspace pages
        localStorage.setItem("jurisimus-theme", "dark");
      },
      { token: TEST_TOKEN, user: TEST_USER },
    );

    // ------------------------------------------------------------------
    // HERMETIC TRIPWIRE — registered FIRST so every later (more specific)
    // route wins; Playwright matches last-registered-first and cascades
    // here only via `route.fallback()`. Any /api/* request that NO handler
    // mocked used to silently hit the real backend at :8080 — green when a
    // dev server happened to be running, random connection-refused "flakes"
    // when it wasn't. Now it fails LOUDLY with the offending path so the
    // missing handler is a 30-second fix instead of a phantom flake hunt.
    // (599 — outside the api-client's 401-refresh / 429 / 503 retry paths.)
    // ------------------------------------------------------------------
    await page.route(
      (url) => url.pathname.startsWith("/api/"),
      async (route, request) => {
        const path = new URL(request.url()).pathname;
        const msg =
          `UNMOCKED ${request.method()} ${path} reached the e2e tripwire — ` +
          `the mocked tier is hermetic; add a handler for this route.`;
        console.error(`[e2e:unmocked-route] ${msg}`);
        await route.fulfill({
          status: 599,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "e2e_unmocked_route", message: msg },
          }),
        });
      },
    );

    // ------------------------------------------------------------------
    // Default-safe responses for background fetches the tripwire surfaced
    // on 2026-06-12 — these previously leaked to the real backend. Shapes
    // mirror each client's parser; specs that need richer data register
    // their own (later-wins) handlers.
    // ------------------------------------------------------------------
    const emptyJson = (body: unknown) => ({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
    const emptyCursorPage = {
      data: [],
      has_more: false,
      next_page_url: null,
      previous_page_url: null,
    };
    // Collaboration WS tickets — the workspace-presence hook mints one
    // per connection attempt. The mocked tier has no WebSocket backend,
    // so answer 503: the hook is fail-soft (goes dormant, no retry
    // storm) and presence UI renders nothing — which is also its
    // correct solo-user state. The integration tier exercises the real
    // mint + socket (presence.integration.spec.ts).
    await page.route(
      (url) => url.pathname === "/auth/ws_ticket",
      async (route) => {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "collab_unavailable" } }),
        });
      },
    );
    // Legal findings panel (matters lab) — `FindingListSchema` → `{findings}`.
    await page.route(`${API_ROOT}/legal/findings**`, async (route, request) => {
      if (request.method() !== "GET") return route.fallback();
      await route.fulfill(emptyJson({ findings: [] }));
    });
    // Matter templates picker.
    await page.route(`${API_ROOT}/matter_templates**`, async (route, request) => {
      if (request.method() !== "GET") return route.fallback();
      await route.fulfill(emptyJson({ matter_templates: [] }));
    });
    // LLM budget indicator (camelCase per-module exception).
    await page.route(`${API_ROOT}/usage/budget**`, async (route, request) => {
      if (request.method() !== "GET") return route.fallback();
      await route.fulfill(
        emptyJson({
          totalCostCents: 0,
          budgetCents: 999_900,
          budgetRemainingCents: 999_900,
          percentUsed: 0,
          withinBudget: true,
          planType: "team",
        }),
      );
    });
    // Usage summary widget — client accepts `UsageSummary | null`.
    await page.route(`${API_ROOT}/usage/summary**`, async (route, request) => {
      if (request.method() !== "GET") return route.fallback();
      await route.fulfill(emptyJson(null));
    });
    // Saved views list — `{ data: SavedView[] }`.
    await page.route(`${API_ROOT}/views**`, async (route, request) => {
      if (request.method() !== "GET") return route.fallback();
      await route.fulfill(emptyJson({ data: [] }));
    });
    // Seat invites (account → Team section) — `{ data: SeatInvite[] }`.
    await page.route(`${API_ROOT}/invites**`, async (route, request) => {
      if (request.method() !== "GET") return route.fallback();
      await route.fulfill(emptyJson({ data: [] }));
    });
    // Agent memories (account → Assistant memory section).
    await page.route(`${API_ROOT}/memories**`, async (route, request) => {
      if (request.method() !== "GET") return route.fallback();
      await route.fulfill(emptyJson({ data: [], enabled: true }));
    });
    // Realtime session mint — env-off behavior is 204 (layer renders
    // nothing); every page load fetches it, and before this handler the
    // tripwire 599'd it on every spec (fail-soft, but pure log noise).
    await page.route(
      (url) => url.pathname === "/api/realtime/session",
      async (route, request) => {
        if (request.method() !== "GET") return route.fallback();
        await route.fulfill({ status: 204 });
      },
    );
    // Communication threads LIST — the matters explorer's communications
    // tree background-fetches this on views that never registered the
    // matter-intake handlers (tripwire hit 2026-07-10, matters-lab spec).
    // Exact-pathname + GET-only: POSTs, subpaths (`/:id/communications`),
    // and richer data still come from `setupMatterIntakeHandlers`
    // (later-wins) or fall through to the tripwire.
    await page.route(
      (url) => url.pathname === "/api/communication_threads",
      async (route, request) => {
        if (request.method() !== "GET") return route.fallback();
        await route.fulfill(emptyJson(emptyCursorPage));
      },
    );
    // Reply snippets (saved replies for the `/` palette) — background-fetched
    // by the communications composer; the hook degrades gracefully so the
    // tripwire hit (2026-07-10) never failed a test, but hermetic means
    // hermetic. `list()` parses `{ data: ReplySnippet[] }`.
    await page.route(
      (url) => url.pathname === "/api/reply_snippets",
      async (route, request) => {
        if (request.method() !== "GET") return route.fallback();
        await route.fulfill(emptyJson({ data: [] }));
      },
    );
    // Matter checklists + presets — background-fetched by the matter panel
    // (client-checklists arc); same graceful-degrade class as reply
    // snippets (tripwire hits 2026-07-10). Both parse `{ data: [] }`.
    await page.route(
      (url) =>
        url.pathname === "/api/matter_checklists" ||
        url.pathname === "/api/matter_checklists/presets",
      async (route, request) => {
        if (request.method() !== "GET") return route.fallback();
        await route.fulfill(emptyJson({ data: [] }));
      },
    );
    // Work-items list (AIP-158 cursor page).
    await page.route(`${API_ROOT}/work_items**`, async (route, request) => {
      const isList =
        request.method() === "GET" &&
        new URL(request.url()).pathname === "/api/work_items";
      if (!isList) return route.fallback();
      await route.fulfill(emptyJson(emptyCursorPage));
    });

    // Set up auth API route handlers (these live under /auth/*, NOT /api/)
    await setupAuthHandlers(page);
    await setupUsageHandlers(page);

    // ------------------------------------------------------------------
    // Background fetches that fire on every authenticated page load.
    // Default to empty/safe responses; specific specs that need richer
    // data layer additional `page.route` calls AFTER this fixture runs
    // — Playwright uses last-registered-wins for matching globs.
    // ------------------------------------------------------------------

    // Chat history sidebar
    await page.route(`${API_ROOT}/chats**`, async (route, request) => {
      // Only intercept LIST calls here — specific chat ops are mocked
      // by chat.handlers.ts in tests that need them.
      const u = new URL(request.url());
      const isList =
        request.method() === "GET" &&
        u.pathname === "/api/chats" &&
        !u.pathname.endsWith("/messages");
      if (isList) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [],
            has_more: false,
            next_page_url: null,
            previous_page_url: null,
          }),
        });
        return;
      }
      await route.fallback();
    });

    // Findings list (top-bar)
    await page.route(`${API_ROOT}/findings**`, async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [],
            has_more: false,
            next_page_url: null,
            previous_page_url: null,
          }),
        });
        return;
      }
      await route.fallback();
    });

    // Notifications (right-sidebar bell). `GET /api/notifications`
    // returns a bare array `AppNotification[]` per
    // `notificationsApi.getNotifications()`, NOT the cursor envelope.
    await page.route(`${API_ROOT}/notifications**`, async (route, request) => {
      const u = new URL(request.url());
      if (request.method() === "GET" && u.pathname === "/api/notifications") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
        return;
      }
      // vapid-key + push subscribe are POSTs / specific subpaths;
      // tests that exercise them mock further down the stack.
      if (
        request.method() === "GET" &&
        u.pathname === "/api/notifications/vapid-key"
      ) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ publicKey: "test-vapid-public-key" }),
        });
        return;
      }
      await route.fallback();
    });

    // Account-scoped sub-resources (members, folders) — empty defaults
    await page.route(
      `${API_ROOT}/accounts/*/folders**`,
      async (route) =>
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [],
            has_more: false,
            next_page_url: null,
            previous_page_url: null,
          }),
        }),
    );
    await page.route(
      `${API_ROOT}/accounts/*/members**`,
      async (route) =>
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [],
            has_more: false,
            next_page_url: null,
            previous_page_url: null,
          }),
        }),
    );

    // Presence heartbeat
    await page.route(`${API_ROOT}/presence/heartbeat**`, async (route) => {
      await route.fulfill({ status: 204 });
    });

    // Collaboration websocket ticket — the mocked tier has no Hocuspocus
    // server, so refuse the ticket: `use-collaboration` then falls back to
    // single-editor mode IMMEDIATELY (initialContent + REST autosave) and
    // editor specs see deterministic content instead of an empty Yjs doc.
    // The integration tier doesn't install this route, so real collab is
    // exercised end-to-end there.
    await page.route(
      (url) => url.pathname === "/auth/ws_ticket",
      async (route) => {
        await route.fulfill({ status: 503 });
      },
    );

    // Model selector
    await page.route(`${API_ROOT}/chat/models**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models: [
            {
              id: "gpt-5-nano",
              display_name: "GPT-5 Nano",
              provider: "openai",
              context_window: 128000,
              description: "Fast and efficient",
            },
            {
              id: "gpt-5-mini",
              display_name: "GPT-5 Mini",
              provider: "openai",
              context_window: 128000,
              description: "Balanced performance",
            },
            {
              id: "gpt-5",
              display_name: "GPT-5",
              provider: "openai",
              context_window: 128000,
              description: "Most capable",
            },
          ],
        }),
      });
    });

    // Workspaces (workspace rename arc 2026-05-27): default to a single
    // `Default` workspace per the post-rename platform's bootstrap
    // shape. Hooks that read `useAppContextStore.currentWorkspace`
    // (sales bundle workflows/types, labels list, etc.) wire-call
    // against this id; if no workspace is returned here, those
    // queries stay disabled and UI fails to render.
    //
    // Suite-specific handlers that mount BEFORE this fallback (e.g.
    // `setupWorkspaceHandlers`) take precedence — Playwright runs
    // `page.route` registrations LIFO.
    await page.route(`${API_ROOT}/workspaces**`, async (route, request) => {
      const u = new URL(request.url());
      // Only intercept the top-level list — let
      // `/api/workspaces/{id}/...` resource calls (labels, workflows,
      // work_item_types) fall through to handler-specific mocks.
      //
      // Envelope is `{ workspaces: [...] }` (NOT `{ data: [...] }`) per
      // platform openapi.yaml WorkspaceListResponse (post 2026-05-27
      // workspace rename arc; see workspace-shape-spec-2026-05-27.md).
      if (u.pathname === "/api/workspaces") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            workspaces: [
              {
                id: "ws-e2e-default",
                organization_id:
                  TEST_USER.organization_id ?? "org-e2e-001",
                key: "DEF",
                name: "Default",
                metadata: {},
                // Both modules on, so every mocked suite sees its
                // surface (org-level gating has its own spec).
                module_keys: ["legal", "sales"],
                expires_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          }),
        });
        return;
      }
      await route.fallback();
    });

    // Favorites list (left sidebar)
    await page.route(`${API_ROOT}/favorites**`, async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [],
            has_more: false,
            next_page_url: null,
            previous_page_url: null,
          }),
        });
        return;
      }
      await route.fallback();
    });

    // Organizations the caller belongs to (organization-switcher source)
    await page.route(
      `${API_ROOT}/accounts/me/organizations**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                id: TEST_USER.organization_id ?? "org-e2e-001",
                name: TEST_USER.organization_name ?? "Test Org",
                slug: "test-org",
                role: TEST_USER.role,
              },
            ],
            has_more: false,
            next_page_url: null,
            previous_page_url: null,
          }),
        });
      },
    );

    // GET /api/accounts/me - caller identity (some app paths fetch this
    // in addition to the layout-injected store hydration).
    await page.route(`${API_ROOT}/accounts/me`, async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            account: {
              id: TEST_USER.account_id ?? TEST_USER.user_id,
              email: TEST_USER.email,
              full_name: TEST_USER.full_name,
              avatar_url: TEST_USER.avatar_url ?? null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          }),
        });
        return;
      }
      await route.fallback();
    });

    // GET /api/accounts/:id - generic account fetch used by Settings's
    // UsageSection (`accountApiClient.getAccount`). The FE reads
    // `allowOverage` (camelCase) off the response object.
    // Registered AFTER `/accounts/me` so the more-specific matcher wins
    // via Playwright's LIFO ordering.
    await page.route(
      (url) =>
        /^\/api\/accounts\/[^/]+$/.test(url.pathname) &&
        !url.pathname.endsWith("/me"),
      async (route, request) => {
        if (request.method() !== "GET") {
          await route.fallback();
          return;
        }
        const id =
          request.url().split("/api/accounts/")[1]?.split(/[?/]/)[0] ?? "";
        const now = new Date().toISOString();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id,
            email: TEST_USER.email,
            full_name: TEST_USER.full_name,
            avatar_url: TEST_USER.avatar_url ?? null,
            allow_overage: false,
            allowOverage: false,
            created_at: now,
            updated_at: now,
          }),
        });
      },
    );

    // GET /api/accounts/:id/overage_settings + PATCH variants - Settings >
    // Usage tab. Returns the overage toggle's current state.
    await page.route(
      (url) =>
        /^\/api\/accounts\/[^/]+\/overage_settings?$/.test(url.pathname) ||
        /^\/api\/accounts\/[^/]+\/(?:overage|allow_overage)$/.test(
          url.pathname,
        ),
      async (route) =>
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            allow_overage: false,
            allowOverage: false,
          }),
        }),
    );

    // GET /api/organizations/:id/usage/summary - org-level usage tile.
    // Matches `OrganizationUsageSummary` in src/lib/platformApi.ts.
    await page.route(
      (url) =>
        /^\/api\/organizations\/[^/]+\/usage\/summary$/.test(url.pathname),
      async (route, request) => {
        const orgId =
          request.url().split("/api/organizations/")[1]?.split("/")[0] ?? "";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            organization_id: orgId,
            budget: {
              total_cost_cents: 10_000,
              budget_cents: 100_000,
              budget_remaining_cents: 90_000,
              percent_used: 10,
              within_budget: true,
              plan_type: "team",
              period_start: new Date(
                Date.now() - 15 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              period_end: new Date(
                Date.now() + 15 * 24 * 60 * 60 * 1000,
              ).toISOString(),
            },
            windows: [
              {
                key: "session",
                label: "Session (5hr)",
                hours: 5,
                spent_cents: 800,
                cap_cents: 20_000,
                percent_used: 4,
                within_cap: true,
                resets_at: new Date(
                  Date.now() + 3 * 60 * 60 * 1000,
                ).toISOString(),
              },
              {
                key: "weekly",
                label: "Weekly (7 day)",
                hours: 168,
                spent_cents: 6_000,
                cap_cents: 50_000,
                percent_used: 12,
                within_cap: true,
                resets_at: new Date(
                  Date.now() + 2 * 24 * 60 * 60 * 1000,
                ).toISOString(),
              },
            ],
            projected_exhaustion_at: null,
            usage: { token_count: 50_000, total_cost_cents: 10_000 },
            by_api_key: [],
          }),
        });
      },
    );

    // GET /api/organizations/:id/subscription - org subscription wrap
    await page.route(
      (url) =>
        /^\/api\/organizations\/[^/]+\/subscription$/.test(url.pathname),
      async (route, request) => {
        const orgId =
          request.url().split("/api/organizations/")[1]?.split("/")[0] ?? "";
        const now = new Date().toISOString();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            subscription: {
              id: `sub-${orgId}`,
              plan_type: "team",
              status: "active",
              billing_interval: "month",
              seat_count: 1,
              price_cents: 89000,
              currency: "THB",
              current_period_start: new Date(
                Date.now() - 15 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              current_period_end: new Date(
                Date.now() + 15 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              trial_end: null,
              usage_mode: "inference_included",
              canceled_at: null,
              ended_at: null,
              created_at: now,
              updated_at: now,
            },
            organization: { id: orgId },
          }),
        });
      },
    );

    // GET /api/accounts/me/usage/summary - account-level consolidated usage.
    await page.route(
      `${API_ROOT}/accounts/me/usage/summary`,
      async (route) =>
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            account_id: TEST_USER.account_id ?? TEST_USER.user_id,
            organizations_count: 1,
            consolidated: { token_count: 50_000, total_cost_cents: 10_000 },
            by_organization: [
              {
                organization_id: TEST_USER.organization_id ?? "org-e2e-001",
                name: TEST_USER.organization_name ?? "Test Org",
                token_count: 50_000,
                total_cost_cents: 10_000,
                period_start: new Date(
                  Date.now() - 15 * 24 * 60 * 60 * 1000,
                ).toISOString(),
                period_end: new Date(
                  Date.now() + 15 * 24 * 60 * 60 * 1000,
                ).toISOString(),
              },
            ],
          }),
        }),
    );


    // Workspace rename arc (2026-05-27): no `/api/projects*`,
    // `/api/projects/:id/envs`, `/api/projects/:id/settings`, or
    // `/api/accounts/me/envs` mocks — the `project` + `env` primitives
    // were retired. The sole grouping/isolation boundary is `workspace`
    // (`/api/workspaces`, mocked above). Tenancy is the JWT-bound
    // workspace (or a `Jurisimus-Workspace-Id` override); there is no
    // env switcher.

    // GET/PATCH /api/accounts/me/notification_preferences - settings >
    // notifications. Returns the boolean toggle state for safety-net
    // emails. Default everything ON.
    await page.route(
      `${API_ROOT}/accounts/me/notification_preferences`,
      async (route) =>
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            email_on_spend_alert: true,
            email_on_failed_webhook: true,
            email_on_rotated_key: true,
          }),
        }),
    );

    // GET/PUT /api/user_preferences/me - user preferences envelope
    // `{ data: UserPreferences | null }`.
    await page.route(
      `${API_ROOT}/user_preferences/me`,
      async (route) =>
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: null }),
        }),
    );

    // GET /api/organizations/:id/usage/breakdown - usage drill-down by group
    await page.route(
      (url) =>
        /^\/api\/organizations\/[^/]+\/usage\/breakdown$/.test(url.pathname),
      async (route) =>
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [],
            group_by: "project",
            period_start: new Date(
              Date.now() - 15 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            period_end: new Date(
              Date.now() + 15 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          }),
        }),
    );

    // GET /api/api_keys/:id/usage - per-key usage history
    await page.route(
      (url) => /^\/api\/api_keys\/[^/]+\/usage$/.test(url.pathname),
      async (route) =>
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [],
            total_cents: 0,
            total_input_tokens: 0,
            total_output_tokens: 0,
            period_start: new Date(
              Date.now() - 15 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            period_end: new Date(
              Date.now() + 15 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          }),
        }),
    );

    // GET /api/api_keys - empty default
    await page.route(`${API_ROOT}/api_keys`, async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [],
            has_more: false,
            next_page_url: null,
            previous_page_url: null,
          }),
        });
        return;
      }
      await route.fallback();
    });

    // GET /api/events - empty Stripe-style developer events
    await page.route(`${API_ROOT}/events**`, async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [],
            has_more: false,
            next_page_url: null,
            previous_page_url: null,
          }),
        });
        return;
      }
      await route.fallback();
    });

    // GET /api/audit_logs - empty audit log list
    await page.route(`${API_ROOT}/audit_logs**`, async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [],
            has_more: false,
            next_page_url: null,
            previous_page_url: null,
          }),
        });
        return;
      }
      await route.fallback();
    });

    // GET /api/request_logs - customer-facing API health
    await page.route(`${API_ROOT}/request_logs**`, async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [],
            has_more: false,
            next_page_url: null,
            previous_page_url: null,
          }),
        });
        return;
      }
      await route.fallback();
    });

    // GET /api/plans - public pricing catalog. Returns `SubscriptionPlan[]`
    // bare array (no envelope) per subscriptionsApi.getPlans(). Seat-based
    // catalog (docs/platform/seat-based-pricing-2026-07-06.md): exactly two
    // rows — free (AI locked) + team (per-seat price, pooled AI allowance).
    // THB-first: `currency: 'THB'`, seat prices in satang (฿890/mo,
    // ฿8,900/yr); the LLM allowance stays USD cents (metering currency).
    await page.route(`${API_ROOT}/plans`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "splan_free",
            plan_type: "free",
            name: "Free",
            description: "Unpaid state — full app access, AI locked.",
            currency: "THB",
            seat_price_monthly_cents: 0,
            seat_price_yearly_cents: 0,
            seat_monthly_llm_budget_cents: 0,
            max_workspaces: 1,
            features: ["Matters, tasks, notes, documents", "No AI allowance"],
            sort_order: 0,
          },
          {
            id: "splan_team",
            plan_type: "team",
            name: "Team",
            description: "Every module, per seat.",
            currency: "THB",
            seat_price_monthly_cents: 89000,
            seat_price_yearly_cents: 890000,
            seat_monthly_llm_budget_cents: 1500,
            max_workspaces: null,
            features: [
              "Everything, for every seat (bundled)",
              "Generous AI allowance, pooled firm-wide",
            ],
            sort_order: 1,
          },
        ]),
      });
    });

    // GET /api/webhooks/portal - returns redirect URL for Svix portal
    await page.route(
      `${API_ROOT}/webhooks/portal`,
      async (route) =>
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ url: "https://example.com/webhooks-portal" }),
        }),
    );

    // GET /api/billing/overview — drives `useUsageDisplayQuery` (the
    // billing-overview rollup with per-model breakdown). Matches the
    // `BillingOverview` shape in `src/lib/usageApi.ts`. Individual
    // specs can override with `setupBillingMocks` / `setupUsageTabMocks`
    // for richer fixtures; this is the safe default.
    await page.route(`${API_ROOT}/billing/overview**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accountId: TEST_USER.account_id,
          periodStart: new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          periodEnd: new Date().toISOString(),
          totalCost: 5.42,
          totalInputTokens: 110000,
          totalOutputTokens: 40000,
          recordCount: 42,
          byModel: [
            {
              modelId: "claude-haiku",
              inputTokens: 80000,
              outputTokens: 20000,
              totalCost: 2.1,
              recordCount: 30,
            },
            {
              modelId: "claude-sonnet",
              inputTokens: 30000,
              outputTokens: 20000,
              totalCost: 3.32,
              recordCount: 12,
            },
          ],
        }),
      });
    });

    // GET /api/organizations - bare array `Organization[]` per the
    // platform's OrganizationsListResponse (no envelope). The `**`
    // glob below is intentionally narrowed by pathname so the same
    // handler doesn't catch /api/organizations/:id/{subscription,members},
    // which need their own shapes.
    await page.route(`${API_ROOT}/organizations**`, async (route, request) => {
      const u = new URL(request.url());
      if (request.method() !== "GET") {
        await route.fallback();
        return;
      }
      const now = new Date().toISOString();

      if (u.pathname === "/api/organizations") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: TEST_USER.organization_id ?? "org-e2e-001",
              name: TEST_USER.organization_name ?? "Test Org",
              slug: "test-org",
              logo_url: null,
              account_id: TEST_USER.account_id ?? TEST_USER.user_id,
              created_at: now,
              updated_at: now,
            },
          ]),
        });
        return;
      }

      const singleOrg = u.pathname.match(/^\/api\/organizations\/([^/]+)$/);
      if (singleOrg !== null) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            organization: {
              id: singleOrg[1],
              name: TEST_USER.organization_name ?? "Test Org",
              slug: "test-org",
              logo_url: null,
              account_id: TEST_USER.account_id ?? TEST_USER.user_id,
              created_at: now,
              updated_at: now,
            },
          }),
        });
        return;
      }

      // /api/organizations/:id/subscription - fall through to the
      // dedicated envelope handler registered above (`{ subscription,
      // organization }` with the seat-based SubscriptionResponseDto
      // shape). This glob is registered later so it would otherwise
      // shadow that route with a stale non-envelope body.
      if (/^\/api\/organizations\/[^/]+\/subscription$/.test(u.pathname)) {
        await route.fallback();
        return;
      }

      // /api/organizations/:id/members - team-page list. The FE
      // `teamApi.getAccountMembers` returns `AccountMember[]` (bare
      // array, no envelope) — match that shape.
      if (/^\/api\/organizations\/[^/]+\/members$/.test(u.pathname)) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: "mem-e2e-001",
              user_id: TEST_USER.user_id,
              account_id: TEST_USER.account_id ?? TEST_USER.user_id,
              user_email: TEST_USER.email,
              user_full_name: TEST_USER.full_name,
              avatar_url: TEST_USER.avatar_url ?? null,
              role: TEST_USER.role,
              is_active: true,
              created_at: now,
              updated_at: now,
            },
          ]),
        });
        return;
      }

      await route.fallback();
    });

    // GET /api/chats/history - chat sidebar history. The FE Zod schema
    // ChatHistoryResponseSchema requires `{ chats, total, grouped }`.
    await page.route(
      `${API_ROOT}/chats/history**`,
      async (route) =>
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ chats: [], total: 0, grouped: {} }),
        }),
    );

    // GET /api/plugins/installations - empty installed list.
    // Response shape per pluginsApi.getInstalled():
    // `{ data: [{ installation, plugin }] }`.
    await page.route(
      `${API_ROOT}/plugins/installations**`,
      async (route) =>
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [] }),
        }),
    );

    // GET /api/models — chat model selector (models.store fetches this
    // directly via raw fetch, not BaseApiClient, but the URL still
    // lives under /api/).
    await page.route(`${API_ROOT}/models**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models: [
            {
              id: "gpt-5-nano",
              display_name: "GPT-5 Nano",
              provider: "openai",
              context_window: 128000,
              description: "Fast and efficient",
            },
            {
              id: "gpt-5-mini",
              display_name: "GPT-5 Mini",
              provider: "openai",
              context_window: 128000,
              description: "Balanced performance",
            },
            {
              id: "gpt-5",
              display_name: "GPT-5",
              provider: "openai",
              context_window: 128000,
              description: "Most capable",
            },
          ],
        }),
      });
    });

    // GET/PATCH /api/user_preferences/ui_layout — ui-layout +
    // activity-bar store hydrate. Wire shape is snake_case, mirroring
    // `UiLayoutResponseDto` (`{ data: { v: 1, panel_widths?: {...},
    // activity_bar?: { order, hidden } } }`); the FE Zod validates the
    // snake_case wire and transforms to camelCase internally.
    //
    // `dismissed_tours` is pre-dismissed: the default test user is
    // "experienced" so guided tours / nudges never overlay unrelated
    // specs. tour.spec.ts registers its own (later-wins) handler with
    // an empty list to exercise the tour flows.
    await page.route(
      `${API_ROOT}/user_preferences/ui_layout`,
      async (route) =>
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              v: 1,
              panel_widths: {},
              dismissed_tours: [
                "welcome-v1",
                "welcome-v1:completed",
                "welcome-coach-v1",
                "welcome-tour-nudge-v1",
                "welcome-intent-v1",
                "welcome-hero-v1",
              ],
            },
          }),
        }),
    );

    // Reference to API_BASE intentional: silence ESLint unused-import for
    // specs that import API_BASE indirectly via this fixture.
    void API_BASE;

    await provide(page);
  },
});

export { expect } from "@playwright/test";
