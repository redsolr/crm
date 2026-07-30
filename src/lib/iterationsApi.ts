/**
 * Iterations API Client
 *
 * Hits `/api/iterations` — sprint primitive scoped to a workspace.
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type { CursorPage } from "./pagination";
import type {
  Iteration as ApiIteration,
  IterationMetrics as ApiIterationMetrics,
  WorkItem as ApiWorkItem,
} from "./generated/api/models";

// ============================================================================
// Types
// ============================================================================

/** Iteration lifecycle status. */
export type IterationStatus = "planning" | "active" | "completed";

// Iteration / sprint — re-exported from generated types (snake_case wire).
export type Iteration = ApiIteration;

// Iteration velocity metrics — re-exported from generated types.
export type IterationMetrics = ApiIterationMetrics;

// ============================================================================
// Request Types
// ============================================================================

export interface CreateIterationRequest {
  name: string;
  goal?: string;
  /** Workspace (`ws_`-prefixed) the iteration belongs to. */
  workspace_id: string;
  start_date?: string;
  end_date?: string;
}

export interface UpdateIterationRequest {
  name?: string;
  goal?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface StartIterationRequest {
  start_date?: string;
  end_date?: string;
}

export interface CompleteIterationRequest {
  /** Iteration to move unfinished work items to; omit = back to backlog. */
  move_unfinished_to?: string;
}

// ============================================================================
// Response Types
// ============================================================================

// Iteration responses — cursor-paginated.
export type IterationsListResponse = CursorPage<ApiIteration>;

export type IterationWorkItemsResponse = CursorPage<ApiWorkItem>;

export interface IterationMetricsResponse {
  metrics: IterationMetrics;
}

// ============================================================================
// Query Options
// ============================================================================

export interface ListIterationsOptions {
  workspace_id?: string;
  status?: IterationStatus;
  page_size?: number;
  page_token?: string;
}

// ============================================================================
// API Client
// ============================================================================

class IterationsApiClient extends BaseApiClient {
  async createIteration(
    request: CreateIterationRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ iteration: Iteration }> {
    const raw = await this.request<{ iteration: ApiIteration }>(
      "/iterations",
      {
        method: "POST",
        body: JSON.stringify(request),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    return { iteration: raw.iteration };
  }

  async listIterations(
    options?: ListIterationsOptions,
  ): Promise<IterationsListResponse> {
    const params = new URLSearchParams();
    // BE `listIterationsQuerySchema` is snake_case (Stripe v2 style).
    if (options?.workspace_id)
      params.set("workspace_id", options.workspace_id);
    if (options?.status) params.set("status", options.status);
    if (options?.page_size)
      params.set("page_size", String(options.page_size));
    if (options?.page_token) params.set("page_token", options.page_token);

    const query = params.toString();
    return this.request<CursorPage<ApiIteration>>(
      `/iterations${query ? `?${query}` : ""}`,
    );
  }

  async listIterationsByWorkspace(
    workspace_id: string,
  ): Promise<IterationsListResponse> {
    return this.listIterations({ workspace_id });
  }

  async getActiveIteration(
    workspace_id: string,
  ): Promise<{ iteration: Iteration | null }> {
    const raw = await this.request<{ iteration: ApiIteration | null }>(
      `/iterations/active?workspace_id=${encodeURIComponent(workspace_id)}`,
    );
    return {
      iteration: raw.iteration ? raw.iteration : null,
    };
  }

  async getIteration(id: string): Promise<{ iteration: Iteration }> {
    const raw = await this.request<{ iteration: ApiIteration }>(
      `/iterations/${id}`,
    );
    return { iteration: raw.iteration };
  }

  async getIterationWorkItems(
    id: string,
  ): Promise<IterationWorkItemsResponse> {
    // BE accepts `?iteration_id=` (snake_case) per `listWorkItemsQuerySchema`.
    return this.request<CursorPage<ApiWorkItem>>(
      `/work_items?iteration_id=${encodeURIComponent(id)}`,
    );
  }

  async getIterationMetrics(id: string): Promise<IterationMetricsResponse> {
    const raw = await this.request<{ metrics: ApiIterationMetrics }>(
      `/iterations/${id}/metrics`,
    );
    return { metrics: raw.metrics };
  }

  async updateIteration(
    id: string,
    request: UpdateIterationRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ iteration: Iteration }> {
    const raw = await this.request<{ iteration: ApiIteration }>(
      `/iterations/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(request),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    return { iteration: raw.iteration };
  }

  async startIteration(
    id: string,
    request: StartIterationRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ iteration: Iteration }> {
    const raw = await this.request<{ iteration: ApiIteration }>(
      `/iterations/${id}/start`,
      {
        method: "POST",
        body: JSON.stringify(request),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    return { iteration: raw.iteration };
  }

  async completeIteration(
    id: string,
    request: CompleteIterationRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ iteration: Iteration }> {
    const raw = await this.request<{ iteration: ApiIteration }>(
      `/iterations/${id}/complete`,
      {
        method: "POST",
        body: JSON.stringify(request),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    return { iteration: raw.iteration };
  }

  async deleteIteration(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>(`/iterations/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }
}

export const iterationsApi = new IterationsApiClient();
