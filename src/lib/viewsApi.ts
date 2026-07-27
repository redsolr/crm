/**
 * Saved Views API Client
 *
 * Hits `/v1/views` — durable, user-created saved query specs for the
 * board / backlog surfaces (NOT the per-folder implicit `view_settings`,
 * which live behind `folderViewsApi`). The platform stores `query`
 * opaquely; the consumer (here) owns its shape. For `kind: 'work_items'`
 * we serialize `{ filters, groupBy }` into it — see
 * `use-saved-views.ts` / `WorkItemsViewQuery`.
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";

export type ViewVisibility = "private" | "shared";

/** A saved view row, mirroring the `/v1/views` wire shape (snake_case). */
export interface SavedView {
  id: string;
  name: string;
  kind: string;
  visibility: ViewVisibility;
  workspace_id: string;
  owner_account_id: string;
  owner_name: string | null;
  query: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateViewRequest {
  name: string;
  kind: string;
  visibility?: ViewVisibility;
  query?: Record<string, unknown>;
}

export interface UpdateViewRequest {
  name?: string;
  visibility?: ViewVisibility;
  query?: Record<string, unknown>;
}

export interface ListViewsOptions {
  kind?: string;
  visibility?: ViewVisibility;
  /** `'me'` resolves to the caller; or an explicit `acc_*` owner id. */
  owner?: string;
}

class ViewsApiClient extends BaseApiClient {
  async listViews(options?: ListViewsOptions): Promise<SavedView[]> {
    const params = new URLSearchParams();
    if (options?.kind) params.set("kind", options.kind);
    if (options?.visibility) params.set("visibility", options.visibility);
    if (options?.owner) params.set("owner", options.owner);
    const qs = params.toString();
    const raw = await this.request<{ data: SavedView[] }>(
      `/views${qs ? `?${qs}` : ""}`,
      { method: "GET" },
    );
    return raw.data;
  }

  async createView(
    request: CreateViewRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<SavedView> {
    const raw = await this.request<{ view: SavedView }>("/views", {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return raw.view;
  }

  async updateView(
    id: string,
    request: UpdateViewRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<SavedView> {
    const raw = await this.request<{ view: SavedView }>(`/views/${id}`, {
      method: "PATCH",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return raw.view;
  }

  async deleteView(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>(`/views/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }
}

export const viewsApi = new ViewsApiClient();
