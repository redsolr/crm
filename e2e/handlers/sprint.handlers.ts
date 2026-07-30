/**
 * Route handler factories for iteration (sprint) management endpoints.
 * Mocks `/api/iterations` CRUD, lifecycle (start/complete), metrics, and
 * the iteration/backlog work_item list endpoint.
 *
 * UI copy retains "Sprint" wording; the platform primitive is `iteration`,
 * reached via `/api/iterations` (snake_case path, Stripe v2 style).
 *
 * Wire contract (matches
 * `platform/src/modules/iterations/iterations.response.dto.ts`):
 *   - List envelope: `{ data, has_more, next_page_url, previous_page_url }`
 *   - Single envelope: `{ iteration }`
 *   - All fields snake_case
 */

import { Page } from "@playwright/test";
import { API_ROOT, TEST_USER } from "./shared";
import type { MockWorkItem } from "./task.handlers";
import { createWorkItemResponse } from "./task.handlers";

export interface MockIteration {
  id: string;
  name: string;
  goal: string | null;
  workspace_id: string;
  status: "planning" | "active" | "completed";
  start_date: string | null;
  end_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface MockWorkItemRef {
  id: string;
  title: string;
  status: string;
  priority: string;
  iteration_id: string | null;
  workspace_id: string;
  assignee_id: string | null;
  assignee_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface SprintHandlerOptions {
  iterations?: MockIteration[];
  activeIteration?: MockIteration | null;
  iterationWorkItems?: MockWorkItemRef[];
  backlogWorkItems?: MockWorkItemRef[];
  metrics?: {
    total_work_items: number;
    completed_work_items: number;
    total_points: number;
    completed_points: number;
  };
}

function createDefaultIterations(): MockIteration[] {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const threeWeeksFromNow = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);

  return [
    {
      id: "iter-e2e-001",
      name: "Sprint 1 - Foundation",
      goal: "Set up core infrastructure",
      workspace_id: "ws-e2e-default",
      status: "completed",
      start_date: new Date(
        now.getTime() - 21 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      end_date: oneWeekAgo.toISOString(),
      position: 0,
      created_at: new Date(
        now.getTime() - 22 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      updated_at: oneWeekAgo.toISOString(),
      completed_at: oneWeekAgo.toISOString(),
    },
    {
      id: "iter-e2e-002",
      name: "Sprint 2 - Features",
      goal: "Build key user-facing features",
      workspace_id: "ws-e2e-default",
      status: "active",
      start_date: oneWeekAgo.toISOString(),
      end_date: oneWeekFromNow.toISOString(),
      position: 1,
      created_at: oneWeekAgo.toISOString(),
      updated_at: now.toISOString(),
      completed_at: null,
    },
    {
      id: "iter-e2e-003",
      name: "Sprint 3 - Polish",
      goal: null,
      workspace_id: "ws-e2e-default",
      status: "planning",
      start_date: twoWeeksFromNow.toISOString(),
      end_date: threeWeeksFromNow.toISOString(),
      position: 2,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      completed_at: null,
    },
  ];
}

function createDefaultWorkItems(iterationId: string): MockWorkItemRef[] {
  const now = new Date().toISOString();
  return [
    {
      id: "wi-e2e-iter-001",
      title: "Implement user authentication",
      status: "done",
      priority: "high",
      iteration_id: iterationId,
      workspace_id: "ws-e2e-default",
      assignee_id: TEST_USER.user_id,
      assignee_name: TEST_USER.full_name ?? null,
      created_at: now,
      updated_at: now,
    },
    {
      id: "wi-e2e-iter-002",
      title: "Design dashboard layout",
      status: "in_progress",
      priority: "medium",
      iteration_id: iterationId,
      workspace_id: "ws-e2e-default",
      assignee_id: TEST_USER.user_id,
      assignee_name: TEST_USER.full_name ?? null,
      created_at: now,
      updated_at: now,
    },
    {
      id: "wi-e2e-iter-003",
      title: "Write API documentation",
      status: "todo",
      priority: "low",
      iteration_id: iterationId,
      workspace_id: "ws-e2e-default",
      assignee_id: null,
      assignee_name: null,
      created_at: now,
      updated_at: now,
    },
  ];
}

function createDefaultBacklogWorkItems(): MockWorkItemRef[] {
  const now = new Date().toISOString();
  return [
    {
      id: "wi-e2e-backlog-001",
      title: "Backlog: Set up CI/CD pipeline",
      status: "backlog",
      priority: "medium",
      iteration_id: null,
      workspace_id: "ws-e2e-default",
      assignee_id: null,
      assignee_name: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: "wi-e2e-backlog-002",
      title: "Backlog: Add dark mode support",
      status: "backlog",
      priority: "low",
      iteration_id: null,
      workspace_id: "ws-e2e-default",
      assignee_id: null,
      assignee_name: null,
      created_at: now,
      updated_at: now,
    },
  ];
}

function asWorkItem(ref: MockWorkItemRef): MockWorkItem {
  return createWorkItemResponse({
    id: ref.id,
    identifier: ref.id,
    title: ref.title,
    state_key: ref.status,
    priority: ref.priority,
    workspace_id: ref.workspace_id,
    iteration_id: ref.iteration_id,
    assignee_id: ref.assignee_id,
    assignee_name: ref.assignee_name,
    created_at: ref.created_at,
    updated_at: ref.updated_at,
  });
}

export async function setupSprintHandlers(
  page: Page,
  options: SprintHandlerOptions = {},
) {
  const iterations = options.iterations ?? createDefaultIterations();
  const activeIteration =
    options.activeIteration ??
    iterations.find((i) => i.status === "active") ??
    null;
  const iterationWorkItems =
    options.iterationWorkItems ??
    createDefaultWorkItems(activeIteration?.id ?? "iter-e2e-002");
  const backlogWorkItems =
    options.backlogWorkItems ?? createDefaultBacklogWorkItems();
  const metrics = options.metrics ?? {
    total_work_items: iterationWorkItems.length,
    completed_work_items: iterationWorkItems.filter((t) => t.status === "done")
      .length,
    total_points: 0,
    completed_points: 0,
  };

  // GET /api/iterations/active?workspace_id=... — active iteration for a workspace
  await page.route(`${API_ROOT}/iterations/active**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ iteration: activeIteration }),
    });
  });

  // GET /api/iterations/:id/metrics — iteration metrics
  await page.route(
    (url) => /^\/api\/iterations\/[^/]+\/metrics$/.test(url.pathname),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ metrics }),
      });
    },
  );

  // POST /api/iterations/:id/start — start an iteration
  await page.route(
    (url) => /^\/api\/iterations\/[^/]+\/start$/.test(url.pathname),
    async (route) => {
      const url = route.request().url();
      const iterationId =
        url.split("/iterations/")[1]?.split("/start")[0] ?? "";
      const iteration = iterations.find((i) => i.id === iterationId);
      const started: MockIteration = {
        ...(iteration ?? iterations[0]),
        status: "active",
        start_date: new Date().toISOString(),
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ iteration: started }),
      });
    },
  );

  // POST /api/iterations/:id/complete — complete an iteration
  await page.route(
    (url) => /^\/api\/iterations\/[^/]+\/complete$/.test(url.pathname),
    async (route) => {
      const url = route.request().url();
      const iterationId =
        url.split("/iterations/")[1]?.split("/complete")[0] ?? "";
      const iteration = iterations.find((i) => i.id === iterationId);
      const completed: MockIteration = {
        ...(iteration ?? iterations[0]),
        status: "completed",
        completed_at: new Date().toISOString(),
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ iteration: completed }),
      });
    },
  );

  // POST /api/iterations (create) + GET /api/iterations (list)
  await page.route(`${API_ROOT}/iterations**`, async (route, request) => {
    const u = new URL(request.url());
    // Defer to more-specific iteration sub-routes (active / :id / :id/start /
    // :id/complete / :id/metrics). The empty-string check guards against the
    // trailing-`/` form `/api/iterations/`.
    if (
      u.pathname !== "/api/iterations" &&
      u.pathname !== "/api/iterations/"
    ) {
      await route.fallback();
      return;
    }

    if (request.method() === "POST") {
      const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      const now = new Date().toISOString();
      const newIteration: MockIteration = {
        id: `iter-e2e-new-${Date.now()}`,
        name: (body.name as string) ?? "New Sprint",
        goal: (body.goal as string) ?? null,
        workspace_id: (body.workspace_id as string) ?? "ws-e2e-default",
        status: "planning",
        start_date: (body.start_date as string) ?? null,
        end_date: (body.end_date as string) ?? null,
        position: iterations.length,
        created_at: now,
        updated_at: now,
        completed_at: null,
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ iteration: newIteration }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: iterations,
        has_more: false,
        next_page_url: null,
        previous_page_url: null,
      }),
    });
  });

  // PATCH/DELETE/GET /api/iterations/:id
  await page.route(
    (url) => /^\/api\/iterations\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      const method = request.method();
      const id =
        request.url().split("/iterations/")[1]?.split("?")[0] ?? "";

      if (method === "GET") {
        const it = iterations.find((i) => i.id === id);
        if (it) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ iteration: it }),
          });
        } else {
          await route.fulfill({
            status: 404,
            body: JSON.stringify({
              code: "not_found",
              message: "Iteration not found",
            }),
          });
        }
        return;
      }

      if (method === "DELETE") {
        await route.fulfill({ status: 204 });
        return;
      }

      await route.fallback();
    },
  );

  // GET /api/work_items* — backlog + iteration-filtered work items
  // (this handler may compete with task.handlers.ts when both fixtures
  // are in use; specs typically don't call both for the same view).
  await page.route(`${API_ROOT}/work_items**`, async (route, request) => {
    if (request.method() !== "GET") {
      await route.fallback();
      return;
    }
    const u = new URL(request.url());
    if (
      u.pathname === "/api/work_items/bulk" ||
      /^\/api\/work_items\/[^/]+/.test(u.pathname)
    ) {
      await route.fallback();
      return;
    }
    const iterationId = u.searchParams.get("iteration_id");
    const source = iterationId ? iterationWorkItems : backlogWorkItems;
    const data = source
      .filter((w) => !iterationId || w.iteration_id === iterationId)
      .map(asWorkItem);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data,
        has_more: false,
        next_page_url: null,
      }),
    });
  });
}
