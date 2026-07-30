import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type { SubscriptionId, SubscriptionPlanId } from "./ids";

/**
 * Snake_case wire shapes — the platform follows Stripe v2 conventions
 * (`docs/platform/api-discipline.md` § A3). All response DTOs are
 * snake_case; request bodies are snake_case for billing endpoints
 * (`payments.dto.ts` + `subscriptions.dto.ts`).
 */

/** The two-row plan catalog: `free` (AI locked) and `team` (the only paid plan). */
export type PlanId = "free" | "team";

/**
 * Seat-based plan catalog (docs/platform/seat-based-pricing-2026-07-06.md):
 * exactly two rows — `free` (AI locked) and `team` (the only paid plan).
 * All prices and the AI allowance are PER SEAT; the organization's
 * effective numbers are seat_count × the per-seat value.
 */
export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  plan_type: PlanId;
  name: string;
  description: string | null;
  /**
   * ISO 4217 price currency ('THB' today — THB-first pricing). The
   * `seat_price_*_cents` fields are in this currency's MINOR unit
   * (satang for THB). Format them with `formatSeatPrice`.
   */
  currency: string;
  seat_price_monthly_cents: number;
  seat_price_yearly_cents: number;
  /**
   * Included LLM allowance per seat per month, pooled org-wide —
   * ALWAYS USD cents (the metering currency), regardless of
   * `currency`. Never format it with the plan currency.
   */
  seat_monthly_llm_budget_cents: number;
  max_workspaces: number | null;
  features: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Mirror of the platform's `SubscriptionResponseDto` (seat-based model).
 * `seat_count` is the billed quantity, the member-roster cap, and the
 * pooled-LLM-allowance multiplier; `price_cents` is the TOTAL
 * (per-seat unit × seat_count) for the billing interval.
 */
export interface SubscriptionResponse {
  id: SubscriptionId;
  plan_type: PlanId;
  status: string;
  billing_interval: "month" | "year";
  seat_count: number;
  price_cents: number;
  currency: string;
  current_period_start: string;
  current_period_end: string;
  trial_end: string | null;
  usage_mode: "inference_included" | "byok";
  canceled_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckoutSessionResponse {
  session_id: string;
  url: string | null;
}

export interface PortalSessionResponse {
  url: string;
}

export interface CancelSubscriptionResponse {
  id: SubscriptionId;
  status: string;
}

export interface UpdateUsageModeResponse {
  id: SubscriptionId;
  usage_mode: string;
}

class SubscriptionsApi extends BaseApiClient {
  async getPlans(): Promise<SubscriptionPlan[]> {
    // Hit the PUBLIC `/api/plans` controller (PlansController) — pricing
    // is unauthenticated by design, so the auth-gated mirror at
    // `/api/subscriptions/plans` 401s for visitors who haven't signed
    // in yet (the pricing page's primary audience). Same payload
    // either way; the public route is the right one for this caller.
    return this.request<SubscriptionPlan[]>("/plans");
  }

  async cancelSubscription(
    subscriptionId: string,
    body?: { reason?: string; feedback?: string },
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<CancelSubscriptionResponse> {
    return this.request(`/subscriptions/${subscriptionId}/cancel`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async createPortalSession(
    organizationId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<PortalSessionResponse> {
    return this.request("/payments/create_portal_session", {
      method: "POST",
      body: JSON.stringify({ organization_id: organizationId }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /**
   * Start a Stripe Checkout session for the Team plan. Seat-based
   * contract: the body carries `billing_interval` + `seat_count` —
   * there is no `plan_id` (Team is the only paid plan).
   */
  async createCheckoutSession(
    organizationId: string,
    options: {
      billingInterval?: "month" | "year";
      seatCount?: number;
      successUrl?: string;
      cancelUrl?: string;
      idempotencyKey?: string;
    } = {},
  ): Promise<CheckoutSessionResponse> {
    const idempotencyKey = options.idempotencyKey ?? freshIdempotencyKey();
    const body: Record<string, string | number> = {
      organization_id: organizationId,
      billing_interval: options.billingInterval ?? "month",
      seat_count: options.seatCount ?? 1,
    };
    if (options.successUrl !== undefined) body.success_url = options.successUrl;
    if (options.cancelUrl !== undefined) body.cancel_url = options.cancelUrl;
    return this.request("/payments/create_checkout_session", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /**
   * `PUT /api/subscriptions/:id/seats` — owner/billing seat management.
   * Increases invoice the prorated difference immediately; decreases
   * apply at renewal (no refund). 409 `SEATS_BELOW_ROSTER` when the
   * target is below the current seat-consuming member roster.
   */
  async updateSeats(
    subscriptionId: string,
    seatCount: number,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<SubscriptionResponse> {
    return this.request(`/subscriptions/${subscriptionId}/seats`, {
      method: "PUT",
      body: JSON.stringify({ seat_count: seatCount }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async updateUsageMode(
    subscriptionId: string,
    usageMode: "inference_included" | "byok",
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<UpdateUsageModeResponse> {
    return this.request(`/subscriptions/${subscriptionId}`, {
      method: "PUT",
      body: JSON.stringify({ usage_mode: usageMode }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }
}

export const subscriptionsApi = new SubscriptionsApi();
