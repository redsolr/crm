/**
 * Activities API Client
 *
 * Hits `/v1/activities` — audit/change feed for workspaces, entities,
 * and the current user.
 *
 * Workspace rename arc (2026-05-27): the per-project feed endpoint
 * `GET /v1/activities/project/:projectId` was renamed to
 * `GET /v1/activities/workspace` — the workspace is now resolved from
 * the caller credential (API key, JWT, or PAT). The hook parameter
 * name `project_id` is preserved at call sites as a JS-local; it
 * carries the active workspace id on the wire.
 */

import { BaseApiClient } from "./api-client";
import type { ActivityId, ProjectId } from "./ids";

// ============================================================================
// Types
// ============================================================================

// Activity entity
export interface Activity {
  id: ActivityId;
  type: string; // e.g., "work_item_created", "work_item_status_changed"
  entity_type: string; // e.g., "work_item", "iteration", "epic"
  entity_id: string; // polymorphic — discriminated by entity_type
  entity_identifier: string | null; // e.g., "WEB-42"
  project_id: ProjectId;
  actor_id: string; // polymorphic — discriminated by actor_type
  changes: Record<string, unknown> | null;
  created_at: string;
}

// Activity with actor info
export interface ActivityWithActor {
  activity: Activity;
  actor: {
    id: string;
    email: string;
  };
}

// ============================================================================
// Response Types
// ============================================================================

// Activity responses.
//
// `/v1/activities` (sidebar) returns `{ activities, total }`.
// `/v1/activities/workspace`, `/v1/activities/entity/:type/:id`,
// `/v1/activities/me` return `{ activities }` (no total — the BE feed
// is bounded server-side at ~50 rows).
//
// Note: BE returns bare `Activity` rows (no actor join). The historic
// FE `ActivityWithActor` type predates Session 21 and is no longer
// emitted by any endpoint — call sites are responsible for wrapping
// or adapting.
export interface ActivitiesListResponse {
  activities: Activity[];
  total: number;
}

export interface ActivityFeedResponse {
  activities: Activity[];
}

// ============================================================================
// Query Options
// ============================================================================

export interface ListActivitiesOptions {
  workspace_id?: string;
  entity_type?: string;
  entity_id?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// API Client
// ============================================================================

class ActivitiesApiClient extends BaseApiClient {
  async listActivities(
    options?: ListActivitiesOptions,
  ): Promise<ActivitiesListResponse> {
    const params = new URLSearchParams();
    if (options?.workspace_id) params.set("workspace_id", options.workspace_id);
    if (options?.entity_type) params.set("entity_type", options.entity_type);
    if (options?.entity_id) params.set("entity_id", options.entity_id);
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));

    const query = params.toString();
    return this.request<ActivitiesListResponse>(
      `/activities${query ? `?${query}` : ""}`,
    );
  }

  /**
   * List activities for the caller's active workspace. The workspace
   * is resolved server-side from the auth principal (API key tuple,
   * JWT claim, or `Jurisimus-Workspace-Id` override).
   */
  async listWorkspaceActivities(): Promise<ActivityFeedResponse> {
    return this.request<ActivityFeedResponse>("/activities/workspace");
  }

  async listEntityActivities(
    entity_type: string,
    entity_id: string,
  ): Promise<ActivityFeedResponse> {
    return this.request<ActivityFeedResponse>(
      `/activities/entity/${entity_type}/${entity_id}`,
    );
  }

  async listMyActivities(): Promise<ActivityFeedResponse> {
    return this.request<ActivityFeedResponse>("/activities/me");
  }
}

export const activitiesApi = new ActivitiesApiClient();
