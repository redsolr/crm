import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type { AccountId, FindingId } from "./ids";

// ============================================================================
// Findings API Types & Methods (Research & Chat Feature)
// ============================================================================

export interface FindingSource {
  type: "chat-message" | "text-selection";
  messageId?: string;
  chatId?: string;
  timestamp?: string;
  selectionStart?: number;
  selectionEnd?: number;
}

export interface CreateFindingRequest {
  content: string;
  title?: string;
  source: FindingSource;
  tags?: string[];
}

export interface Finding {
  id: FindingId;
  content: string;
  title: string;
  sourceType: "chat-message" | "text-selection";
  sourceMessageId: string | null;
  chatId: string | null;
  sourceTimestamp: string | null;
  selectionStart: number | null;
  selectionEnd: number | null;
  tags: string[] | null;
  userId: string;
  account_id: AccountId | null;
  created_at: string;
  updated_at: string;
  deletedAt: string | null;
}

export interface FindingsListResponse {
  findings: Finding[];
  total: number;
  grouped: Record<string, Finding[]>;
}

export interface FindingsTrashResponse {
  findings: (Finding & { daysUntilPermanentDeletion?: number })[];
  total: number;
}

export interface UpdateFindingRequest {
  title?: string;
  content?: string;
  tags?: string[];
}

export interface FindingsApiError {
  error: {
    code: string;
    message: string;
  };
}

class FindingsApiClient extends BaseApiClient {
  async createFinding(
    request: CreateFindingRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<Finding> {
    return this.request<Finding>("/findings", {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async listFindings(options?: {
    chatId?: string;
    dateRange?: "today" | "yesterday" | "week" | "month" | "all";
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<FindingsListResponse> {
    const params = new URLSearchParams();
    if (options?.chatId) params.set("chatId", options.chatId);
    if (options?.dateRange) params.set("dateRange", options.dateRange);
    if (options?.search) params.set("search", options.search);
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));

    const query = params.toString();
    return this.request<FindingsListResponse>(
      `/findings${query ? `?${query}` : ""}`,
    );
  }

  async getFinding(id: string): Promise<Finding> {
    return this.request<Finding>(`/findings/${id}`);
  }

  async updateFinding(
    id: string,
    request: UpdateFindingRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<Finding> {
    return this.request<Finding>(`/findings/${id}`, {
      method: "PUT",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async deleteFinding(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>(`/findings/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async bulkDeleteFindings(
    ids: string[],
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>("/findings", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async listTrash(): Promise<FindingsTrashResponse> {
    return this.request<FindingsTrashResponse>("/findings/trash");
  }

  async restoreFinding(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<Finding> {
    return this.request<Finding>(`/findings/${id}/restore`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

}

export const findingsApiClient = new FindingsApiClient();
