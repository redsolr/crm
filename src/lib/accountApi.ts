import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type {
  AccountMembership,
  AccountMembershipList,
} from "./generated/api/models";
import type { AccountId, FolderId, SubscriptionId } from "./ids";

export type { AccountMembership, AccountMembershipList };

// Account & Subscription Types (seat-based model — one paid plan,
// docs/platform/seat-based-pricing-2026-07-06.md). `seat_count` is the
// billed quantity / roster cap / pooled-allowance multiplier;
// `price_cents` is the TOTAL for the interval (per-seat × seats).
export interface Subscription {
  id: SubscriptionId;
  plan_type: "free" | "team";
  status: "active" | "scheduled_cancel" | "trialing" | "past_due" | "canceled";
  billing_interval: "month" | "year";
  seat_count: number;
  current_period_start: string;
  current_period_end: string;
  price_cents: number;
  currency: string;
  usage_mode?: "inference_included" | "byok";
}

/**
 * Account-level consolidated spend rollup — mirrors the platform's
 * `AccountUsageSummaryResponseDto` envelope at `GET /api/accounts/me/
 * usage/summary`. Sums every owned org's per-org usage and surfaces
 * the per-org breakdown for chargeback. The page-level "Usage by
 * model" + "limits" views ship through per-org endpoints (currently
 * `GET /api/organizations/:id/usage/summary` for the budget view), not
 * this consolidated shape.
 */
export interface UsageSummary {
  account_id: AccountId;
  organizations_count: number;
  consolidated: {
    token_count: number;
    total_cost_cents: number;
  };
  by_organization: UsageByOrganization[];
}

export interface UsageByOrganization {
  organization_id: string;
  name: string;
  token_count: number;
  total_cost_cents: number;
  period_start: string | null;
  period_end: string | null;
}

// Folder Types
export interface Folder {
  id: FolderId;
  name: string;
  description?: string;
  path: string;
  is_public: boolean;
  is_shareable: boolean;
  chat_count: number;
  instruction_count: number;
  created_at: string;
  updated_at: string;
  children?: Folder[];
}

export interface CreateFolderRequest {
  name: string;
  description?: string;
  parent_id?: string;
  is_public?: boolean;
  is_shareable?: boolean;
  collaboration_settings?: {
    allow_comments: boolean;
    allow_editing: boolean;
  };
}

class AccountApiClient extends BaseApiClient {
  // Account
  async getAccount(account_id: string): Promise<unknown> {
    return this.request(`/accounts/${account_id}`);
  }

  // Account update
  async updateAccount(
    account_id: string,
    data: { name?: string; billingEmail?: string; allowOverage?: boolean },
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<unknown> {
    return this.request(`/accounts/${account_id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /**
   * `DELETE /api/accounts/me` — soft-delete cascade. Cancels every
   * owned org's subscription, revokes api-keys, emits
   * `organization.deleted`, soft-deletes orgs, then soft-deletes the
   * account. Returns `{ deleted: true }`. Required body shape:
   * `{ confirmation: "DELETE" }`.
   */
  async deleteMyAccount(
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ deleted: true }> {
    return this.request<{ deleted: true }>("/accounts/me", {
      method: "DELETE",
      body: JSON.stringify({ confirmation: "DELETE" }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  // Folders
  async createFolder(
    request: CreateFolderRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<Folder> {
    return this.request<Folder>("/folders", {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

}

export const accountApiClient = new AccountApiClient();
