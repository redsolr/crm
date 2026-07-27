import { BaseApiClient } from "./api-client";

// ============ Types ============

export interface UsageSummary {
  account_id: string;
  periodStart: string;
  periodEnd: string;
  byType: {
    usageType: string;
    totalQuantity: number;
    unit: string;
    recordCount: number;
  }[];
  limits: LimitStatus[];
}

export interface LimitStatus {
  usageType: string;
  limitValue: number;
  currentUsage: number;
  percentUsed: number;
  limitType: string;
  withinLimits: boolean;
}

export interface LimitCheckResult {
  withinLimits: boolean;
  currentCount: number;
  limit: number | null;
  limitType: string | null;
}

export interface BillingOverview {
  account_id: string;
  periodStart: string;
  periodEnd: string;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  recordCount: number;
  byModel: {
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
    recordCount: number;
  }[];
}

export interface UsageRecord {
  id: string;
  account_id: string;
  usageType: string;
  quantity: string;
  unit: string;
  resourceId: string | null;
  resourceType: string | null;
  metadata: Record<string, unknown> | null;
  periodStart: string | null;
  periodEnd: string | null;
  created_at: string;
}

// ============ Usage API ============

class UsageApiClient extends BaseApiClient {
  async getSummary(
    account_id?: string,
    start_date?: Date,
    end_date?: Date,
  ): Promise<UsageSummary | null> {
    const params = new URLSearchParams();
    if (account_id) params.append("account_id", account_id);
    if (start_date) params.append("start_date", start_date.toISOString());
    if (end_date) params.append("end_date", end_date.toISOString());

    return this.request<UsageSummary | null>(`/usage/summary?${params}`);
  }

  async getRecords(options?: {
    account_id?: string;
    usageType?: string;
    start_date?: Date;
    end_date?: Date;
    limit?: number;
    offset?: number;
  }): Promise<UsageRecord[]> {
    const params = new URLSearchParams();
    if (options?.account_id) params.append("account_id", options.account_id);
    if (options?.usageType) params.append("usageType", options.usageType);
    if (options?.start_date)
      params.append("start_date", options.start_date.toISOString());
    if (options?.end_date)
      params.append("end_date", options.end_date.toISOString());
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.offset) params.append("offset", options.offset.toString());

    return this.request<UsageRecord[]>(`/usage/records?${params}`);
  }

  /**
   * Check LLM budget status via GET /usage/budget.
   * Maps the backend BudgetStatus response to the LimitCheckResult shape
   * that the frontend already consumes.
   */
  async checkLimit(
    _usageType: string,
    _accountId?: string,
  ): Promise<LimitCheckResult> {
    const budget = await this.request<{
      totalCostCents: number;
      budgetCents: number;
      budgetRemainingCents: number;
      percentUsed: number;
      withinBudget: boolean;
      planType: string;
    }>("/usage/budget");

    return {
      withinLimits: budget.withinBudget,
      currentCount: budget.totalCostCents,
      limit: budget.budgetCents,
      limitType: budget.planType,
    };
  }
}

// ============ Billing API ============

class BillingApiClient extends BaseApiClient {
  async getOverview(
    account_id?: string,
    start_date?: Date,
    end_date?: Date,
  ): Promise<BillingOverview | null> {
    const params = new URLSearchParams();
    if (account_id) params.append("account_id", account_id);
    if (start_date) params.append("start_date", start_date.toISOString());
    if (end_date) params.append("end_date", end_date.toISOString());

    return this.request<BillingOverview | null>(`/billing/overview?${params}`);
  }

  async getPricing(): Promise<unknown[]> {
    return this.request<unknown[]>("/billing/pricing");
  }
}

export const usageApi = new UsageApiClient();
export const billingApi = new BillingApiClient();
