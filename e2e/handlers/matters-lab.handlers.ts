/**
 * Mock handlers for the EXPERIMENTAL Matters Lab (explorer tab).
 *
 * The lab reads real `work_items` (type `matter` + `task`), `legal_findings`,
 * attribute definitions/values, comments and the workspace activity feed. This
 * mocks all of them so a Tier-1 (mocked) Playwright run exercises the lab
 * without a backend. Wire shapes mirror the platform DTOs (snake_case, under
 * `/api/`); pair with `setupWorkspaceHandlers` for the workspace context.
 */

import { Page } from "@playwright/test";
import { API_ROOT, TEST_USER } from "./shared";

const NOW = "2026-06-01T00:00:00.000Z";
const MATTER_ID = "wi-matter-acme";
const MATTER_TYPE_ID = "wit-matter";
const TASK_TYPE_ID = "wit-task";
const TASK_WORKFLOW_ID = "wf-matter-task";

function workItem(over: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "wi-x",
    identifier: "LAW-0",
    title: "",
    subject: null,
    description: null,
    state: { id: "wfs-x", key: "todo", name: "To do", category: "not_started" },
    type: { id: "wit-task", key: "task", name: "Task" },
    priority: "none",
    position: 0,
    due_date: null,
    estimate: null,
    assignee_id: null,
    assignee_name: null,
    parent_id: null,
    workspace_id: "ws-e2e-default",
    iteration_id: null,
    folder_id: null,
    visibility: "private",
    version: 0,
    dri_id: null,
    dri_name: null,
    created_by_id: TEST_USER.account_id,
    created_by_name: "E2E Test User",
    created_at: NOW,
    updated_at: NOW,
    completed_at: null,
    ...over,
  };

}

const MATTER = workItem({
  id: MATTER_ID,
  identifier: "LAW-1",
  title: "Acme Corp v. Gibson",
  description: "Acme Corp sues Gibson over a 2024 supply agreement.",
  state: { id: "wfs-pleadings", key: "pleadings", name: "Pleadings", category: "active" },
  type: { id: MATTER_TYPE_ID, key: "matter", name: "Matter" },
  priority: "medium",
});

const TASKS = [
  workItem({ id: "wi-task-1", identifier: "LAW-2", title: "Run conflict check", parent_id: MATTER_ID, state: { id: "wfs-done", key: "done", name: "Done", category: "done" } }),
  workItem({ id: "wi-task-2", identifier: "LAW-3", title: "Draft complaint", parent_id: MATTER_ID, state: { id: "wfs-inprog", key: "in_progress", name: "In progress", category: "active" }, assignee_name: "Maya" }),
  workItem({ id: "wi-task-3", identifier: "LAW-4", title: "Prepare witness list", parent_id: MATTER_ID, state: { id: "wfs-todo", key: "todo", name: "To do", category: "not_started" } }),
];

/** Task workflow states by key — used to project a PATCH'd state_key back.
 * Includes the matter workflow states (intake / assessment / closed) so a matter
 * create (→ intake), finish (→ closed = done) and reopen (→ assessment) project
 * correctly: the explorer buckets a matter as "Completed" iff its state category
 * is `done`/`dead`, so `closed` MUST carry category `done`. */
const STATE_BY_KEY: Record<string, Record<string, string>> = {
  todo: { id: "wfs-todo", key: "todo", name: "To do", category: "not_started" },
  in_progress: { id: "wfs-inprog", key: "in_progress", name: "In progress", category: "active" },
  done: { id: "wfs-done", key: "done", name: "Done", category: "done" },
  intake: { id: "wfs-intake", key: "intake", name: "Intake", category: "not_started" },
  assessment: { id: "wfs-assessment", key: "assessment", name: "Assessment", category: "active" },
  closed: { id: "wfs-closed", key: "closed", name: "Closed", category: "done" },
  litigation_intake: { id: "wfs-lit-intake", key: "litigation_intake", name: "Intake", category: "not_started" },
  facts_evidence: { id: "wfs-facts", key: "facts_evidence", name: "Facts & Evidence", category: "active" },
  pleadings: { id: "wfs-pleadings-task", key: "pleadings", name: "Pleadings", category: "active" },
  evidence_disclosure: { id: "wfs-evidence", key: "evidence_disclosure", name: "Evidence / Disclosure", category: "active" },
  hearing_trial: { id: "wfs-hearing", key: "hearing_trial", name: "Hearing / Trial", category: "active" },
  resolution: { id: "wfs-resolution", key: "resolution", name: "Resolution", category: "active" },
};

function listEnvelope(data: unknown[]) {
  return {
    data,
    has_more: false,
    next_page_url: null,
    previous_page_url: null,
  };
}

/**
 * Register a GET-only JSON mock. Non-GET requests fall through to the next
 * matching route. Trims the method-guard + fulfill boilerplate the lab's many
 * read-only endpoints would otherwise repeat verbatim.
 */
function mockGet(
  page: Page,
  matcher: Parameters<Page["route"]>[0],
  body: () => unknown,
): Promise<void> {
  return page.route(matcher, async (route, request) => {
    if (request.method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body()),
    });
  });
}

export async function setupMattersLabHandlers(page: Page) {
  // In-memory state-key overrides so a drag-to-move (PATCH) survives the
  // refetch — the list reflects what was moved, like the real backend.
  const stateOverride = new Map<string, string>();
  const titleOverride = new Map<string, string>();
  // Matters + tasks CREATED during the run (POST /api/work_items). Seeded matter
  // (`MATTER`) + tasks (`TASKS`) stay constant; these accumulate so a created
  // matter shows up in the tree and its lifecycle (work → finish) round-trips.
  const createdMatters: Record<string, unknown>[] = [];
  const createdTasks: Record<string, unknown>[] = [];
  let seq = 100;
  const applyTask = (t: Record<string, unknown>): Record<string, unknown> => {
    let out = t;
    const key = stateOverride.get(t.id as string);
    if (key && STATE_BY_KEY[key]) out = { ...out, state: STATE_BY_KEY[key] };
    const title = titleOverride.get(t.id as string);
    if (title != null) out = { ...out, title };
    return out;
  };

  // Simulate a task the AGENT created server-side (matter-scoped agentic chat):
  // appending here means the next work_items refetch — triggered by the chat's
  // `tool_step` query invalidation — shows it on the board, like the real loop.
  const addAgentTask = (over: {
    title: string;
    identifier?: string;
    parentId?: string;
    stateKey?: string;
  }): void => {
    seq += 1;
    createdTasks.push(
      workItem({
        id: `wi-agent-${seq}`,
        identifier: over.identifier ?? `LAW-${seq}`,
        title: over.title,
        parent_id: over.parentId ?? MATTER_ID,
        state: STATE_BY_KEY[over.stateKey ?? "todo"] ?? STATE_BY_KEY.todo,
      }),
    );
  };

  // GET /api/work_items?type_key=matter|task (list) — exact path, discriminate by query.
  await mockGet(
    page,
    (url) => /^\/api\/workspaces\/[^/]+\/work_item_types$/.test(url.pathname),
    () => ({
      data: [
        {
          id: MATTER_TYPE_ID,
          workspace_id: "ws-e2e-default",
          key: "matter",
          name: "Matter",
          description: null,
          default_workflow_id: "wf-matter",
          template_id: null,
          created_at: NOW,
          updated_at: NOW,
        },
        {
          id: TASK_TYPE_ID,
          workspace_id: "ws-e2e-default",
          key: "task",
          name: "Task",
          description: null,
          default_workflow_id: TASK_WORKFLOW_ID,
          template_id: null,
          created_at: NOW,
          updated_at: NOW,
        },
      ],
    }),
  );

  await mockGet(
    page,
    (url) => /^\/api\/workflows\/[^/]+\/states$/.test(url.pathname),
    () => ({
      data: Object.values(STATE_BY_KEY).map((state, index) => ({
        ...state,
        workflow_id: TASK_WORKFLOW_ID,
        position: index,
        created_at: NOW,
        updated_at: NOW,
      })),
    }),
  );

  await page.route(
    (url) => url.pathname === "/api/work_items",
    async (route, request) => {
      // POST → create a matter or task; append to the in-memory store so it
      // shows up on the next list refetch (mirrors the real backend).
      if (request.method() === "POST") {
        const body = (request.postDataJSON() ?? {}) as {
          type_key?: string;
          title?: string;
          state_key?: string;
          parent_id?: string;
          description?: string;
          priority?: string;
        };
        seq += 1;
        const stateKey = body.state_key ?? (body.type_key === "matter" ? "intake" : "todo");
        const created = workItem({
          id: `wi-new-${seq}`,
          identifier: `LAW-${seq}`,
          title: body.title ?? "",
          description: body.description ?? null,
          parent_id: body.parent_id ?? null,
          priority: body.priority ?? "none",
          type:
            body.type_key === "matter"
              ? { id: MATTER_TYPE_ID, key: "matter", name: "Matter" }
              : { id: TASK_TYPE_ID, key: "task", name: "Task" },
          state: STATE_BY_KEY[stateKey] ?? STATE_BY_KEY.todo,
        });
        if (body.type_key === "matter") createdMatters.push(created);
        else createdTasks.push(created);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ workItem: created }),
        });
        return;
      }
      if (request.method() !== "GET") {
        await route.fallback();
        return;
      }
      const typeKey = new URL(request.url()).searchParams.get("type_key");
      const data =
        typeKey === "matter"
          ? [applyTask(MATTER), ...createdMatters.map(applyTask)]
          : typeKey === "task"
            ? [...TASKS, ...createdTasks].map(applyTask)
            : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(listEnvelope(data)),
      });
    },
  );

  // PATCH /api/work_items/:id — record a state_key move; echo the updated item.
  await page.route(
    (url) => /^\/api\/work_items\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "PATCH") {
        await route.fallback();
        return;
      }
      const id = request.url().split("/work_items/")[1]?.split("?")[0] ?? "";
      const body = (request.postDataJSON() ?? {}) as {
        state_key?: string;
        title?: string;
      };
      if (typeof body.state_key === "string") stateOverride.set(id, body.state_key);
      if (typeof body.title === "string") titleOverride.set(id, body.title);
      const base =
        [...TASKS, ...createdTasks, ...createdMatters].find(
          (t) => t.id === id,
        ) ??
        MATTER;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ workItem: applyTask(base) }),
      });
    },
  );

  // GET /api/work_items/:id/comments → empty
  await mockGet(
    page,
    (url) => /^\/api\/work_items\/[^/]+\/comments$/.test(url.pathname),
    () => ({ data: [] }),
  );

  // GET /api/work_items/:id/attribute_values → the matter's client/practice/type
  await mockGet(
    page,
    (url) => /^\/api\/work_items\/[^/]+\/attribute_values$/.test(url.pathname),
    () => ({
      data: [
        { id: "av-1", work_item_id: MATTER_ID, definition_id: "ad-type", value: { value: "litigation" }, created_at: NOW, updated_at: NOW },
        { id: "av-2", work_item_id: MATTER_ID, definition_id: "ad-client", value: { value: "Acme Corp" }, created_at: NOW, updated_at: NOW },
      ],
    }),
  );

  // PUT /api/work_items/:id/attribute_values/:def → upsert (create-matter writes
  // matter_type + client here). Echo a value row so the best-effort write is a
  // clean 200 rather than an unhandled fall-through.
  await page.route(
    (url) =>
      /^\/api\/work_items\/[^/]+\/attribute_values\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "PUT") {
        await route.fallback();
        return;
      }
      const parts = new URL(request.url()).pathname.split("/");
      const definitionId = parts[parts.length - 1];
      const workItemId = parts[parts.length - 3];
      const body = (request.postDataJSON() ?? {}) as { value?: unknown };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          value: {
            id: `av-${definitionId}`,
            work_item_id: workItemId,
            definition_id: definitionId,
            value: body.value ?? null,
            created_at: NOW,
            updated_at: NOW,
          },
        }),
      });
    },
  );

  // GET /api/work_item_types/:id/attribute_definitions → matter attribute defs
  await mockGet(
    page,
    (url) =>
      /^\/api\/work_item_types\/[^/]+\/attribute_definitions$/.test(url.pathname),
    () => ({
      data: [
        { id: "ad-type", key: "matter_type", name: "Matter Type", data_type: "select", required: true, config: {}, position: 0 },
        { id: "ad-client", key: "client", name: "Client", data_type: "text", required: true, config: {}, position: 1 },
      ],
    }),
  );

  // GET /api/legal/findings → one finding under the matter
  await mockGet(page, `${API_ROOT}/legal/findings*`, () => ({
    findings: [
      {
        id: "lfn-1",
        issue: "Limitation period likely still open",
        citation: "ป.พ.พ. มาตรา 193/30",
        risk_level: "low",
        confidence_band: "high",
        verified: true,
        work_item_id: MATTER_ID,
      },
    ],
  }));

  // GET /api/matter_templates → empty (the explorer's create dialog reads it for
  // custom templates; the lab spec doesn't exercise any, so keep it empty).
  await mockGet(
    page,
    (url) => url.pathname === "/api/matter_templates",
    () => ({ matter_templates: [] }),
  );

  // GET /api/activities/workspace → empty feed
  await mockGet(page, `${API_ROOT}/activities/workspace`, () => ({
    activities: [],
  }));

  // Matter subtree — real folders + notes that nest under a matter (Phase 2
  // explorer merge). Stateful so a created folder/note survives the refetch,
  // like the real backend; scoped by `matter_id`.
  const matterFolders: Record<string, unknown>[] = [];
  const matterNotes: Record<string, unknown>[] = [];

  await page.route(
    (url) => url.pathname === "/api/folders",
    async (route, request) => {
      const matterId = new URL(request.url()).searchParams.get("matter_id");
      if (request.method() === "GET") {
        const data = matterFolders.filter((f) => f.matter_id === matterId);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data }),
        });
        return;
      }
      if (request.method() === "POST") {
        const body = (request.postDataJSON() ?? {}) as {
          name?: string;
          matter_id?: string;
        };
        const folder = {
          id: `fld-${matterFolders.length + 1}`,
          name: body.name ?? "Untitled",
          matter_id: body.matter_id ?? null,
          parent_id: null,
          icon: null,
          position: matterFolders.length,
          created_at: NOW,
          updated_at: NOW,
        };
        matterFolders.push(folder);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ folder }),
        });
        return;
      }
      await route.fallback();
    },
  );

  await page.route(
    (url) => url.pathname === "/api/pages",
    async (route, request) => {
      const matterId = new URL(request.url()).searchParams.get("matter_id");
      if (request.method() === "GET") {
        const data = matterNotes.filter((n) => n.matter_id === matterId);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data }),
        });
        return;
      }
      if (request.method() === "POST") {
        const body = (request.postDataJSON() ?? {}) as {
          title?: string;
          matter_id?: string;
        };
        const page = {
          id: `pg-${matterNotes.length + 1}`,
          title: body.title ?? "Untitled",
          content: "",
          matter_id: body.matter_id ?? null,
          folder_id: null,
          icon: null,
          version: 0,
          position: matterNotes.length,
          created_at: NOW,
          updated_at: NOW,
        };
        matterNotes.push(page);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ page }),
        });
        return;
      }
      await route.fallback();
    },
  );

  // GET/PUT /api/pages/:id — open + save a single note (the matter note editor).
  // Content round-trips through the in-memory note so an edit survives a reopen.
  await page.route(
    (url) => /^\/api\/pages\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      const id = new URL(request.url()).pathname.split("/").pop() ?? "";
      const note = matterNotes.find((n) => n.id === id);
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            page: note ?? {
              id,
              title: "Untitled",
              content: "",
              matter_id: null,
              folder_id: null,
              icon: null,
              version: 0,
              position: 0,
              created_at: NOW,
              updated_at: NOW,
            },
          }),
        });
        return;
      }
      if (request.method() === "PUT") {
        const body = (request.postDataJSON() ?? {}) as {
          title?: string;
          content?: string;
        };
        if (note) {
          if (typeof body.title === "string") note.title = body.title;
          if (typeof body.content === "string") note.content = body.content;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ page: note ?? { id, ...body } }),
        });
        return;
      }
      await route.fallback();
    },
  );

  // Sharing — the note's right-click "Share" opens the shared ShareDialog, which
  // reads the resource's existing shares + the org members. Empty mocks so the
  // dialog opens cleanly (no real grants needed for the open-flow test).
  await mockGet(
    page,
    (url) => url.pathname.startsWith("/api/sharing/resource/"),
    () => [],
  );
  await mockGet(
    page,
    (url) => /^\/api\/organizations\/[^/]+\/members$/.test(url.pathname),
    () => [],
  );

  // Handle for specs that simulate the agentic chat creating a task — see
  // matters-lab-agentic.spec.ts. `MATTER_ID` is the seeded matter's id.
  return { addAgentTask, matterId: MATTER_ID };
}
