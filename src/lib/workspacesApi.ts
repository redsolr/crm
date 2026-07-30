/**
 * Workspaces API client.
 *
 * Talks to the platform's `/api/workspaces` surface (CRUD). Contract mirrors
 * `WorkspaceResponseDto` in platform `src/modules/workspaces/workspaces.response.dto.ts`.
 *
 * Workspaces are the platform's SOLE data-isolation boundary — every API
 * key, work item, label, workflow, audit event, and webhook subscription
 * belongs to exactly one. RLS gates every `app.*` read/write on
 * `(organization_id, workspace_id)`. Uniform isolated universes — no
 * mode/livemode/sandbox/prod discriminator. Customers name them freely
 * (`Default`, `staging`, `dev`, `sales`, `preview-pr-142`, …).
 *
 * Workspaces live under an organization (the billing target). Org members
 * with `owner`/`admin` automatically see every workspace; `member`/`billing`
 * need an explicit `workspace_members` row per workspace.
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type { OrganizationId } from "./ids";

export type WorkspaceId = `ws_${string}`;

export interface Workspace {
  id: WorkspaceId;
  organization_id: OrganizationId;
  /** Short uppercase code used for work-item identifier generation (`KEY-NUMBER`). */
  key: string;
  /** Human-readable name. */
  name: string;
  metadata: Record<string, string>;
  /**
   * Platform-owned module discriminators (`sales`, `legal`, …) stamped
   * by workspace-template application — read-only over the wire. The
   * app derives the org's enabled module surfaces from the union
   * across its workspaces (see `lib/modules/enabled-modules.ts`).
   */
  module_keys: string[];
  /** Ephemeral workspaces (PR previews) carry an expiry. */
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  key: string;
  metadata?: Record<string, string>;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  key?: string;
  metadata?: Record<string, string>;
}

class WorkspacesApiClient extends BaseApiClient {
  /** List workspaces in the caller's organization. */
  async list(): Promise<Workspace[]> {
    const response =
      await this.request<{ workspaces: Workspace[] }>("/workspaces");
    return response.workspaces;
  }

  async get(workspaceId: string): Promise<Workspace> {
    return this.request<Workspace>(`/workspaces/${workspaceId}`);
  }

  async create(
    body: CreateWorkspaceRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<Workspace> {
    return this.request<Workspace>("/workspaces", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async update(
    workspaceId: string,
    body: UpdateWorkspaceRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<Workspace> {
    return this.request<Workspace>(`/workspaces/${workspaceId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async remove(
    workspaceId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    await this.request<void>(`/workspaces/${workspaceId}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }
}

export const workspacesApiClient = new WorkspacesApiClient();
