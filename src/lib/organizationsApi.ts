/**
 * Organizations API Client
 *
 * Hits `/v1/organizations` — the primary tenant / RLS boundary.
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type { AccountId, OrganizationId } from "./ids";

// ============================================================================
// Types
// ============================================================================

// Organization entity. Mirrors the platform `Organization` projection
// of a `control.organizations` row.
export interface Organization {
  id: OrganizationId;
  name: string;
  slug: string;
  logo_url: string | null;
  account_id: AccountId;
  /** Where invoices + billing notices are sent. Null until set. */
  billing_email: string | null;
  created_at: string;
  updated_at: string;
}

// Organization responses — bare array; `/v1/organizations` returns
// `OrganizationList` (a JSON array), not a `{data, meta}` wrapper.
export type OrganizationsListResponse = Organization[];

// ============================================================================
// API Client
// ============================================================================

class OrganizationsApiClient extends BaseApiClient {
  async createOrganization(
    request: {
      name: string;
      description?: string;
    },
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ organization: Organization }> {
    return this.request<{ organization: Organization }>("/organizations", {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async listOrganizations(): Promise<OrganizationsListResponse> {
    // BE returns a bare JSON array (`OrganizationList`), not a wrapper.
    return this.request<OrganizationsListResponse>("/organizations");
  }

  async getOrganization(id: string): Promise<{ organization: Organization }> {
    return this.request<{ organization: Organization }>(`/organizations/${id}`);
  }
}

export const organizationsApi = new OrganizationsApiClient();
