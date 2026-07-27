/**
 * Mock handlers for `/v1/matter_templates` — a stateful in-memory store so the
 * Tier-1 (mocked) Matter Templates spec exercises the real create→edit→list
 * flow without a backend. Mirrors the platform wire shape (snake_case, prefixed
 * ids, embedded ordered task spine).
 */

import { Page } from "@playwright/test";

interface TaskRow {
  title: string;
  status: string | null;
  description: string | null;
  position: number;
}
interface QuestionRow {
  text: string;
  position: number;
}
interface TemplateRow {
  id: string;
  name: string;
  matter_type: string | null;
  context: string;
  tasks: TaskRow[];
  questions: QuestionRow[];
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

interface TaskInput {
  title: string;
  status?: string;
  description?: string;
}
interface QuestionInput {
  text: string;
}

const NOW = "2026-06-02T00:00:00.000Z";

function projectTasks(tasks: TaskInput[] = []): TaskRow[] {
  return tasks.map((t, i) => ({
    title: t.title,
    status: t.status ?? null,
    description: t.description ?? null,
    position: i,
  }));
}

function projectQuestions(questions: QuestionInput[] = []): QuestionRow[] {
  return questions.map((q, i) => ({ text: q.text, position: i }));
}

export async function setupMatterTemplatesHandlers(
  page: Page,
  opts: {
    seed?: Array<{ name: string; questions?: string[]; matterType?: string }>;
  } = {},
) {
  let seq = 0;
  const store: TemplateRow[] = [];

  // Optional seed templates (e.g. for the Communications quick-questions panel).
  for (const t of opts.seed ?? []) {
    seq += 1;
    store.push({
      id: `mtpl_${seq}`,
      name: t.name,
      matter_type: t.matterType ?? null,
      context: "",
      tasks: [],
      questions: projectQuestions((t.questions ?? []).map((text) => ({ text }))),
      created_by_id: "acc_test",
      created_at: NOW,
      updated_at: NOW,
    });
  }

  // Collection — GET (list) + POST (create).
  await page.route(
    (url) => url.pathname === "/v1/matter_templates",
    async (route, request) => {
      const method = request.method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ matter_templates: store }),
        });
        return;
      }
      if (method === "POST") {
        const body = (request.postDataJSON() ?? {}) as {
          name?: string;
          matter_type?: string | null;
          context?: string;
          tasks?: TaskInput[];
          questions?: QuestionInput[];
        };
        seq += 1;
        const row: TemplateRow = {
          id: `mtpl_${seq}`,
          name: body.name ?? "Untitled",
          matter_type: body.matter_type ?? null,
          context: body.context ?? "",
          tasks: projectTasks(body.tasks),
          questions: projectQuestions(body.questions),
          created_by_id: "acc_test",
          created_at: NOW,
          updated_at: NOW,
        };
        store.push(row);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ matter_template: row }),
        });
        return;
      }
      await route.fallback();
    },
  );

  // Item — PATCH (update fields) + DELETE.
  await page.route(
    (url) => /^\/v1\/matter_templates\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      const method = request.method();
      const id = new URL(request.url()).pathname.split("/").pop() ?? "";
      const row = store.find((r) => r.id === id);
      if (method === "PATCH") {
        const body = (request.postDataJSON() ?? {}) as {
          name?: string;
          matter_type?: string | null;
          context?: string;
        };
        if (row) {
          if (body.name !== undefined) row.name = body.name;
          if (body.matter_type !== undefined) row.matter_type = body.matter_type;
          if (body.context !== undefined) row.context = body.context;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ matter_template: row }),
        });
        return;
      }
      if (method === "DELETE") {
        const idx = store.findIndex((r) => r.id === id);
        if (idx >= 0) store.splice(idx, 1);
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      await route.fallback();
    },
  );

  // Item task-spine — PUT (replace wholesale).
  await page.route(
    (url) => /^\/v1\/matter_templates\/[^/]+\/tasks$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "PUT") {
        await route.fallback();
        return;
      }
      const id = new URL(request.url()).pathname.split("/")[3] ?? "";
      const row = store.find((r) => r.id === id);
      const body = (request.postDataJSON() ?? {}) as { tasks?: TaskInput[] };
      if (row) row.tasks = projectTasks(body.tasks);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ matter_template: row }),
      });
    },
  );

  // Item question-list — PUT (replace wholesale).
  await page.route(
    (url) => /^\/v1\/matter_templates\/[^/]+\/questions$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "PUT") {
        await route.fallback();
        return;
      }
      const id = new URL(request.url()).pathname.split("/")[3] ?? "";
      const row = store.find((r) => r.id === id);
      const body = (request.postDataJSON() ?? {}) as {
        questions?: QuestionInput[];
      };
      if (row) row.questions = projectQuestions(body.questions);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ matter_template: row }),
      });
    },
  );
}
