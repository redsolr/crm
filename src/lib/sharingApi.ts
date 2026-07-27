/**
 * Sharing API Client
 *
 * Provides access to the resource sharing/collaboration features.
 * Maps to the backend SharingController endpoints.
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type { PageId, ProjectId, ShareId } from "./ids";

// ============================================================================
// Types
// ============================================================================

export type ShareScope = "artifact" | "folder" | "project";
export type ShareRole = "viewer" | "commenter" | "editor" | "owner";
export type PrincipalType = "user" | "team" | "org";

export interface ShareGrant {
  id: string;
  shareId: ShareId;
  principalType: PrincipalType;
  /** Polymorphic — discriminated by principalType (user/team/org). */
  principalId: string;
  role: ShareRole;
  grantedAt: string;
  grantedBy: string;
}

export interface Share {
  id: ShareId;
  scope: ShareScope;
  /** Polymorphic — the artifact's id; type is implied by scope. */
  artifactId: string | null;
  pageId: PageId | null;
  /** For `scope = 'project'`: the project whose entire contents are
   *  shared. Null for artifact- or folder-scoped shares. Replaces the
   *  legacy `workspaceId` field when the workspace module was removed. */
  project_id: ProjectId | null;
  grantedBy: string;
  inherits: boolean;
  message: string | null;
  expiresAt: string | null;
  isActive: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShareWithGrants {
  share: Share;
  grants: ShareGrant[];
}

export interface PrincipalInfo {
  id: string;
  principalType: PrincipalType;
  name: string;
  email?: string;
  avatarUrl?: string;
}

export interface SharingSummary {
  resourceId: string;
  resourceType: string;
  totalShares: number;
  directGrants: number;
  inheritedGrants: number;
  principals: PrincipalInfo[];
}

export interface AccessCheckResult {
  hasAccess: boolean;
  resourceId: string;
  resourceType: string;
  role: string;
}

// ============================================================================
// Request Types
// ============================================================================

export interface CreateShareRequest {
  scope: ShareScope;
  resourceId: string;
  grants: Array<{
    principalType: PrincipalType;
    principalId: string;
    role: ShareRole;
  }>;
  inherits?: boolean;
  message?: string;
  expiresAt?: string;
}

export interface AddGrantRequest {
  principalType: PrincipalType;
  principalId: string;
  role: ShareRole;
}

// ============================================================================
// API Client
// ============================================================================

class SharingApiClient extends BaseApiClient {
  /**
   * Create a new share with one or more grants.
   */
  async createShare(
    request: CreateShareRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<ShareWithGrants> {
    return this.request<ShareWithGrants>("/sharing", {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /**
   * Get a single share by ID.
   */
  async getShare(shareId: string): Promise<ShareWithGrants> {
    return this.request<ShareWithGrants>(`/sharing/${shareId}`);
  }

  /**
   * Get all shares for a specific resource.
   */
  async getResourceShares(
    resourceType: string,
    resourceId: string,
  ): Promise<ShareWithGrants[]> {
    return this.request<ShareWithGrants[]>(
      `/sharing/resource/${resourceType}/${resourceId}`,
    );
  }

  /**
   * Get sharing summary for a resource (includes principal info).
   */
  async getSharingSummary(
    resourceType: string,
    resourceId: string,
  ): Promise<SharingSummary> {
    return this.request<SharingSummary>(
      `/sharing/resource/${resourceType}/${resourceId}/summary`,
    );
  }

  /**
   * Add a grant to an existing share.
   */
  async addGrant(
    shareId: string,
    request: AddGrantRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<ShareGrant> {
    return this.request<ShareGrant>(`/sharing/${shareId}/grants`, {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /**
   * Remove a grant from a share.
   */
  async removeGrant(
    shareId: string,
    principalType: PrincipalType,
    principalId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ removed: boolean }> {
    return this.request<{ removed: boolean }>(
      `/sharing/${shareId}/grants/${principalType}/${principalId}`,
      {
        method: "DELETE",
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }

  /**
   * Delete (deactivate) a share.
   */
  async deleteShare(
    shareId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(`/sharing/${shareId}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /**
   * Check if the current user has access to a resource at a given role level.
   */
  async checkAccess(
    resourceType: string,
    resourceId: string,
    role?: string,
  ): Promise<AccessCheckResult> {
    const params = new URLSearchParams({
      resourceType,
      resourceId,
    });
    if (role) {
      params.set("role", role);
    }
    return this.request<AccessCheckResult>(
      `/sharing/access/check?${params.toString()}`,
    );
  }
}

export const sharingApi = new SharingApiClient();
