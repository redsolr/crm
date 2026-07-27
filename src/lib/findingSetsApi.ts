import { BaseApiClient } from "./api-client";
import type { Finding } from "./findingsApi";
import { freshIdempotencyKey } from "./idempotency";
import type { AccountId, FindingId, FindingSetId } from "./ids";

// ============================================================================
// Finding Sets API Types & Methods (Group findings into documents)
// ============================================================================

export interface FindingSet {
  id: FindingSetId;
  name: string;
  description: string | null;
  findingIds: FindingId[];
  findingsCount: number;
  userId: string;
  account_id: AccountId | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFindingSetRequest {
  name: string;
  description?: string;
  findingIds: string[];
}

export interface UpdateFindingSetRequest {
  name?: string;
  description?: string;
  findingIds?: string[];
}

export interface FindingSetsListResponse {
  findingSets: FindingSet[];
  total: number;
}

export interface FindingSetWithFindings {
  findingSet: FindingSet;
  findings: Finding[];
}

class FindingSetsApiClient extends BaseApiClient {
  async createFindingSet(
    request: CreateFindingSetRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<FindingSet> {
    return this.request<FindingSet>("/finding_sets", {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async listFindingSets(options?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<FindingSetsListResponse> {
    const params = new URLSearchParams();
    if (options?.search) params.set("search", options.search);
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));

    const query = params.toString();
    return this.request<FindingSetsListResponse>(
      `/finding_sets${query ? `?${query}` : ""}`,
    );
  }

  async getFindingSet(id: string): Promise<FindingSet> {
    return this.request<FindingSet>(`/finding_sets/${id}`);
  }

  async getFindingSetWithFindings(id: string): Promise<FindingSetWithFindings> {
    return this.request<FindingSetWithFindings>(`/finding_sets/${id}/findings`);
  }

  async updateFindingSet(
    id: string,
    request: UpdateFindingSetRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<FindingSet> {
    return this.request<FindingSet>(`/finding_sets/${id}`, {
      method: "PUT",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async addFindingsToSet(
    id: string,
    findingIds: string[],
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<FindingSet> {
    return this.request<FindingSet>(`/finding_sets/${id}/findings`, {
      method: "POST",
      body: JSON.stringify({ findingIds }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async removeFindingsFromSet(
    id: string,
    findingIds: string[],
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<FindingSet> {
    return this.request<FindingSet>(`/finding_sets/${id}/findings`, {
      method: "DELETE",
      body: JSON.stringify({ findingIds }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async deleteFindingSet(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>(`/finding_sets/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }
}

export const findingSetsApiClient = new FindingSetsApiClient();
