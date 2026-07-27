/**
 * Mock handlers for the save-a-Workflow surface (`/v1/legal/workflows`).
 * Stateful in-memory store: create/list/delete workflows; `POST …/:id/run`
 * enqueues a run (202, `running`) and the GET poll flips it to `completed` with
 * per-step OUTCOMES computed from the workflow's steps — mirroring the platform's
 * honest completed / abstained / skipped / failed reporting (research_memo
 * abstains here, to prove the abstention surfaces in the run, not a blanket
 * green). Wire shapes mirror the platform DTOs — snake_case, prefixed IDs.
 *
 * Pair with `setupWorkspaceHandlers` + `setupMattersLabHandlers` (the run's
 * matter picker reads the workspace's matters).
 */

import { Page } from "@playwright/test";

const NOW = "2026-06-01T00:00:00.000Z";

interface WorkflowStepState {
  ref: string;
  type: string;
  question?: string;
  title?: string;
  playbook_id?: string;
}
interface WorkflowState {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStepState[];
  created_at: string;
  updated_at: string;
}
interface StepResultState {
  ref: string;
  type: string;
  outcome: string;
  summary: string;
  artifacts: { type: string; id: string; title: string }[];
}
interface RunState {
  id: string;
  workflow_id: string;
  matter_id: string;
  status: "pending" | "running" | "completed" | "failed";
  step_results: StepResultState[];
  error_code: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  /** Outcomes revealed when the poll flips the run to `completed`. */
  _final: StepResultState[];
}

/** Map a step definition to its (mocked) honest outcome. */
function stepOutcome(step: WorkflowStepState): StepResultState {
  const base = { ref: step.ref, type: step.type };
  switch (step.type) {
    case "research_memo":
      // Honest abstention surfaced in the run — the trust posture, made visible.
      return {
        ...base,
        outcome: "abstained",
        summary:
          "No controlling authority surfaced for the question — refine it.",
        artifacts: [],
      };
    case "draft_memo":
      return {
        ...base,
        outcome: "completed",
        summary: "Drafted a memo grounded in the matter's findings.",
        artifacts: [{ type: "page", id: "pg_memo", title: "Memo" }],
      };
    case "analyze_documents":
      return {
        ...base,
        outcome: "completed",
        summary: "Analyzed the matter's documents for applicable law.",
        artifacts: [],
      };
    case "check_citations":
      return {
        ...base,
        outcome: "completed",
        summary: "Cite-checked the matter's documents against the corpus.",
        artifacts: [],
      };
    case "check_playbook":
      return {
        ...base,
        outcome: "completed",
        summary: "Checked the matter's documents against the playbook.",
        artifacts: [],
      };
    default:
      return { ...base, outcome: "skipped", summary: "", artifacts: [] };
  }
}

export async function setupLegalWorkflowsHandlers(page: Page): Promise<void> {
  const workflows: WorkflowState[] = [];
  const runs = new Map<string, RunState>();
  let seq = 0;
  const nextId = (prefix: string): string => {
    seq += 1;
    return `${prefix}_${seq}`;
  };

  // A couple of playbooks so the builder's check_playbook option is populated.
  await page.route(
    (url) => url.pathname === "/v1/legal/playbooks",
    async (route, request) => {
      if (request.method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          playbooks: [
            {
              id: "lpb_1",
              name: "Standard NDA",
              description: "",
              doc_type: null,
              created_at: NOW,
              updated_at: NOW,
            },
          ],
        }),
      });
    },
  );

  // GET (list) / POST (create) /v1/legal/workflows
  await page.route(
    (url) => url.pathname === "/v1/legal/workflows",
    async (route, request) => {
      const method = request.method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ workflows: workflows.slice() }),
        });
        return;
      }
      if (method !== "POST") {
        await route.fallback();
        return;
      }
      const body = (request.postDataJSON() ?? {}) as {
        name?: string;
        description?: string;
        steps?: WorkflowStepState[];
      };
      const workflow: WorkflowState = {
        id: nextId("lwf"),
        name: body.name ?? "Untitled workflow",
        description: body.description ?? "",
        steps: body.steps ?? [],
        created_at: NOW,
        updated_at: NOW,
      };
      workflows.push(workflow);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(workflow),
      });
    },
  );

  // GET / PATCH / DELETE /v1/legal/workflows/:id (not /run, /runs)
  await page.route(
    (url) => /^\/v1\/legal\/workflows\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      const id = new URL(request.url()).pathname.split("/").pop() ?? "";
      const idx = workflows.findIndex((w) => w.id === id);
      const method = request.method();
      if (method === "DELETE") {
        if (idx >= 0) workflows.splice(idx, 1);
        await route.fulfill({ status: 204 });
        return;
      }
      if (idx < 0) {
        await route.fulfill({ status: 404 });
        return;
      }
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(workflows[idx]),
        });
        return;
      }
      await route.fallback();
    },
  );

  // POST /v1/legal/workflows/:id/run → enqueue a run (202, running).
  await page.route(
    (url) => /^\/v1\/legal\/workflows\/[^/]+\/run$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const parts = new URL(request.url()).pathname.split("/");
      const workflowId = parts[parts.length - 2];
      const body = (request.postDataJSON() ?? {}) as { matter_id?: string };
      const workflow = workflows.find((w) => w.id === workflowId);
      const run: RunState = {
        id: nextId("lwr"),
        workflow_id: workflowId,
        matter_id: body.matter_id ?? "wi-matter-acme",
        status: "running",
        step_results: [],
        error_code: null,
        created_at: NOW,
        updated_at: NOW,
        started_at: NOW,
        finished_at: null,
        _final: (workflow?.steps ?? []).map(stepOutcome),
      };
      runs.set(run.id, run);
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify(toWire(run)),
      });
    },
  );

  // GET /v1/legal/workflows/:id/runs → list runs (newest first).
  await page.route(
    (url) => /^\/v1\/legal\/workflows\/[^/]+\/runs$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "GET") {
        await route.fallback();
        return;
      }
      const parts = new URL(request.url()).pathname.split("/");
      const workflowId = parts[parts.length - 2];
      const list = [...runs.values()]
        .filter((r) => r.workflow_id === workflowId)
        .reverse()
        .map(toWire);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ runs: list }),
      });
    },
  );

  // GET /v1/legal/workflows/:id/runs/:runId → poll; first read flips
  // running → completed and reveals the per-step outcomes.
  await page.route(
    (url) => /^\/v1\/legal\/workflows\/[^/]+\/runs\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "GET") {
        await route.fallback();
        return;
      }
      const runId = new URL(request.url()).pathname.split("/").pop() ?? "";
      const run = runs.get(runId);
      if (!run) {
        await route.fulfill({ status: 404 });
        return;
      }
      if (run.status === "running") {
        run.status = "completed";
        run.step_results = run._final;
        run.finished_at = NOW;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(toWire(run)),
      });
    },
  );
}

/** Project the internal run state to the wire shape (drops `_final`). */
function toWire(run: RunState) {
  const { _final, ...wire } = run;
  void _final;
  return wire;
}
