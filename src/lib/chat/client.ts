/**
 * `ChatApiClient` — CRUD + branching + streaming facade for the chat domain.
 *
 * This file owns the class that exposes the full chat HTTP surface to the
 * rest of the app. It's intentionally a **thin wrapper**:
 *   - The SSE state machine lives in `./stream.ts` — `startChatStream` on
 *     the class is a one-line forward.
 *   - The runtime schemas live in `./schemas.ts` — every read method calls
 *     `parseApiResponse(schema, endpoint, raw)` rather than cast `as T`.
 *   - The pure types live in `./types.ts`.
 *
 * **Contract:** every method on this class corresponds 1:1 with a backend
 * DTO class in `platform/src/modules/chat-completion/chat.response.dto.ts`.
 * The schemas in `./schemas.ts` mirror those DTOs. If the backend DTO
 * changes, the schema changes, the method return type changes, and the
 * next request fails loudly with a precise ZodError pointing at the bad
 * field. That's the whole point of the DTO/schema/parse pipeline —
 * silent drift is structurally impossible.
 */

import { BaseApiClient, buildApiError } from "../api-client";
import { freshIdempotencyKey } from "../idempotency";
import { API_ROOT } from "@/lib/api-base";
import {
  BranchInfoArraySchema,
  BranchTreeNodeSchema,
  ChatHistoryResponseSchema,
  ChatPermissionSchema,
  ChatResponseSchema,
  ChatWithMessagesResponseSchema,
  CreateBranchResponseSchema,
  parseApiResponse,
  type BranchInfo,
  type BranchTreeNode,
  type ChatHistoryResponse,
  type ChatPermission,
  type ChatResponse,
  type ChatWithMessagesResponse,
  type CreateBranchResponse,
} from "./schemas";
import { startChatStream } from "./stream";
import type {
  CreateBranchRequest,
  CreateChatInFolderRequest,
  MoveChatToFolderRequest,
  StartChatStreamOptions,
  UpdateChatRequest,
} from "./types";

class ChatApiClient extends BaseApiClient {
  // ==========================================================================
  // Chat CRUD
  // ==========================================================================

  async createChatInFolder(
    request: CreateChatInFolderRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<ChatResponse> {
    const raw = await this.request<unknown>("/chats", {
      method: "POST",
      body: JSON.stringify({
        account_id: request.account_id,
        page_id: request.folder_id, // Frontend calls them folders; backend calls them pages.
        title: request.title,
      }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return parseApiResponse(ChatResponseSchema, "POST /chats", raw);
  }

  async getChatMessages(chatId: string): Promise<ChatWithMessagesResponse> {
    const raw = await this.request<unknown>(`/chats/${chatId}/messages`);
    return parseApiResponse(
      ChatWithMessagesResponseSchema,
      `GET /chats/${chatId}/messages`,
      raw,
    );
  }

  async updateChat(
    chatId: string,
    request: UpdateChatRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<ChatResponse> {
    const raw = await this.request<unknown>(`/chats/${chatId}`, {
      method: "PATCH",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return parseApiResponse(
      ChatResponseSchema,
      `PATCH /chats/${chatId}`,
      raw,
    );
  }

  async updateChatTitle(
    chatId: string,
    title: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<ChatResponse> {
    // The "update title" endpoint is `PATCH /chats/:id` with `{ title }`.
    // There is no separate `/chats/:id/title` endpoint on the backend.
    return this.updateChat(chatId, { title }, idempotencyKey);
  }

  async moveChatToFolder(
    chatId: string,
    request: MoveChatToFolderRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<ChatResponse> {
    const raw = await this.request<unknown>(`/chats/${chatId}/move`, {
      method: "PUT",
      body: JSON.stringify({
        page_id: request.folder_id, // Frontend "folder" = backend "page".
      }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return parseApiResponse(
      ChatResponseSchema,
      `PUT /chats/${chatId}/move`,
      raw,
    );
  }

  async starChat(
    chatId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<ChatResponse> {
    const raw = await this.request<unknown>(`/chats/${chatId}/star`, {
      method: "PATCH",
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return parseApiResponse(
      ChatResponseSchema,
      `PATCH /chats/${chatId}/star`,
      raw,
    );
  }

  async deleteChat(
    chatId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    await this.request(`/chats/${chatId}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  // ==========================================================================
  // Branching
  // ==========================================================================

  /**
   * Create a new branch from a specific message in a chat.
   * The new branch includes all messages up to and including the specified message.
   */
  async createBranch(
    chatId: string,
    request: CreateBranchRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<CreateBranchResponse> {
    const raw = await this.request<unknown>(`/chats/${chatId}/branch`, {
      method: "POST",
      body: JSON.stringify({
        message_id: request.messageId,
        ...(request.branchName !== undefined
          ? { branch_name: request.branchName }
          : {}),
      }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return parseApiResponse(
      CreateBranchResponseSchema,
      `POST /chats/${chatId}/branch`,
      raw,
    );
  }

  async getBranches(chatId: string): Promise<BranchInfo[]> {
    const raw = await this.request<unknown>(`/chats/${chatId}/branches`);
    return parseApiResponse(
      BranchInfoArraySchema,
      `GET /chats/${chatId}/branches`,
      raw,
    );
  }

  async getBranchTree(chatId: string): Promise<BranchTreeNode> {
    const raw = await this.request<unknown>(`/chats/${chatId}/tree`);
    return parseApiResponse(
      BranchTreeNodeSchema,
      `GET /chats/${chatId}/tree`,
      raw,
    );
  }

  async getBranchesFromMessage(messageId: string): Promise<BranchInfo[]> {
    const raw = await this.request<unknown>(
      `/chats/message/${messageId}/branches`,
    );
    return parseApiResponse(
      BranchInfoArraySchema,
      `GET /chats/message/${messageId}/branches`,
      raw,
    );
  }

  // ==========================================================================
  // Streaming (delegates to ./stream.ts)
  // ==========================================================================

  /**
   * Stream a chat completion via SSE. One-line wrapper around the standalone
   * `startChatStream` function in `./stream.ts` — the entire state machine
   * lives there so it's unit-testable without the class.
   */
  async startChatStream(options: StartChatStreamOptions): Promise<void> {
    return startChatStream(this.baseUrl, options);
  }

  // ==========================================================================
  // Usage validation
  // ==========================================================================

  async validateChatPermission(
    organization_id: string,
    model: string = "gpt-5.4-nano",
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<ChatPermission> {
    const raw = await this.request<unknown>(
      `/organizations/${organization_id}/usage/validate`,
      {
        method: "POST",
        body: JSON.stringify({
          action: "chat",
          model,
          estimated_tokens: 1000, // Rough estimate
        }),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    return parseApiResponse(
      ChatPermissionSchema,
      `POST /organizations/${organization_id}/usage/validate`,
      raw,
    );
  }
}

export { ChatApiClient };
export const chatApiClient = new ChatApiClient();

// ============================================================================
// Standalone: getChatHistory
// ============================================================================

/**
 * Fetch chat history with optional date-range / pagination filters.
 *
 * Standalone fetch (not a class method) for historical reasons. TODO: move
 * onto `BaseApiClient` for parity with the rest of the chat HTTP surface
 * so it benefits from auth token refresh and rate-limit retry.
 */
export async function getChatHistory(options?: {
  dateRange?: "today" | "week" | "month" | "all";
  page?: number;
  limit?: number;
}): Promise<ChatHistoryResponse> {
  const params = new URLSearchParams();
  if (options?.dateRange) params.set("date_range", options.dateRange);
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));

  const query = params.toString();
  // All public platform endpoints are versioned under `/api/`.
  const url = `${API_ROOT}/chats/history${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized");
    }
    throw await buildApiError(response);
  }

  const raw: unknown = await response.json();
  return parseApiResponse(ChatHistoryResponseSchema, "GET /chats/history", raw);
}
