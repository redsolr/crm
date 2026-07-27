"use client";

/**
 * `legalWorkflowsApi` — the firm-facing "save a reusable legal automation and
 * re-run it on new matters" surface (`/v1/legal/workflows`; Harvey "Workflow /
 * Agent Builder", Legora "Workflows"). A workflow is a saved, ordered list of
 * legal STEPS drawn from a CLOSED, curated set (research a question, draft from
 * findings, analyze documents, cite-check, playbook-check) — deliberately NOT an
 * open "call any tool" builder. `POST …/:id/run` enqueues an async execution
 * against a matter (202) and the FE polls `GET …/:id/runs/:runId`; each step
 * dispatches to the existing legal services, so the trust spine (grounding,
 * abstention, metering, provenance) is reused, not re-implemented. Workspace
 * context as `Jurisimus-Workspace-Id`.
 *
 * Platform module: `platform/src/modules/legal-workflows/`.
 */
import { z } from "zod";
import { BaseApiClient } from "../api-client";
import { freshIdempotencyKey } from "../idempotency";

// ---------------------------------------------------------------------------
// Step definition — the CLOSED union the builder offers (mirrors the platform
// `workflowStepSchema`). Flat + snake_case; type-specific fields are optional on
// the wire and validated server-side by `type`.
// ---------------------------------------------------------------------------

export const WORKFLOW_STEP_TYPES = [
  "research_memo",
  "draft_memo",
  "analyze_documents",
  "check_citations",
  "check_playbook",
] as const;
export type WorkflowStepType = (typeof WORKFLOW_STEP_TYPES)[number];

const WorkflowStepSchema = z.object({
  ref: z.string(),
  type: z.enum(WORKFLOW_STEP_TYPES),
  question: z.string().optional(),
  title: z.string().optional(),
  playbook_id: z.string().optional(),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  steps: z.array(WorkflowStepSchema),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

const WorkflowStepResultSchema = z.object({
  ref: z.string(),
  type: z.string(),
  /** completed | abstained | skipped | failed. */
  outcome: z.string(),
  summary: z.string(),
  artifacts: z.array(
    z.object({ type: z.string(), id: z.string(), title: z.string() }),
  ),
  documents: z
    .array(
      z.object({
        page_id: z.string(),
        title: z.string(),
        outcome: z.string(),
        summary: z.string(),
      }),
    )
    .optional(),
});
export type WorkflowStepResult = z.infer<typeof WorkflowStepResultSchema>;

export const WORKFLOW_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;

const WorkflowRunSchema = z.object({
  id: z.string(),
  workflow_id: z.string(),
  matter_id: z.string(),
  status: z.enum(WORKFLOW_RUN_STATUSES),
  step_results: z.array(WorkflowStepResultSchema),
  /** Terminal failure reason when `status='failed'`, else null. */
  error_code: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

const WorkflowListSchema = z.object({ workflows: z.array(WorkflowSchema) });
const RunListSchema = z.object({ runs: z.array(WorkflowRunSchema) });

// ---------------------------------------------------------------------------
// Request payloads.
// ---------------------------------------------------------------------------

/** One step as the builder submits it (only the fields its type needs). */
export interface WorkflowStepInput {
  ref: string;
  type: WorkflowStepType;
  question?: string;
  title?: string;
  playbook_id?: string;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  steps: WorkflowStepInput[];
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  steps?: WorkflowStepInput[];
}

class LegalWorkflowsApiClient extends BaseApiClient {
  /** The workspace's saved workflows. */
  async list(workspaceId: string): Promise<Workflow[]> {
    const res = await this.request<unknown>("/legal/workflows", {
      method: "GET",
      headers: { "Jurisimus-Workspace-Id": workspaceId },
    });
    return WorkflowListSchema.parse(res).workflows;
  }

  async get(id: string, workspaceId: string): Promise<Workflow> {
    const res = await this.request<unknown>(
      `/legal/workflows/${encodeURIComponent(id)}`,
      { method: "GET", headers: { "Jurisimus-Workspace-Id": workspaceId } },
    );
    return WorkflowSchema.parse(res);
  }

  async create(
    input: CreateWorkflowInput,
    workspaceId: string,
  ): Promise<Workflow> {
    const res = await this.request<unknown>("/legal/workflows", {
      method: "POST",
      body: JSON.stringify(input),
      headers: {
        "Jurisimus-Workspace-Id": workspaceId,
        "Idempotency-Key": freshIdempotencyKey(),
      },
    });
    return WorkflowSchema.parse(res);
  }

  async update(
    id: string,
    input: UpdateWorkflowInput,
    workspaceId: string,
  ): Promise<Workflow> {
    const res = await this.request<unknown>(
      `/legal/workflows/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return WorkflowSchema.parse(res);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    await this.request<unknown>(
      `/legal/workflows/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
  }

  /** Enqueue an async run of a workflow against a matter (202). */
  async run(
    id: string,
    matterId: string,
    workspaceId: string,
  ): Promise<WorkflowRun> {
    const res = await this.request<unknown>(
      `/legal/workflows/${encodeURIComponent(id)}/run`,
      {
        method: "POST",
        body: JSON.stringify({ matter_id: matterId }),
        headers: {
          "Jurisimus-Workspace-Id": workspaceId,
          "Idempotency-Key": freshIdempotencyKey(),
        },
      },
    );
    return WorkflowRunSchema.parse(res);
  }

  /** A workflow's runs, newest first (server-ordered). */
  async listRuns(id: string, workspaceId: string): Promise<WorkflowRun[]> {
    const res = await this.request<unknown>(
      `/legal/workflows/${encodeURIComponent(id)}/runs`,
      { method: "GET", headers: { "Jurisimus-Workspace-Id": workspaceId } },
    );
    return RunListSchema.parse(res).runs;
  }

  /** Poll a run's status + step-by-step outcomes (the audit trail). */
  async getRun(
    id: string,
    runId: string,
    workspaceId: string,
  ): Promise<WorkflowRun> {
    const res = await this.request<unknown>(
      `/legal/workflows/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}`,
      { method: "GET", headers: { "Jurisimus-Workspace-Id": workspaceId } },
    );
    return WorkflowRunSchema.parse(res);
  }
}

export const legalWorkflowsApi = new LegalWorkflowsApiClient();
