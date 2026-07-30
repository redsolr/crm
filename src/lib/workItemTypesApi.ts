/**
 * Work-item-types API Client.
 *
 * `GET /api/workspaces/:workspaceId/work_item_types` — the per-workspace
 * registry of work-item kinds (Task / Bug / Account / Opportunity /
 * Call Note / Commitment / etc.). Each entry points at one workflow
 * via `default_workflow_id` (the canonical wire field — matches
 * `WorkItemTypeResponseDto` on the platform).
 *
 * Workspace rename arc (2026-05-27): the per-project URL surface
 * `/api/projects/:projectId/work_item_types` was renamed to
 * `/api/workspaces/:workspaceId/work_item_types`; the row's
 * `project_id` field was renamed to `workspace_id`. Hook parameter
 * names at call sites that still read `projectId` are JS-locals
 * carrying the active workspace id on the wire.
 */

import { BaseApiClient } from "./api-client";

export interface WorkItemTypeRow {
  id: string;
  workspace_id: string;
  key: string;
  name: string;
  description: string | null;
  default_workflow_id: string;
  template_id: string | null;
  created_at: string;
  updated_at: string;
}

class WorkItemTypesApiClient extends BaseApiClient {
  async listWorkspaceWorkItemTypes(
    workspaceId: string,
  ): Promise<{ data: WorkItemTypeRow[] }> {
    return this.request<{ data: WorkItemTypeRow[] }>(
      `/workspaces/${workspaceId}/work_item_types`,
    );
  }
}

export const workItemTypesApi = new WorkItemTypesApiClient();
