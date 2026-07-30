/**
 * Comments API Client
 *
 * Hits `/api/comments` — work-item comments with mention support.
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type { CommentId } from "./ids";

// ============================================================================
// Types
// ============================================================================

// Comment entity
export interface Comment {
  id: CommentId;
  content: string;
  work_item_id: string;
  author_id: string;
  mentions: string[]; // Array of user IDs
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Request Types
// ============================================================================

export interface CreateCommentRequest {
  content: string;
  work_item_id: string;
  mentions?: string[]; // Array of user IDs to mention
}

export interface UpdateCommentRequest {
  content: string;
  mentions?: string[];
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Author projection joined onto each comment in the
 * `/api/work_items/{workItemId}/comments` view.
 */
export interface CommentAuthorPayload {
  id: string;
  email: string;
}

/** Joined row type returned by `listCommentsByWorkItem`. */
export interface CommentWithAuthor {
  comment: Comment;
  author: CommentAuthorPayload;
}

/**
 * `/api/work_items/{workItemId}/comments` returns a simple `{ data }` array — no
 * pagination markers (BE bounds the per-work-item comment list).
 */
export interface CommentsByWorkItemResponse {
  data: CommentWithAuthor[];
}

// ============================================================================
// API Client
// ============================================================================

class CommentsApiClient extends BaseApiClient {
  async createComment(
    request: CreateCommentRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ comment: Comment }> {
    return this.request<{ comment: Comment }>("/comments", {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async listCommentsByWorkItem(work_item_id: string): Promise<CommentsByWorkItemResponse> {
    return this.request<CommentsByWorkItemResponse>(`/work_items/${work_item_id}/comments`);
  }

  async getComment(id: string): Promise<{ comment: Comment }> {
    return this.request<{ comment: Comment }>(`/comments/${id}`);
  }

  async updateComment(
    id: string,
    request: UpdateCommentRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ comment: Comment }> {
    return this.request<{ comment: Comment }>(`/comments/${id}`, {
      method: "PUT",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async deleteComment(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>(`/comments/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }
}

export const commentsApi = new CommentsApiClient();
