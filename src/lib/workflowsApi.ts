/**
 * Workflows + workflow_states API Client.
 *
 * `GET /api/workspaces/:workspaceId/workflows` — workflows in a workspace.
 * `GET /api/workflows/:workflowId/states` — states inside one workflow.
 * Workflow state mutations are admin-only; this client only reads.
 *
 * Workspace rename arc (2026-05-27): the per-project URL surface
 * `/api/projects/:projectId/workflows` was renamed to
 * `/api/workspaces/:workspaceId/workflows`; the `Workflow.project_id`
 * field was renamed to `Workflow.workspace_id`. Hook parameter names
 * at call sites that still read `projectId` are JS-locals carrying
 * the active workspace id on the wire.
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";

export interface Workflow {
  id: string;
  workspace_id: string;
  key: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowState {
  id: string;
  workflow_id: string;
  key: string;
  name: string;
  category: "not_started" | "active" | "done" | "dead";
  position: number;
  created_at: string;
  updated_at: string;
}

class WorkflowsApiClient extends BaseApiClient {
  async listWorkspaceWorkflows(
    workspaceId: string,
  ): Promise<{ data: Workflow[] }> {
    return this.request<{ data: Workflow[] }>(
      `/workspaces/${workspaceId}/workflows`,
    );
  }

  async listStates(
    workflowId: string,
  ): Promise<{ data: WorkflowState[] }> {
    return this.request<{ data: WorkflowState[] }>(
      `/workflows/${workflowId}/states`,
    );
  }

  /** Rename a workflow state (a board lane). `PATCH /api/workflow_states/:id`. */
  async updateState(
    stateId: string,
    patch: { name?: string },
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ state: WorkflowState }> {
    return this.request<{ state: WorkflowState }>(
      `/workflow_states/${stateId}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }
}

export const workflowsApi = new WorkflowsApiClient();
