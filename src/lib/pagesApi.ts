/**
 * Pages API Client
 *
 * Simple markdown document CRUD operations.
 */

import { BaseApiClient } from "./api-client";
import { authService } from "./authTokenManager";
import { freshIdempotencyKey } from "./idempotency";
import { API_V1, API_VERSION } from "@/lib/api-base";
import type { Page as ApiPage } from "./generated/api/models";

// ============================================================================
// Types
// ============================================================================

/**
 * Page (a.k.a. Note in the public agile-team lens) — re-exported from the
 * generated wire shape. snake_case fields per
 * `docs/platform/api-discipline.md`.
 */
export type Page = ApiPage;

export interface IconObject {
  type: "emoji" | "file";
  emoji?: string;
  url?: string;
}

export interface CoverObject {
  type: "file";
  url: string;
}

export interface CreatePageRequest {
  title?: string;
  content?: string;
  folder_id?: string;
  icon?: IconObject;
  cover?: CoverObject;
}

export interface UpdatePageRequest {
  title?: string;
  content?: string;
  icon?: IconObject | null;
  cover?: CoverObject | null;
  archived?: boolean;
}

export interface MovePageRequest {
  folder_id?: string | null;
  position?: number;
}

export interface PagesListResponse {
  data: Page[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface ListPagesOptions {
  folder_id?: string;
  root?: boolean;
  archived?: boolean;
  in_trash?: boolean;
  page?: number;
  limit?: number;
}

// ============================================================================
// Hypothesis Types
// ============================================================================

export type HypothesisStatus =
  | "untested"
  | "testing"
  | "confirmed"
  | "rejected"
  | "inconclusive";

export interface HypothesisData {
  id: string;
  statement: string;
  status: HypothesisStatus;
  evidence?: string;
  confidence?: number;
  lastUpdated?: string;
  aiReasoning?: string;
  pageId: string;
  pageTitle: string;
}

export interface HypothesesResponse {
  data: HypothesisData[];
  meta: {
    total: number;
  };
}

// ============================================================================
// API Client
// ============================================================================

class PagesApiClient extends BaseApiClient {
  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Create a new page
   */
  async createPage(
    request: CreatePageRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ page: Page }> {
    return this.request<{ page: Page }>("/pages", {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /**
   * List pages with optional filtering
   */
  async listPages(options?: ListPagesOptions): Promise<PagesListResponse> {
    const params = new URLSearchParams();
    if (options?.folder_id) params.set("folder_id", options.folder_id);
    if (options?.root !== undefined) params.set("root", String(options.root));
    if (options?.archived !== undefined)
      params.set("archived", String(options.archived));
    if (options?.in_trash !== undefined)
      params.set("in_trash", String(options.in_trash));
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));

    const query = params.toString();
    return this.request<PagesListResponse>(`/pages${query ? `?${query}` : ""}`);
  }

  /**
   * List pages in trash
   */
  async listTrashPages(): Promise<PagesListResponse> {
    return this.request<PagesListResponse>("/pages/trash");
  }

  /**
   * Lightweight search across pages — returns minimal `{ id, title, icon,
   * updated_at }` rows for picker / link-menu UIs. Backed by
   * `GET /v1/pages/search?query=&limit=`.
   */
  async searchPages(query: string, limit = 10): Promise<PagesListResponse> {
    const params = new URLSearchParams();
    params.set("query", query);
    params.set("limit", String(limit));
    return this.request<PagesListResponse>(
      `/pages/search?${params.toString()}`,
    );
  }

  /**
   * Get a single page by ID
   */
  async getPage(id: string): Promise<{ page: Page }> {
    return this.request<{ page: Page }>(`/pages/${id}`);
  }

  /**
   * Update a page (title, content, icon, cover, archived)
   */
  async updatePage(
    id: string,
    request: UpdatePageRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ page: Page }> {
    return this.request<{ page: Page }>(`/pages/${id}`, {
      method: "PUT",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /**
   * Move a page to a different folder or position
   */
  async movePage(
    id: string,
    request: MovePageRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ page: Page }> {
    return this.request<{ page: Page }>(`/pages/${id}/move`, {
      method: "PUT",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /**
   * Soft delete a page (move to trash)
   */
  async deletePage(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>(`/pages/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /**
   * Restore a page from trash
   */
  async restorePage(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ page: Page }> {
    return this.request<{ page: Page }>(`/pages/${id}/restore`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /**
   * Permanently delete a page (must be in trash first)
   */
  async permanentlyDeletePage(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>(`/pages/${id}/permanent`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  // ============================================================================
  // Hypothesis Operations
  // ============================================================================

  /**
   * Get all hypotheses from a page's content
   * Extracts hypothesis blocks from TipTap document structure
   */
  async getHypotheses(pageId: string): Promise<HypothesesResponse> {
    return this.request<HypothesesResponse>(`/pages/${pageId}/hypotheses`);
  }

  /**
   * Export all notes as a ZIP file.
   * Uses a raw fetch (not the base `request()`) because the response is binary.
   */
  async exportAllNotes(): Promise<Blob> {
    const url = `${API_V1}/pages/export`;
    const headers: HeadersInit = {
      "Jurisimus-Version": API_VERSION,
    };

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        authService.notifySessionExpired();
        throw new Error("Unauthorized");
      }
      throw new Error(`Export failed with status ${response.status}`);
    }

    return response.blob();
  }
}

// Export singleton instance
export const pagesApi = new PagesApiClient();
export default pagesApi;
