/**
 * Route handler factories for workspace endpoints (settings, account, plan, folders, pages).
 *
 * Wire contract: all endpoints live under `/api/` (Stripe v2 discipline) with
 * snake_case URL paths and snake_case field names. List envelopes use the
 * cursor shape `{ data, has_more, next_page_url, previous_page_url? }`.
 *
 * Workspace rename arc (2026-05-27): the `project` primitive was retired —
 * the sole grouping is `workspace` (`/api/workspaces`, see below). No
 * `/api/projects*` mocks live here.
 */

import { Page } from "@playwright/test";
import { API_ROOT, TEST_USER } from "./shared";

export async function setupWorkspaceHandlers(page: Page) {
  // GET /api/accounts/:id/settings
  await page.route(`${API_ROOT}/accounts/*/settings`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        workflow_statuses: [
          "backlog",
          "todo",
          "in_progress",
          "in_review",
          "done",
          "cancelled",
        ],
        project_context: "",
      }),
    });
  });

  // GET /api/subscriptions/current — `{ subscription, organization }`
  // envelope, seat-based SubscriptionResponseDto shape (no `source`,
  // no `scheduled_plan_type`; `seat_count` is the billed quantity).
  // THB-first pricing: subscriptions bill in baht (satang on the wire).
  await page.route(`${API_ROOT}/subscriptions/current`, async (route) => {
    const now = new Date().toISOString();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        subscription: {
          id: "sub-e2e-001",
          plan_type: "team",
          status: "active",
          billing_interval: "month",
          seat_count: 1,
          price_cents: 89000,
          currency: "THB",
          current_period_start: now,
          current_period_end: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          trial_end: null,
          usage_mode: "inference_included",
          canceled_at: null,
          ended_at: null,
          created_at: now,
          updated_at: now,
        },
        organization: { id: TEST_USER.organization_id },
      }),
    });
  });


  // GET /api/subscriptions/plans — seat-based catalog (free + team),
  // mirroring docs/platform/seat-based-pricing-2026-07-06.md +
  // scripts/seed-subscription-plans.ts. THB-first: `currency: 'THB'`,
  // seat prices in satang (฿890/mo, ฿8,900/yr); the LLM allowance stays
  // USD cents (metering currency). Wire shape carries no Stripe price
  // ids (server-side concern only).
  await page.route(`${API_ROOT}/subscriptions/plans`, async (route) => {
    const now = new Date().toISOString();
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
          created_at: now,
          updated_at: now,
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
          created_at: now,
          updated_at: now,
        },
      ]),
    });
  });

  // GET /api/usage/:accountId/summary
  await page.route(`${API_ROOT}/usage/*/summary*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        total_cost: 5.42,
        total_input_tokens: 250000,
        total_output_tokens: 75000,
        record_count: 127,
      }),
    });
  });

  // GET /api/token_packages/balance
  await page.route(`${API_ROOT}/token_packages/balance`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ balance_cents: 500 }),
    });
  });

  // GET /api/workspaces — workspace rename arc (2026-05-27): listed
  // per organization, returned from the JWT-bound org. Envelope shape
  // is `{ workspaces: [...] }` (NOT `{ data: [...] }`) per platform
  // openapi.yaml WorkspaceListResponse.
  await page.route(`${API_ROOT}/workspaces`, async (route, request) => {
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          workspaces: [
            {
              id: "ws-e2e-default",
              organization_id: TEST_USER.organization_id,
              key: "DEF",
              name: "Default",
              metadata: {},
              // The mocked org carries BOTH modules so every suite
              // (sales specs AND matters/legal specs) sees its surface;
              // org-level module gating has its own dedicated spec.
              module_keys: ["legal", "sales"],
              expires_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        }),
      });
    } else {
      await route.fallback();
    }
  });

  // GET /api/workspaces/:id/workflows + /api/workspaces/:id/work_item_types
  // — empty by default. The board/backlog views read workflow states via
  // `useWorkflowStatuses`, which falls back to DEFAULT_WORKFLOW_STATUSES
  // (Backlog/Todo/In Progress/In Review/Done/Cancelled) when no custom
  // workflow resolves. Returning `{ data: [] }` here keeps that fallback
  // path clean instead of letting the call leak to the real network.
  // Suites needing custom statuses (e.g. sales) register their own
  // workspace-scoped mocks, which win via Playwright's LIFO ordering.
  await page.route(
    (url) => /^\/api\/workspaces\/[^/]+\/workflows$/.test(url.pathname),
    async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [] }),
        });
        return;
      }
      await route.fallback();
    },
  );
  await page.route(
    (url) => /^\/api\/workspaces\/[^/]+\/work_item_types$/.test(url.pathname),
    async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [] }),
        });
        return;
      }
      await route.fallback();
    },
  );

  // GET /api/file_system/nodes — MUST return the `{ data, meta }` envelope
  // (useFoldersQuery does `response.data.filter(...)`). A bare `[]` makes
  // `response.data` undefined → the query throws "data cannot be undefined",
  // which surfaces as a console error + an occasional first-render flake.
  await page.route(`${API_ROOT}/file_system/nodes*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], meta: { total: 0 } }),
    });
  });

  // GET /api/file_system
  await page.route(`${API_ROOT}/file_system*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  // GET /api/fs/tree
  await page.route(`${API_ROOT}/fs/tree*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  // GET /api/tasks
  await page.route(`${API_ROOT}/tasks*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ tasks: [], total: 0 }),
    });
  });

  // Mutable sprint state — single handler discriminates by URL + method
  let activeSprint: Record<string, unknown> | null = null;

  await page.route(`${API_ROOT}/sprints**`, async (route, request) => {
    const method = request.method();
    const url = request.url();

    // GET /api/sprints/project/*/active
    if (method === "GET" && url.includes("/active")) {
      if (activeSprint) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(activeSprint),
        });
      } else {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ message: "No active sprint found" }),
        });
      }
      return;
    }

    // GET /api/sprints/*/tasks
    if (method === "GET" && url.includes("/tasks")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tasks: [], total: 0 }),
      });
      return;
    }

    // GET /api/sprints/*/metrics
    if (method === "GET" && url.includes("/metrics")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ total: 0, completed: 0, remaining: 0 }),
      });
      return;
    }

    // POST /api/sprints — create sprint
    if (method === "POST" && !url.includes("/start") && !url.includes("/complete")) {
      const body = request.postDataJSON() as Record<string, unknown>;
      const newSprint = {
        id: `sprint-e2e-new-${Date.now()}`,
        name: body.name ?? "New Sprint",
        goal: body.goal ?? null,
        project_id: body.project_id ?? "proj-e2e-001",
        status: "upcoming",
        start_date: null,
        end_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ sprint: newSprint }),
      });
      return;
    }

    // POST /api/sprints/*/start
    if ((method === "POST" || method === "PUT") && url.includes("/start")) {
      const sprintId = url.split("/sprints/")[1]?.split("/start")[0] ?? "";
      activeSprint = {
        id: sprintId,
        name: "Sprint",
        goal: null,
        project_id: "proj-e2e-001",
        status: "active",
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 14 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sprint: activeSprint }),
      });
      return;
    }

    // GET — list sprints (default)
    const sprints = activeSprint ? [activeSprint] : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: sprints,
        has_more: false,
        next_page_url: null,
        previous_page_url: null,
      }),
    });
  });

  // GET /api/user_preferences/me
  await page.route(`${API_ROOT}/user_preferences/me`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "pref-e2e-001",
        user_id: TEST_USER.user_id,
        role: "Software Engineer",
        interests: ["code_technical", "research_analysis"],
        response_length: "balanced",
        tone: "professional",
      }),
    });
  });

  // Presence heartbeat
  await page.route(`${API_ROOT}/api/presence/heartbeat`, async (route) => {
    await route.fulfill({ status: 204 });
  });
  await page.route(`${API_ROOT}/presence/heartbeat`, async (route) => {
    await route.fulfill({ status: 204 });
  });
}
