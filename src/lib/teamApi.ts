import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type {
  AccountId,
  InviteLinkId,
  OrganizationId,
  OrganizationMemberId,
  PermissionGroupId,
  PolicyId,
} from "./ids";

export type MemberRole = "owner" | "admin" | "member" | "billing" | "readonly";

/** Roles an invite link may carry — `owner` is never invitable. */
export type InvitableRole = Exclude<MemberRole, "owner">;

/**
 * Mirror of `OrganizationMemberResponseDto` (snake_case on the wire).
 * `account_email` / `account_full_name` are only present on the bulk
 * list (`GET /v1/organizations/:id/members`); single-row mutation
 * responses (add / role change) return the bare row without the join.
 */
export interface AccountMember {
  id: OrganizationMemberId;
  account_id: AccountId;
  organization_id: OrganizationId;
  role: MemberRole;
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  account_email?: string;
  account_full_name?: string | null;
}

/** Mirror of `OrganizationResponseDto` — snake_case on the wire. */
export interface Organization {
  id: OrganizationId;
  name: string;
  billing_email: string | null;
  allow_overage?: boolean;
  metadata?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

/** Mirror of `PermissionGroupResponseDto` — snake_case on the wire. */
export interface PermissionGroup {
  id: PermissionGroupId;
  name: string;
  description?: string | null;
  is_default: boolean;
  default_role?: string | null;
  member_count?: number;
  created_at: string;
  updated_at: string;
}

/** Mirror of `GroupMemberResponseDto` — snake_case on the wire. */
export interface GroupMemberDetail {
  account_id: AccountId;
  email: string;
  full_name: string | null;
  added_at: string;
}

/** Mirror of `GroupPolicyResponseDto` — snake_case on the wire. */
export interface GroupPolicyDetail {
  id: PolicyId;
  name: string;
  description?: string | null;
  display_name?: string | null;
  category?: string | null;
  effect: string;
  actions: string[];
  resources: string[];
  seed_role?: string | null;
}

/** Mirror of `InviteLinkResponseDto` — snake_case on the wire. */
export interface InviteLink {
  id: InviteLinkId;
  code: string;
  role: MemberRole;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  created_at: string;
}

class TeamApiClient extends BaseApiClient {
  // ─── Organization Members ──────────────────────────────────────────
  // Members live on the organization (the multi-tenant boundary), not
  // on accounts (the identity layer). Callers pass the active
  // `organization_id` (resolvable from the auth store).

  async getAccountMembers(organization_id: string): Promise<AccountMember[]> {
    return this.request(`/organizations/${organization_id}/members`);
  }

  async addAccountMember(
    organization_id: string,
    data: { account_id: string; role: MemberRole; invited_by?: string },
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<AccountMember> {
    return this.request(`/organizations/${organization_id}/members`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async updateMemberRole(
    organization_id: string,
    userId: string,
    role: MemberRole,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<AccountMember> {
    return this.request(
      `/organizations/${organization_id}/members/${userId}`,
      {
        method: "PUT",
        body: JSON.stringify({ role }),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }

  async removeMember(
    organization_id: string,
    userId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request(
      `/organizations/${organization_id}/members/${userId}`,
      {
        method: "DELETE",
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }

  // ─── Organizations ──────────────────────────────────────

  /** `GET /v1/organizations` — bare array on the wire (no envelope). */
  async getOrganizations(): Promise<Organization[]> {
    return this.request("/organizations");
  }

  async createOrganization(
    data: {
      name: string;
      billing_email?: string;
    },
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ organization: Organization }> {
    return this.request("/organizations", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async updateOrganization(
    organization_id: string,
    data: {
      name?: string;
      billing_email?: string;
      allow_overage?: boolean;
    },
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<Organization> {
    return this.request(`/organizations/${organization_id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async deleteMyOrganization(
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ deleted: true }> {
    return this.request("/organizations/me", {
      method: "DELETE",
      body: JSON.stringify({ confirmation: "DELETE" }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  // ─── Available Policies ─────────────────────────────────

  async getAvailablePolicies(): Promise<GroupPolicyDetail[]> {
    return this.request("/permissions/policies");
  }

  async getPolicyCategories(): Promise<{ data: string[] }> {
    return this.request("/permissions/policies/categories");
  }

  // ─── Permission Groups ──────────────────────────────────

  async getGroups(): Promise<{ data: PermissionGroup[] }> {
    return this.request("/groups");
  }

  async createGroup(
    data: {
      name: string;
      description?: string;
    },
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ group: PermissionGroup }> {
    return this.request("/groups", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async getGroup(id: string): Promise<{
    group: PermissionGroup;
    members: GroupMemberDetail[];
    policies: GroupPolicyDetail[];
  }> {
    return this.request(`/groups/${id}`);
  }

  async deleteGroup(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request(`/groups/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async getGroupMembers(id: string): Promise<{ data: GroupMemberDetail[] }> {
    return this.request(`/groups/${id}/members`);
  }

  async addGroupMember(
    groupId: string,
    accountId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ added: boolean }> {
    return this.request(`/groups/${groupId}/members`, {
      method: "POST",
      body: JSON.stringify({ account_id: accountId }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async removeGroupMember(
    groupId: string,
    accountId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request(`/groups/${groupId}/members/${accountId}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async getGroupPolicies(id: string): Promise<{ data: GroupPolicyDetail[] }> {
    return this.request(`/groups/${id}/policies`);
  }

  async addGroupPolicy(
    groupId: string,
    policyId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ added: boolean }> {
    return this.request(`/groups/${groupId}/policies`, {
      method: "POST",
      body: JSON.stringify({ policy_id: policyId }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async removeGroupPolicy(
    groupId: string,
    policyId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request(`/groups/${groupId}/policies/${policyId}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  // ─── Invite Links ───────────────────────────────────────

  /**
   * Create a bounded invite link for an organization. `owner` is not
   * invitable — the backend rejects it; ownership transfers go through
   * the members surface, gated on an existing owner.
   */
  async createInviteLink(
    organization_id: string,
    data: {
      role: InvitableRole;
      max_uses?: number;
      expires_in_hours?: number;
    },
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ invite_link: InviteLink }> {
    return this.request(`/organizations/${organization_id}/invite_links`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async listInviteLinks(
    organization_id: string,
  ): Promise<{ data: InviteLink[] }> {
    return this.request(`/organizations/${organization_id}/invite_links`);
  }

  async revokeInviteLink(
    organization_id: string,
    linkId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request(
      `/organizations/${organization_id}/invite_links/${linkId}`,
      {
        method: "DELETE",
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }
}

export const teamApi = new TeamApiClient();
