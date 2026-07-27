/**
 * Favorites API Client
 *
 * Provides access to the favorites (pinned items) feature.
 * Replaces local-only pinned files with server-persisted favorites.
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type { FavoriteId } from "./ids";

// ============================================================================
// Types
// ============================================================================

export type FavoriteTargetType = "page" | "folder" | "chat";

export interface Favorite {
  id: FavoriteId;
  /** Polymorphic — discriminated by targetType (page/folder/chat). */
  targetId: string;
  targetType: FavoriteTargetType;
  position: number;
  name: string;
  icon: string | null;
  created_at: string;
}

// ============================================================================
// Request Types
// ============================================================================

export interface AddFavoriteRequest {
  target_id: string;
  target_type: FavoriteTargetType;
}

export interface ReorderFavoritesRequest {
  order: Array<{ id: string }>;
}

// ============================================================================
// Response Types
// ============================================================================

export interface FavoritesListResponse {
  data: Favorite[];
}

export interface AddFavoriteResponse {
  data: Favorite;
}

// ============================================================================
// API Client
// ============================================================================

class FavoritesApiClient extends BaseApiClient {
  /**
   * Get all favorites for the current user.
   */
  async list(): Promise<FavoritesListResponse> {
    return this.request<FavoritesListResponse>("/favorites");
  }

  /**
   * Add a new favorite.
   */
  async add(
    request: AddFavoriteRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<AddFavoriteResponse> {
    return this.request<AddFavoriteResponse>("/favorites", {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /**
   * Remove a favorite by its ID.
   */
  async remove(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>(`/favorites/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /**
   * Remove a favorite by its target ID (for context menu "unfavorite").
   */
  async removeByTarget(
    targetId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>(`/favorites/target/${targetId}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /**
   * Reorder favorites by providing the new order of IDs.
   */
  async reorder(
    request: ReorderFavoritesRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>("/favorites/reorder", {
      method: "PUT",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }
}

export const favoritesApi = new FavoritesApiClient();
