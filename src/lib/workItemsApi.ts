/**
 * Work Items API Client
 *
 * Hits `/api/work_items` — the recursive content primitive (replaces
 * `tasks`, `epics`, etc.). Workflow states are an open set —
 * `WorkItem.status` is a computed mirror of `state.key` for UI code that
 * reads a simple string. `state` carries the full (id, key, name,
 * category) payload so richer views can filter by `state.category`.
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import { extractNextPageToken, type CursorPage } from "./pagination";
import type { WorkItem as ApiWorkItem } from "./generated/api/models";
import type { WorkflowStateId, WorkItemTypeId } from "./ids";

// ============================================================================
// Types
// ============================================================================

/** Work-item priority enum — matches the platform `work_items.priority`. */
export type WorkItemPriority = "none" | "low" | "medium" | "high" | "urgent";

/** Workflow-state bucket — the platform-wide category above tenant keys. */
export type WorkflowStateCategory =
  | "not_started"
  | "active"
  | "done"
  | "dead";

/** Work-item visibility — matches the platform `Visibility` enum on the
 *  public spec. `internal` is the org-only tier; `public` opens to the
 *  public roadmap; `private` is owner-scope only. */
export type WorkItemVisibility = "private" | "internal" | "public";

/** Inline workflow-state payload on a work item. */
export interface WorkItemState {
  id: WorkflowStateId;
  key: string;
  name: string;
  category: WorkflowStateCategory;
}

/** Inline work-item-type payload on a work item. */
export interface WorkItemType {
  id: WorkItemTypeId;
  key: string;
  name: string;
}

/**
 * WorkItem — re-exported from the generated wire shape. snake_case
 * keys per `docs/platform/api-discipline.md`. Includes `state`, `type`,
 * `version` (AIP-154 optimistic concurrency), `dri_id`.
 */
export type WorkItem = ApiWorkItem;

// ============================================================================
// Request Types
// ============================================================================

export interface CreateWorkItemRequest {
  title: string;
  subject?: string;
  description?: string;
  workspace_id: string;
  /** Workflow-state key to seed at. Defaults to 'backlog'. */
  state_key?: string;
  /** Work-item-type key. Defaults to 'task'. */
  type_key?: string;
  priority?: WorkItemPriority;
  due_date?: string;
  estimate?: number;
  iteration_id?: string;
  epic_id?: string;
  folder_id?: string;
  assignee_id?: string;
  parent_id?: string;
  label_ids?: string[];
}

export interface UpdateWorkItemRequest {
  title?: string;
  subject?: string | null;
  description?: string | null;
  /** Workflow-state key. Open-set; must be registered for the type's workflow. */
  state_key?: string;
  priority?: WorkItemPriority;
  position?: number;
  due_date?: string | null;
  estimate?: number | null;
  iteration_id?: string | null;
  epic_id?: string | null;
  assignee_id?: string | null;
  parent_id?: string | null;
  label_ids?: string[];
}

export interface MoveWorkItemRequest {
  /** Target workflow-state key. */
  state_key: string;
  position?: number;
}

export interface AssignWorkItemToIterationRequest {
  iteration_id: string | null; // null = back to backlog
  position?: number;
}

export interface BulkUpdateWorkItemsRequest {
  work_item_ids: string[];
  state_key?: string;
  priority?: WorkItemPriority;
  assignee_id?: string | null;
  iteration_id?: string | null;
  epic_id?: string | null;
  add_label_ids?: string[];
  remove_label_ids?: string[];
}

// ============================================================================
// Response Types
// ============================================================================

// WorkItem responses — cursor-paginated.
export type WorkItemsListResponse = CursorPage<WorkItem>;

type WorkItemEnvelope =
  | { workItem: ApiWorkItem; work_item?: never }
  | { work_item: ApiWorkItem; workItem?: never };

type WorkItemsEnvelope =
  | { workItems: ApiWorkItem[]; work_items?: never }
  | { work_items: ApiWorkItem[]; workItems?: never };

// ============================================================================
// Query Options
// ============================================================================

/**
 * Filters for `GET /api/work_items`. All field names are snake_case per
 * `docs/platform/api-discipline.md` § A3 (Stripe v2 style) — matches
 * the BE `listWorkItemsQuerySchema`. Cursor pagination uses `page_size`
 * and `page_token`. `workspace_id` (a `ws_`-prefixed id) scopes the
 * listing; omitting it defaults to the JWT-bound workspace.
 */
export interface ListWorkItemsOptions {
  workspace_id?: string;
  iteration_id?: string;
  assignee_id?: string;
  parent_id?: string;
  /** Workflow-state key (open-set). */
  state_key?: string;
  /** Workflow-state category bucket. */
  state_category?: WorkflowStateCategory;
  /** Work-item-type key. */
  type_key?: string;
  page_size?: number;
  page_token?: string;
  /** Comma-separated list of relations to inline-expand. */
  include?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Build the weak ETag header value (`W/"v<n>"`) for `If-Match`
 *  round-tripping per `docs/platform/api-discipline.md` § C4. */
function ifMatchTag(version: number): string {
  return `W/"v${version}"`;
}

function unwrapWorkItem(raw: WorkItemEnvelope): ApiWorkItem {
  const workItem = "workItem" in raw ? raw.workItem : raw.work_item;
  if (workItem === undefined) {
    throw new Error("Missing work item in response envelope");
  }
  return workItem;
}

function unwrapWorkItems(raw: WorkItemsEnvelope): ApiWorkItem[] {
  const workItems = "workItems" in raw ? raw.workItems : raw.work_items;
  if (workItems === undefined) {
    throw new Error("Missing work items in response envelope");
  }
  return workItems;
}

// ============================================================================
// API Client
// ============================================================================

class WorkItemsApiClient extends BaseApiClient {
  async createWorkItem(
    request: CreateWorkItemRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ workItem: WorkItem }> {
    const raw = await this.request<WorkItemEnvelope>("/work_items", {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return { workItem: unwrapWorkItem(raw) };
  }

  async listWorkItems(
    options?: ListWorkItemsOptions,
  ): Promise<WorkItemsListResponse> {
    const params = new URLSearchParams();
    // BE `listWorkItemsQuerySchema` is snake_case (Stripe v2 style):
    // workspace_id, iteration_id, assignee_id, parent_id, state_key,
    // state_category, type_key.
    if (options?.workspace_id)
      params.set("workspace_id", options.workspace_id);
    if (options?.iteration_id)
      params.set("iteration_id", options.iteration_id);
    if (options?.assignee_id)
      params.set("assignee_id", options.assignee_id);
    if (options?.parent_id) params.set("parent_id", options.parent_id);
    if (options?.state_key) params.set("state_key", options.state_key);
    if (options?.state_category)
      params.set("state_category", options.state_category);
    if (options?.type_key) params.set("type_key", options.type_key);
    if (options?.page_size)
      params.set("page_size", String(options.page_size));
    if (options?.page_token) params.set("page_token", options.page_token);
    if (options?.include) params.set("include", options.include);

    const query = params.toString();
    return this.request<CursorPage<ApiWorkItem>>(
      `/work_items${query ? `?${query}` : ""}`,
    );
  }

  /**
   * Fetch EVERY work item matching `options`, transparently walking the
   * Stripe v2 cursor pages. The platform caps `page_size` at 100, so
   * "give me the whole set on first paint" callers must page rather than
   * ask for one oversized page (a `page_size > 100` request is a 422).
   * Each page is the max 100; we ferry the opaque `page_token` from
   * `next_page_url` until `has_more` is false. `page_size` / `page_token`
   * on the passed `options` are ignored — this method owns pagination.
   */
  async listAllWorkItems(
    options?: Omit<ListWorkItemsOptions, "page_size" | "page_token">,
  ): Promise<WorkItem[]> {
    const all: WorkItem[] = [];
    let pageToken: string | undefined = undefined;
    // Hard bound (100 pages × 100 = 10k items) so a server bug returning
    // a perpetual `has_more` can't spin forever.
    for (let i = 0; i < 100; i++) {
      const page = await this.listWorkItems({
        ...options,
        page_size: 100,
        page_token: pageToken,
      });
      all.push(...page.data);
      if (!page.has_more) break;
      pageToken = extractNextPageToken(page.next_page_url);
      if (pageToken === undefined) break;
    }
    return all;
  }

  async assignWorkItemToIteration(
    workItemId: string,
    version: number,
    request: AssignWorkItemToIterationRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ workItem: WorkItem }> {
    return this.updateWorkItem(
      workItemId,
      {
        iteration_id: request.iteration_id,
        ...(request.position !== undefined
          ? { position: request.position }
          : {}),
      },
      version,
      idempotencyKey,
    );
  }

  async getWorkItem(id: string): Promise<{ workItem: WorkItem }> {
    const raw = await this.request<WorkItemEnvelope>(
      `/work_items/${id}`,
    );
    return { workItem: unwrapWorkItem(raw) };
  }

  async getSubWorkItems(
    workItemId: string,
  ): Promise<{ workItems: WorkItem[] }> {
    const raw = await this.request<WorkItemsEnvelope>(
      `/work_items/${workItemId}/subtasks`,
    );
    return { workItems: unwrapWorkItems(raw) };
  }

  /**
   * PATCH /work_items/:id with optimistic-concurrency check.
   *
   * Per `docs/platform/api-discipline.md` § C4, work_items requires
   * `If-Match: W/"v<n>"` on every mutation; the server returns 412
   * `version_conflict` on stale version and 428 `precondition_required`
   * if the header is missing. Pass the `version` from the WorkItem the
   * caller is editing.
   */
  async updateWorkItem(
    id: string,
    request: UpdateWorkItemRequest,
    version: number,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ workItem: WorkItem }> {
    const raw = await this.request<WorkItemEnvelope>(
      `/work_items/${id}`,
      {
        method: "PATCH",
        headers: {
          "If-Match": ifMatchTag(version),
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(request),
      },
    );
    return { workItem: unwrapWorkItem(raw) };
  }

  async moveWorkItem(
    id: string,
    request: MoveWorkItemRequest,
    version: number,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ workItem: WorkItem }> {
    // `/work_items` has no separate move endpoint — state + position
    // updates go through PATCH.
    return this.updateWorkItem(
      id,
      {
        state_key: request.state_key,
        ...(request.position !== undefined
          ? { position: request.position }
          : {}),
      },
      version,
      idempotencyKey,
    );
  }

  /**
   * POST /work_items/bulk — exempt from `If-Match` (the per-item
   * version is unknowable in a single envelope). Concurrent writers
   * to overlapping IDs may interleave; treat bulk as eventual-state.
   */
  async bulkUpdateWorkItems(
    request: BulkUpdateWorkItemsRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ workItems: WorkItem[] }> {
    const raw = await this.request<WorkItemsEnvelope>(
      "/work_items/bulk",
      {
        method: "POST",
        body: JSON.stringify(request),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    return { workItems: unwrapWorkItems(raw) };
  }

  async deleteWorkItem(
    id: string,
    version: number,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>(`/work_items/${id}`, {
      method: "DELETE",
      headers: {
        "If-Match": ifMatchTag(version),
        "Idempotency-Key": idempotencyKey,
      },
    });
  }
}

export const workItemsApi = new WorkItemsApiClient();
