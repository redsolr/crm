/**
 * Folder Views API Client
 *
 * Hits `/api/folders/:id/views/*`. Views are implicit on folders —
 * `Folder` and the view envelopes (`FolderBoardView`, `FolderBacklogView`,
 * `FolderCalendarView`) come from the generated OpenAPI types —
 * snake_case wire shape per `docs/platform/api-discipline.md`.
 * `FolderViewWorkItem` is the narrow per-item projection view endpoints
 * return (distinct from the full `WorkItem` shape — view services
 * currently only join the state `key`, not the full state object).
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type {
  Folder as ApiFolder,
  FolderBacklogView,
  FolderBoardView,
  FolderCalendarView,
  FolderViewWorkItem,
} from "./generated/api/models";

export type {
  ApiFolder,
  FolderBacklogView,
  FolderBoardView,
  FolderCalendarView,
  FolderViewWorkItem,
};

// ============================================================================
// Types
// ============================================================================

export type Folder = ApiFolder;

/** View-settings JSONB blob stored on a folder. The wire ships
 *  `view_settings: any | null`; this interface narrows the inner shape
 *  for type-checked reads. */
export interface FolderViewSettings {
  board?: BoardViewSettings;
  backlog?: BacklogViewSettings;
  calendar?: CalendarViewSettings;
  timeline?: TimelineViewSettings;
}

export interface BoardViewSettings {
  columns?: string[]; // e.g., ['backlog', 'todo', 'in_progress', 'done']
}

export interface BacklogViewSettings {
  group_by?: string; // e.g., 'priority', 'iteration', 'none'
}

export interface CalendarViewSettings {
  default_view?: string; // e.g., 'month', 'week', 'day'
}

export interface TimelineViewSettings {
  zoom?: string; // e.g., 'day', 'week', 'month', 'quarter'
}

// Re-export the generated view envelopes under the names the API client
// uses, for source-stability while migrating call sites.
export type FolderBoardViewResponse = FolderBoardView;
export type FolderBacklogViewResponse = FolderBacklogView;
export type FolderCalendarViewResponse = FolderCalendarView;

// ============================================================================
// Request Types
// ============================================================================

// Update view settings request
export interface UpdateFolderViewSettingsRequest {
  board?: BoardViewSettings;
  backlog?: BacklogViewSettings;
  calendar?: CalendarViewSettings;
  timeline?: TimelineViewSettings;
}

// ============================================================================
// API Client
// ============================================================================

class FolderViewsApiClient extends BaseApiClient {
  /**
   * Get Board view for a folder. Returns `FolderViewWorkItem` (a narrow
   * projection — view services currently join only the state `key`,
   * not the full state object) grouped by status columns.
   */
  async getFolderBoardView(folder_id: string): Promise<FolderBoardViewResponse> {
    return this.request<FolderBoardViewResponse>(
      `/folders/${folder_id}/views/board`,
    );
  }

  /**
   * Get Backlog view for a folder. Returns `FolderViewWorkItem[]` as a
   * flat list sorted by position.
   */
  async getFolderBacklogView(
    folder_id: string,
  ): Promise<FolderBacklogViewResponse> {
    return this.request<FolderBacklogViewResponse>(
      `/folders/${folder_id}/views/backlog`,
    );
  }

  /**
   * Get Calendar view for a folder. Returns `FolderViewWorkItem[]`
   * grouped by due date within the given date range.
   */
  async getFolderCalendarView(
    folder_id: string,
    start_date: string,
    end_date: string,
  ): Promise<FolderCalendarViewResponse> {
    const params = new URLSearchParams();
    params.set("start_date", start_date);
    params.set("end_date", end_date);
    return this.request<FolderCalendarViewResponse>(
      `/folders/${folder_id}/views/calendar?${params.toString()}`,
    );
  }

  /**
   * Update view settings for a folder.
   * Configure column order, grouping, zoom levels, etc.
   */
  async updateFolderViewSettings(
    folder_id: string,
    settings: UpdateFolderViewSettingsRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ folder: Folder }> {
    return this.request<{ folder: Folder }>(
      `/folders/${folder_id}/views/settings`,
      {
        method: "PUT",
        body: JSON.stringify(settings),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }
}

export const folderViewsApi = new FolderViewsApiClient();
