import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type { OrganizationId } from "./ids";
import type { WorkspaceId } from "./workspacesApi";

/**
 * One rolling-window usage meter (`session` 5hr / `weekly` 7d). Hard
 * caps — LLM calls 429 with `meta.limitType = key` when exhausted.
 * `cap_cents === 0` means the window never binds; `resets_at` is when
 * the oldest in-window spend ages out (rolling windows free up
 * gradually). Empty `windows` array = no caps in this environment.
 */
export interface UsageRollingWindow {
  key: "session" | "weekly";
  label: string;
  hours: number;
  spent_cents: number;
  cap_cents: number;
  percent_used: number;
  within_cap: boolean;
  resets_at: string | null;
}

export interface OrganizationUsageSummary {
  organization_id: OrganizationId;
  budget: {
    total_cost_cents: number;
    budget_cents: number;
    budget_remaining_cents: number;
    percent_used: number;
    within_budget: boolean;
    plan_type: string | null;
    period_start: string | null;
    period_end: string | null;
  };
  windows: UsageRollingWindow[];
  /**
   * Burn-rate projection: at the trailing-24h pace, when the monthly
   * budget runs out. Null when it carries no signal (nothing spent
   * recently, no budget to exhaust, already over, or the period
   * resets first).
   */
  projected_exhaustion_at: string | null;
  usage: {
    token_count: number;
    total_cost_cents: number;
  };
  by_api_key: Array<{
    api_key_id: string | null;
    name: string | null;
    last4: string | null;
    token_count: number;
    total_cost_cents: number;
  }>;
}

export interface OrganizationSubscriptionEnvelope {
  subscription: {
    id: string;
    plan_type: string;
    status: string;
    billing_interval: string;
    /** Billed seat quantity — roster cap + pooled-allowance multiplier. */
    seat_count: number;
    price_cents: number;
    currency: string;
    current_period_start: string;
    current_period_end: string;
    trial_end: string | null;
    usage_mode: "inference_included" | "byok" | string;
    canceled_at: string | null;
    ended_at: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  organization: {
    id: OrganizationId;
  };
  message?: string;
}

// ────────────────────────────────────────────────────────────────────
// Customer-console: per-key usage drill-down + account-level rollup
// ────────────────────────────────────────────────────────────────────

export interface ApiKeyUsageResponse {
  api_key_id: string;
  organization_id: OrganizationId;
  period_start: string;
  period_end: string;
  totals: { token_count: number; total_cost_cents: number };
  by_day: Array<{ day: string; token_count: number; total_cost_cents: number }>;
}

export interface AccountUsageSummaryResponse {
  account_id: string;
  organizations_count: number;
  consolidated: { token_count: number; total_cost_cents: number };
  by_organization: Array<{
    organization_id: OrganizationId;
    name: string;
    token_count: number;
    total_cost_cents: number;
    period_start: string | null;
    period_end: string | null;
  }>;
}

export type UsageBreakdownGroupBy =
  | "workspace"
  | "model"
  | "day"
  | "api_key"
  | "member"
  | "operation_type";

export interface UsageBreakdownByWorkspace {
  workspace_id: string;
  name: string | null;
  key: string | null;
  token_count: number;
  total_cost_cents: number;
}
export interface UsageBreakdownByModel {
  model_id: string;
  display_name: string | null;
  provider: string | null;
  token_count: number;
  total_cost_cents: number;
}
export interface UsageBreakdownByDay {
  day: string;
  token_count: number;
  total_cost_cents: number;
}
export interface UsageBreakdownByApiKey {
  api_key_id: string | null;
  name: string | null;
  last4: string | null;
  token_count: number;
  total_cost_cents: number;
}
/** `account_id`/`name`/`email` null = the "system & background" lump. */
export interface UsageBreakdownByMember {
  account_id: string | null;
  name: string | null;
  email: string | null;
  token_count: number;
  total_cost_cents: number;
}
export interface UsageBreakdownByOperationType {
  operation_type: string;
  token_count: number;
  total_cost_cents: number;
}

export interface UsageBreakdownResponse {
  organization_id: OrganizationId;
  group_by: UsageBreakdownGroupBy;
  period_start: string;
  period_end: string;
  data:
    | UsageBreakdownByWorkspace[]
    | UsageBreakdownByModel[]
    | UsageBreakdownByDay[]
    | UsageBreakdownByApiKey[]
    | UsageBreakdownByMember[]
    | UsageBreakdownByOperationType[];
}

// ────────────────────────────────────────────────────────────────────
// Customer-console: events
// ────────────────────────────────────────────────────────────────────

export interface EventResponse {
  id: string;
  type: string;
  api_version: string;
  organization_id: OrganizationId;
  workspace_id: WorkspaceId;
  aggregate_type: string;
  aggregate_id: string | null;
  occurred_at: string;
  status: string;
  data: Record<string, unknown>;
  previous_attributes: Record<string, unknown> | null;
  outcomes: Array<{
    id: string;
    status: string;
    result: Record<string, unknown> | null;
    submitter_account_id: string | null;
    received_at: string;
  }>;
}

export interface CursorPage<T> {
  data: T[];
  has_more: boolean;
  next_page_url: string | null;
  previous_page_url: string | null;
}

// ────────────────────────────────────────────────────────────────────
// Customer-console: audit logs
// ────────────────────────────────────────────────────────────────────

export interface AuditEventResponse {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  organization_id: OrganizationId;
  workspace_id: WorkspaceId;
  source: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  occurred_at: string;
}

export interface ListAuditLogsQuery {
  page_size?: number;
  page_token?: string;
  actor_id?: string;
  action?: string;
  target_type?: string;
  source?: string;
  workspace_id?: string;
  occurred_at_gte?: string;
  occurred_at_lte?: string;
}

// ────────────────────────────────────────────────────────────────────
// Customer-console: notification preferences
// ────────────────────────────────────────────────────────────────────

export interface NotificationPreferencesResponse {
  account_id: string;
  email_on_spend_alert: boolean;
  email_on_failed_webhook: boolean;
  email_on_rotated_key: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateNotificationPreferencesRequest {
  email_on_spend_alert?: boolean;
  email_on_failed_webhook?: boolean;
  email_on_rotated_key?: boolean;
}

// ────────────────────────────────────────────────────────────────────
// Customer-console: Command Center landing-page composite
// ────────────────────────────────────────────────────────────────────

export interface ConsoleSummaryResponse {
  account: {
    id: string;
    email: string;
    full_name: string | null;
  };
  organization: {
    id: OrganizationId;
    name: string;
    billing_email: string | null;
    plan_type: string | null;
    created_at: string;
  };
  current_workspace: {
    id: WorkspaceId;
    name: string;
    key: string;
  } | null;
  usage_this_period: {
    total_cost_cents: number;
    token_count: number;
    percent_used: number;
    budget_cents: number;
    period_start: string | null;
    period_end: string | null;
  };
  api_health: {
    request_count_24h: number;
    error_rate_24h: number;
  };
  webhook_health: {
    delivery_count_24h: number;
    failure_rate_24h: number;
    last_failure_at: string | null;
  };
  events_recent: EventResponse[];
  audit_recent: AuditEventResponse[];
  api_keys_active: number;
  members_count: number;
  open_incidents: number;
}

class PlatformApiClient extends BaseApiClient {
  async getOrganizationUsageSummary(
    organizationId: string,
  ): Promise<OrganizationUsageSummary> {
    return this.request<OrganizationUsageSummary>(
      `/organizations/${organizationId}/usage/summary`,
    );
  }

  async getOrganizationSubscription(
    organizationId: string,
  ): Promise<OrganizationSubscriptionEnvelope> {
    return this.request<OrganizationSubscriptionEnvelope>(
      `/organizations/${organizationId}/subscription`,
    );
  }

  async getApiKeyUsage(
    id: string,
    query: { from?: string; to?: string } = {},
  ): Promise<ApiKeyUsageResponse> {
    const search = new URLSearchParams();
    if (query.from) search.set("from", query.from);
    if (query.to) search.set("to", query.to);
    const qs = search.toString();
    return this.request<ApiKeyUsageResponse>(
      `/api_keys/${id}/usage${qs ? `?${qs}` : ""}`,
    );
  }

  async getOrganizationUsageBreakdown(
    organizationId: string,
    query: {
      group_by: UsageBreakdownGroupBy;
      from?: string;
      to?: string;
    },
  ): Promise<UsageBreakdownResponse> {
    const search = new URLSearchParams({ group_by: query.group_by });
    if (query.from) search.set("from", query.from);
    if (query.to) search.set("to", query.to);
    return this.request<UsageBreakdownResponse>(
      `/organizations/${organizationId}/usage/breakdown?${search.toString()}`,
    );
  }

  async getAccountUsageSummary(): Promise<AccountUsageSummaryResponse> {
    return this.request<AccountUsageSummaryResponse>(
      "/accounts/me/usage/summary",
    );
  }

  async listAuditLogs(
    query: ListAuditLogsQuery = {},
  ): Promise<CursorPage<AuditEventResponse>> {
    const search = new URLSearchParams();
    if (query.page_size != null)
      search.set("page_size", String(query.page_size));
    if (query.page_token) search.set("page_token", query.page_token);
    if (query.actor_id) search.set("actor_id", query.actor_id);
    if (query.action) search.set("action", query.action);
    if (query.target_type) search.set("target_type", query.target_type);
    if (query.source) search.set("source", query.source);
    if (query.workspace_id) search.set("workspace_id", query.workspace_id);
    if (query.occurred_at_gte)
      search.set("occurred_at_gte", query.occurred_at_gte);
    if (query.occurred_at_lte)
      search.set("occurred_at_lte", query.occurred_at_lte);
    const qs = search.toString();
    return this.request<CursorPage<AuditEventResponse>>(
      `/audit_logs${qs ? `?${qs}` : ""}`,
    );
  }

  async getNotificationPreferences(): Promise<NotificationPreferencesResponse> {
    return this.request<NotificationPreferencesResponse>(
      "/accounts/me/notification_preferences",
    );
  }

  async updateNotificationPreferences(
    body: UpdateNotificationPreferencesRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<NotificationPreferencesResponse> {
    return this.request<NotificationPreferencesResponse>(
      "/accounts/me/notification_preferences",
      {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }

  async deleteAccount(
    confirmation: "DELETE",
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ deleted: true }> {
    return this.request<{ deleted: true }>("/accounts/me", {
      method: "DELETE",
      body: JSON.stringify({ confirmation }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  async getConsoleSummary(
    organizationId: string,
  ): Promise<ConsoleSummaryResponse> {
    return this.request<ConsoleSummaryResponse>(
      `/organizations/${organizationId}/console_summary`,
    );
  }
}

export const platformApi = new PlatformApiClient();
