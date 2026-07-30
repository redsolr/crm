/**
 * Labels API Client
 *
 * Workspace-scoped taxonomy primitive. Hits:
 *   - POST   /api/workspaces/:workspaceId/labels
 *   - GET    /api/workspaces/:workspaceId/labels
 *   - GET    /api/labels/:id
 *   - PATCH  /api/labels/:id
 *   - DELETE /api/labels/:id
 *
 * Cross-workspace label attachments to work items reject with
 * `label_wrong_workspace`. Labels can opt into workspace-level templates
 * via `template_id`; while inherited, mutable fields are read-only and
 * mutating them returns 409 `template_inherited_read_only`.
 *
 * Workspace rename arc (2026-05-27): the per-project URL surface
 * `/api/projects/:projectId/labels` was renamed to
 * `/api/workspaces/:workspaceId/labels`; the `Label.project_id` field
 * was renamed to `Label.workspace_id`. Hook parameter names at call
 * sites that still read `projectId` are JS-locals carrying the active
 * workspace id on the wire — broader consumer-side rename is the
 * workspace-rename adoption sweep's scope, not this fix's.
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type { LabelId, LabelTemplateId, WorkspaceId } from "./ids";

// ============================================================================
// Types
// ============================================================================

export interface Label {
  id: LabelId;
  workspace_id: WorkspaceId;
  key: string; // rename-safe slug, [a-z][a-z0-9_]{0,39}
  name: string; // display label
  color: string; // hex with leading #
  description: string | null;
  template_id: LabelTemplateId | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Request Types
// ============================================================================

export interface CreateLabelRequest {
  /** Slug — `[a-z][a-z0-9_]{0,39}`. Stable across renames. */
  key: string;
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateLabelRequest {
  key?: string;
  name?: string;
  color?: string;
  /** Pass `null` to clear, omit to leave unchanged. */
  description?: string | null;
}

// ============================================================================
// Response Types
// ============================================================================

// Label responses — `/api/workspaces/:workspaceId/labels` returns a
// simple `{ data }` shape (no pagination markers; labels are bounded
// per workspace).
export interface LabelsListResponse {
  data: Label[];
}

// ============================================================================
// Query Options
// ============================================================================

/**
 * Labels are workspace-scoped on the BE — `workspaceId` is required
 * for both listing and creation.
 */
export interface ListLabelsOptions {
  workspaceId: string;
}

// ============================================================================
// API Client
// ============================================================================

class LabelsApiClient extends BaseApiClient {
  async createLabel(
    workspaceId: string,
    request: CreateLabelRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ label: Label }> {
    return this.request<{ label: Label }>(
      `/workspaces/${workspaceId}/labels`,
      {
        method: "POST",
        body: JSON.stringify(request),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }

  /**
   * List labels in a workspace. Returns a simple `{ data: Label[] }`
   * envelope — no pagination markers, no `total`.
   */
  async listLabels(options: ListLabelsOptions): Promise<LabelsListResponse> {
    return this.request<LabelsListResponse>(
      `/workspaces/${options.workspaceId}/labels`,
    );
  }

  async getLabel(id: string): Promise<{ label: Label }> {
    return this.request<{ label: Label }>(`/labels/${id}`);
  }

  async updateLabel(
    id: string,
    request: UpdateLabelRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ label: Label }> {
    return this.request<{ label: Label }>(`/labels/${id}`, {
      method: "PATCH",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async deleteLabel(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>(`/labels/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }
}

export const labelsApi = new LabelsApiClient();
