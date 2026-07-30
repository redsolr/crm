/**
 * Route handler factories for work-item management endpoints.
 * Mocks `/api/work_items` for board/backlog/calendar E2E tests.
 *
 * Wire contract (matches `platform/src/modules/work-items/work-items.response.dto.ts`):
 *   - URL: `/api/work_items` (snake_case path, NOT `/work-items`)
 *   - Field names: snake_case throughout (Stripe v2 style)
 *   - List envelope: `{ data, has_more, next_page_url }` — cursor pagination
 *   - Single envelope: `{ work_item }`
 *   - Bulk envelope: `{ work_items }`
 *   - Polymorphic actor refs (assignee_id, dri_id, created_by_id): opaque
 *     text strings (NOT prefixed `acc_*` ids). Cached `*_name` siblings
 *     carry the display string (forward-only — renaming an actor does
 *     NOT retroactively rewrite the cache).
 */

import { Page } from "@playwright/test";
import { API_ROOT, TEST_USER } from "./shared";

// ============================================================================
// Factory Functions
// ============================================================================

let workItemCounter = 0;

function stateCategoryFor(
  key: string,
): "not_started" | "active" | "done" | "dead" {
  if (key === "done" || key === "cancelled") return "done";
  if (key === "in_progress" || key === "in_review" || key === "todo")
    return "active";
  if (key === "backlog") return "not_started";
  return "active";
}

export interface MockWorkItem {
  id: string;
  identifier: string;
  title: string;
  subject: string | null;
  description: string | null;
  state: {
    id: string;
    key: string;
    name: string;
    category: "not_started" | "active" | "done" | "dead";
  };
  type: { id: string; key: string; name: string };
  priority: string;
  position: number;
  due_date: string | null;
  estimate: number | null;
  workspace_id: string;
  iteration_id: string | null;
  folder_id: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  dri_id: string | null;
  dri_name: string | null;
  created_by_id: string;
  created_by_name: string | null;
  parent_id: string | null;
  visibility: "private" | "internal" | "public";
  vote_count: number;
  version: number;
  shipped_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export function createWorkItemResponse(
  overrides: Partial<MockWorkItem & { state_key: string }> = {},
): MockWorkItem {
  workItemCounter++;
  const stateKey = overrides.state_key ?? overrides.state?.key ?? "todo";
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? `wi-e2e-${workItemCounter}`,
    identifier: overrides.identifier ?? `TST-${workItemCounter}`,
    title: overrides.title ?? `Test Work Item ${workItemCounter}`,
    subject: overrides.subject ?? null,
    description: overrides.description ?? null,
    state: overrides.state ?? {
      id: `state-${stateKey}`,
      key: stateKey,
      name: stateKey,
      category: stateCategoryFor(stateKey),
    },
    type: overrides.type ?? { id: "type-task", key: "task", name: "Task" },
    priority: overrides.priority ?? "none",
    position: overrides.position ?? workItemCounter,
    due_date: overrides.due_date ?? null,
    estimate: overrides.estimate ?? null,
    workspace_id: overrides.workspace_id ?? "ws-e2e-default",
    iteration_id: overrides.iteration_id ?? null,
    folder_id: overrides.folder_id ?? null,
    assignee_id: overrides.assignee_id ?? null,
    assignee_name: overrides.assignee_name ?? null,
    dri_id: overrides.dri_id ?? null,
    dri_name: overrides.dri_name ?? null,
    created_by_id: overrides.created_by_id ?? TEST_USER.user_id,
    created_by_name: overrides.created_by_name ?? TEST_USER.full_name ?? null,
    parent_id: overrides.parent_id ?? null,
    visibility: overrides.visibility ?? "private",
    vote_count: overrides.vote_count ?? 0,
    version: overrides.version ?? 1,
    shipped_at: overrides.shipped_at ?? null,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
    completed_at: overrides.completed_at ?? null,
  };
}

export function createMockWorkItems(): MockWorkItem[] {
  workItemCounter = 0;
  return [
    createWorkItemResponse({
      id: "task-todo-1",
      identifier: "TST-1",
      title: "Set up CI pipeline",
      state_key: "todo",
      priority: "high",
      position: 0,
    }),
    createWorkItemResponse({
      id: "task-todo-2",
      identifier: "TST-2",
      title: "Write unit tests",
      state_key: "todo",
      priority: "medium",
      position: 1,
    }),
    createWorkItemResponse({
      id: "task-progress-1",
      identifier: "TST-3",
      title: "Implement auth flow",
      state_key: "in_progress",
      priority: "urgent",
      position: 0,
    }),
    createWorkItemResponse({
      id: "task-review-1",
      identifier: "TST-4",
      title: "Review API design",
      state_key: "in_review",
      priority: "low",
      position: 0,
    }),
    createWorkItemResponse({
      id: "task-done-1",
      identifier: "TST-5",
      title: "Project scaffolding",
      state_key: "done",
      priority: "none",
      position: 0,
    }),
    createWorkItemResponse({
      id: "task-backlog-1",
      identifier: "TST-6",
      title: "Backlog research",
      state_key: "backlog",
      priority: "low",
      position: 0,
    }),
  ];
}

// Backwards-compatible factory names for tests that still import them.
// Internally everything is a work item.
export const createTaskResponse = createWorkItemResponse;
export const createMockTasks = createMockWorkItems;

// ============================================================================
// Route Handlers
// ============================================================================

export interface WorkItemHandlerOptions {
  workItems?: MockWorkItem[];
}

export type TaskHandlerOptions = WorkItemHandlerOptions;

function applyUpdate(workItem: MockWorkItem, body: Record<string, unknown>) {
  if (typeof body.state_key === "string") {
    workItem.state = {
      id: `state-${body.state_key}`,
      key: body.state_key,
      name: body.state_key,
      category: stateCategoryFor(body.state_key),
    };
  }
  for (const key of [
    "title",
    "description",
    "priority",
    "position",
    "assignee_id",
    "assignee_name",
    "dri_id",
    "dri_name",
    "iteration_id",
    "parent_id",
    "due_date",
    "estimate",
    "subject",
    "folder_id",
  ] as const) {
    if (body[key] !== undefined) {
      (workItem as unknown as Record<string, unknown>)[key] = body[key];
    }
  }
  workItem.version += 1;
  workItem.updated_at = new Date().toISOString();
}

export async function setupTaskHandlers(
  page: Page,
  options: WorkItemHandlerOptions = {},
) {
  let workItems = options.workItems ?? createMockWorkItems();
  let idCounter = workItems.length;

  // POST /api/work_items/bulk — bulk update
  await page.route(`${API_ROOT}/work_items/bulk`, async (route, request) => {
    if (request.method() === "POST") {
      const body = JSON.parse(request.postData() ?? "{}") as {
        work_item_ids?: string[];
        [k: string]: unknown;
      };
      const updated: MockWorkItem[] = [];
      for (const id of body.work_item_ids ?? []) {
        const wi = workItems.find((w) => w.id === id);
        if (wi) {
          applyUpdate(wi, body);
          updated.push(wi);
        }
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ work_items: updated }),
      });
      return;
    }
    await route.fallback();
  });

  // GET /api/work_items* — list / POST /api/work_items — create
  await page.route(`${API_ROOT}/work_items**`, async (route, request) => {
    const u = new URL(request.url());
    // Defer to the more-specific routes for /api/work_items/bulk
    // and /api/work_items/:id — those handlers run first because
    // Playwright matches last-registered-first within a single
    // routing pass, but globs are non-anchored so we still need
    // explicit path checks here to avoid double-handling.
    if (
      u.pathname === "/api/work_items/bulk" ||
      /^\/api\/work_items\/[^/]+$/.test(u.pathname)
    ) {
      await route.fallback();
      return;
    }

    const method = request.method();

    if (method === "GET") {
      let filtered = workItems;
      const workspaceId = u.searchParams.get("workspace_id");
      if (workspaceId != null && workspaceId !== "") {
        filtered = filtered.filter((w) => w.workspace_id === workspaceId);
      }
      const stateKey = u.searchParams.get("state_key");
      if (stateKey != null && stateKey !== "") {
        filtered = filtered.filter((w) => w.state.key === stateKey);
      }
      const stateCategory = u.searchParams.get("state_category");
      if (stateCategory != null && stateCategory !== "") {
        filtered = filtered.filter((w) => w.state.category === stateCategory);
      }
      const iterationId = u.searchParams.get("iteration_id");
      if (iterationId != null && iterationId !== "") {
        filtered = filtered.filter((w) => w.iteration_id === iterationId);
      }
      const parentId = u.searchParams.get("parent_id");
      if (parentId != null && parentId !== "") {
        filtered = filtered.filter((w) => w.parent_id === parentId);
      }
      const assigneeId = u.searchParams.get("assignee_id");
      if (assigneeId != null && assigneeId !== "") {
        filtered = filtered.filter((w) => w.assignee_id === assigneeId);
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: filtered,
          has_more: false,
          next_page_url: null,
        }),
      });
      return;
    }

    if (method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}") as Record<
        string,
        unknown
      >;
      idCounter++;
      const newWorkItem = createWorkItemResponse({
        id: `wi-new-${idCounter}`,
        identifier: `TST-${idCounter}`,
        title: (body.title as string) ?? "Untitled",
        description: (body.description as string) ?? null,
        state_key: (body.state_key as string) ?? "backlog",
        priority: (body.priority as string) ?? "none",
        assignee_id: (body.assignee_id as string) ?? null,
        assignee_name: (body.assignee_name as string) ?? null,
        dri_id: (body.dri_id as string) ?? null,
        dri_name: (body.dri_name as string) ?? null,
        workspace_id: (body.workspace_id as string) ?? "ws-e2e-default",
        iteration_id: (body.iteration_id as string) ?? null,
        due_date: (body.due_date as string) ?? null,
        parent_id: (body.parent_id as string) ?? null,
        folder_id: (body.folder_id as string) ?? null,
        position: workItems.length,
      });
      workItems.push(newWorkItem);
      // Wire envelope includes both `work_item` (snake, what the BE
      // currently emits) AND `workItem` (camel, what `workItemsApi` and
      // the FE TaskDetailPanel destructure). The FE/BE wire is mid-
      // migration, so we satisfy both readers from the mock to keep
      // both code paths (refetch via invalidate AND direct push to
      // local state, e.g. subtasks) green.
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          work_item: newWorkItem,
          workItem: newWorkItem,
        }),
      });
      return;
    }

    await route.fallback();
  });

  // PATCH/DELETE/GET /api/work_items/:id — individual work-item operations
  await page.route(
    (url) => /^\/api\/work_items\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      const method = request.method();
      const url = request.url();
      const id = url.split("/work_items/")[1]?.split("?")[0] ?? "";

      if (method === "PATCH") {
        const body = JSON.parse(request.postData() ?? "{}") as Record<
          string,
          unknown
        >;
        const wi = workItems.find((w) => w.id === id);
        if (wi) {
          applyUpdate(wi, body);
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { ETag: `W/"v${wi.version}"` },
            body: JSON.stringify({ work_item: wi, workItem: wi }),
          });
        } else {
          await route.fulfill({
            status: 404,
            body: JSON.stringify({
              code: "not_found",
              message: "Work item not found",
            }),
          });
        }
        return;
      }

      if (method === "DELETE") {
        workItems = workItems.filter((w) => w.id !== id);
        await route.fulfill({ status: 204 });
        return;
      }

      if (method === "GET") {
        const wi = workItems.find((w) => w.id === id);
        if (wi) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { ETag: `W/"v${wi.version}"` },
            body: JSON.stringify({ work_item: wi, workItem: wi }),
          });
        } else {
          await route.fulfill({
            status: 404,
            body: JSON.stringify({
              code: "not_found",
              message: "Work item not found",
            }),
          });
        }
        return;
      }

      await route.fallback();
    },
  );

  // POST /api/comments — create a comment (test-author shape; specs that
  // care about comments mock this more thoroughly)
  await page.route(`${API_ROOT}/comments`, async (route, request) => {
    if (request.method() === "POST") {
      const body = JSON.parse(request.postData() ?? "{}") as Record<
        string,
        unknown
      >;
      const now = new Date().toISOString();
      const comment = {
        id: `comment-${Date.now()}`,
        content: body.content,
        work_item_id: body.work_item_id,
        author_id: TEST_USER.user_id,
        author_name: TEST_USER.full_name,
        mentions: body.mentions ?? [],
        created_at: now,
        updated_at: now,
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ comment }),
      });
      return;
    }
    await route.fallback();
  });

  // GET /api/work_items/:id/comments — list comments for a work item
  await page.route(
    (url) => /^\/api\/work_items\/[^/]+\/comments$/.test(url.pathname),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          has_more: false,
          next_page_url: null,
        }),
      });
    },
  );

  // GET /api/work_items/:id/subtasks — list subtasks of a work item.
  // FE expects { workItems: WorkItem[] } (see workItemsApi.getSubWorkItems).
  // Subtasks are work_items whose parent_id === the requested id; we look
  // them up from the in-memory workItems array so the same handler covers
  // both empty + populated cases.
  await page.route(
    (url) => /^\/api\/work_items\/[^/]+\/subtasks$/.test(url.pathname),
    async (route, request) => {
      const u = new URL(request.url());
      const m = u.pathname.match(/^\/api\/work_items\/([^/]+)\/subtasks$/);
      const parentId = m?.[1] ?? "";
      const children = workItems.filter((w) => w.parent_id === parentId);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ workItems: children }),
      });
    },
  );

  // GET /api/activities/entity/:type/:id — entity activities (used by detail panel)
  await page.route(
    (url) =>
      /^\/api\/activities\/entity\/[^/]+\/[^/]+$/.test(url.pathname),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ activities: [] }),
      });
    },
  );

  // GET /api/workspaces/:id/labels (+ legacy bare /api/labels) — sample
  // labels. Post workspace-rename arc the list lives under
  // `/api/workspaces/:workspaceId/labels`; the bare `/api/labels` form is
  // kept for any FE path still hitting the flat list.
  const labelsBody = () => {
    const now = new Date().toISOString();
    return JSON.stringify({
      data: [
        {
          id: "label-001",
          key: "bug",
          name: "Bug",
          color: "#FF453A",
          description: "Bug report",
          workspace_id: "ws-e2e-default",
          created_at: now,
          updated_at: now,
        },
        {
          id: "label-002",
          key: "feature",
          name: "Feature",
          color: "#34C759",
          description: "Feature request",
          workspace_id: "ws-e2e-default",
          created_at: now,
          updated_at: now,
        },
      ],
      has_more: false,
      next_page_url: null,
    });
  };

  await page.route(
    (url) => /^\/api\/workspaces\/[^/]+\/labels$/.test(url.pathname),
    async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: labelsBody(),
        });
        return;
      }
      await route.fallback();
    },
  );

  await page.route(`${API_ROOT}/labels**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: labelsBody(),
    });
  });

  // GET /api/iterations* — empty iterations by default. Specs that need
  // populated iterations should call setupSprintHandlers() too — that
  // handler's mock runs last and wins per Playwright's
  // last-registered-first ordering.
  await page.route(`${API_ROOT}/iterations**`, async (route, request) => {
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

  // Default workflow + states. The task views (board/backlog) resolve the
  // workspace's workflow via `useWorkflowStatuses`; the board additionally
  // gates its quick-add on `useHasResolvedWorkflowStates` so it never creates
  // against the fabricated DEFAULT fallback (which 400s server-side). The
  // workspace handler returns `{ data: [] }` for workflows (DEFAULT fallback),
  // which leaves `hasResolvedStates` false and hides the quick-add. Mirror
  // production here: a real default workflow whose states match
  // DEFAULT_WORKFLOW_STATUSES, so columns are identical but the create
  // affordance resolves. Registered after setupWorkspaceHandlers → wins (LIFO).
  await page.route(
    (url) => /^\/api\/workspaces\/[^/]+\/workflows$/.test(url.pathname),
    async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                id: "wf-default-e2e",
                workspace_id: "ws-e2e-default",
                name: "Default",
                key: "default",
                is_default: true,
                created_at: "2026-01-01T00:00:00.000Z",
                updated_at: "2026-01-01T00:00:00.000Z",
              },
            ],
          }),
        });
        return;
      }
      await route.fallback();
    },
  );

  await page.route(
    (url) => /^\/api\/workflows\/[^/]+\/states$/.test(url.pathname),
    async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              { id: "st-backlog", workflow_id: "wf-default-e2e", key: "backlog", name: "Backlog", category: "not_started", position: 0 },
              { id: "st-todo", workflow_id: "wf-default-e2e", key: "todo", name: "Todo", category: "active", position: 1 },
              { id: "st-in-progress", workflow_id: "wf-default-e2e", key: "in_progress", name: "In Progress", category: "active", position: 2 },
              { id: "st-in-review", workflow_id: "wf-default-e2e", key: "in_review", name: "In Review", category: "active", position: 3 },
              { id: "st-done", workflow_id: "wf-default-e2e", key: "done", name: "Done", category: "done", position: 4 },
              { id: "st-cancelled", workflow_id: "wf-default-e2e", key: "cancelled", name: "Cancelled", category: "dead", position: 5 },
            ],
          }),
        });
        return;
      }
      await route.fallback();
    },
  );
}
