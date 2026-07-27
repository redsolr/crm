import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type {
  AccountMembership,
  AccountMembershipList,
} from "./generated/api/models";
import type { AccountId, FolderId, OrganizationId, SubscriptionId } from "./ids";

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
 * `AccountUsageSummaryResponseDto` envelope at `GET /v1/accounts/me/
 * usage/summary`. Sums every owned org's per-org usage and surfaces
 * the per-org breakdown for chargeback. The page-level "Usage by
 * model" + "limits" views ship through per-org endpoints (currently
 * `GET /v1/organizations/:id/usage/summary` for the budget view), not
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

/**
 * Re-issued auth envelope returned by `POST /v1/accounts/me:switch_organization`.
 * Same shape as the WorkOS exchange response — re-mints the access /
 * refresh token pair bound to the target organization.
 */
export interface SwitchOrganizationResponse {
  success: true;
  user: {
    id: AccountId;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  organization_id: OrganizationId | undefined;
  organization_name: string | undefined;
  role: string | undefined;
  needs_onboarding: boolean;
  needs_profile_setup: boolean;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

class AccountApiClient extends BaseApiClient {
  // Account
  async getAccount(account_id: string): Promise<unknown> {
    return this.request(`/accounts/${account_id}`);
  }

  // Active-org primitives (`docs/platform/multi-tenant-model.md` §
  // "Active organization resolution"). Memberships are JWT-bound;
  // switching re-mints the token pair against the target org.

  /** `GET /v1/accounts/me/organizations` — every org the caller is an
   *  active member of, with the membership row inline. */
  async listMyOrganizations(): Promise<AccountMembershipList> {
    return this.request<AccountMembershipList>("/accounts/me/organizations");
  }

  /** `POST /v1/accounts/me:switch_organization` — AIP-136 custom action;
   *  rebinds the active org. Caller must replace stored tokens with the
   *  pair returned. 403 `organization_membership_required` if the target
   *  isn't an active membership. */
  async switchOrganization(
    organization_id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<SwitchOrganizationResponse> {
    return this.request<SwitchOrganizationResponse>(
      "/accounts/me:switch_organization",
      {
        method: "POST",
        body: JSON.stringify({ organization_id: organization_id }),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }

  // Subscription — belongs to the organization, not the account
  // (the multi-tenant model puts billing on the org). The wrapper
  // accepts the active `organization_id` (resolvable from the auth
  // store's `user.organization_id`).
  async getSubscription(
    organization_id: string,
  ): Promise<Subscription | null> {
    // Platform returns `CurrentSubscriptionResponseDto` envelope:
    // `{ subscription, organization, message? }` (see
    // `platform/src/modules/subscriptions/subscriptions.response.dto.ts`).
    // Unwrap to the bare `Subscription` shape callers expect — they
    // read `.status` / `.plan_type` directly. An org without a
    // subscription row returns NULL, honestly — the old
    // `{} as Subscription` normalisation was a truthy lie that walked
    // past `subscription && ...` guards and crashed the account page
    // on `formatSeatPrice(undefined, undefined)`.
    const res = await this.request<{
      subscription: Subscription | null;
      organization?: { id: string };
      message?: string;
    }>(`/organizations/${organization_id}/subscription`);
    return res.subscription ?? null;
  }

  // Usage — account-level consolidated summary across every org the
  // caller owns. Backed by `GET /v1/accounts/me/usage/summary` which
  // resolves the account from the auth token; `account_id` is
  // accepted-and-ignored here so existing call sites don't have to
  // refactor their signature.
  async getUsageSummary(
    _account_id: string,
    _periodStart?: string,
    _periodEnd?: string,
  ): Promise<UsageSummary> {
    return this.request<UsageSummary>("/accounts/me/usage/summary");
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
   * `DELETE /v1/accounts/me` — soft-delete cascade. Cancels every
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
