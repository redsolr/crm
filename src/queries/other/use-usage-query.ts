"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  usageApi,
  billingApi,
  UsageSummary,
  BillingOverview,
  LimitCheckResult,
} from "@/lib/usageApi";
import { useAuthStore } from "@/stores/auth.store";

export interface UsageData {
  summary: UsageSummary | null;
  billing: BillingOverview | null;
  tokenLimit: LimitCheckResult | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useUsageQuery(): UsageData {
  const user = useAuthStore((s) => s.user);
  const account_id = user?.account_id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: account_id
      ? queryKeys.usage.summary(account_id)
      : queryKeys.usage.all,
    queryFn: async () => {
      if (!account_id) throw new Error("No account ID");

      const [summaryData, billingData, limitData] = await Promise.all([
        usageApi.getSummary(account_id).catch(() => null),
        billingApi.getOverview(account_id).catch(() => null),
        usageApi.checkLimit("llm_tokens", account_id).catch(() => null),
      ]);

      return {
        summary: summaryData,
        billing: billingData,
        tokenLimit: limitData,
      };
    },
    enabled: !!account_id,
  });

  const refresh = () => {
    if (account_id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.usage.all });
    }
  };

  return {
    summary: query.data?.summary ?? null,
    billing: query.data?.billing ?? null,
    tokenLimit: query.data?.tokenLimit ?? null,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refresh,
  };
}

/**
 * Computed helpers for common usage display scenarios
 */
export function useUsageDisplayQuery() {
  const { summary, billing, tokenLimit, isLoading, error, refresh } =
    useUsageQuery();

  const totalTokensUsed =
    (billing?.totalInputTokens ?? 0) + (billing?.totalOutputTokens ?? 0);
  const tokenLimitValue = tokenLimit?.limit ?? Infinity;

  const percentUsed =
    tokenLimitValue === Infinity
      ? 0
      : Math.round((totalTokensUsed / tokenLimitValue) * 100);

  const totalCost = billing?.totalCost ?? 0;
  const formattedCost = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(totalCost);

  const periodEnd = summary?.periodEnd ? new Date(summary.periodEnd) : null;

  const formattedPeriodEnd = periodEnd
    ? periodEnd.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return {
    summary,
    billing,
    tokenLimit,
    isLoading,
    error,
    refresh,
    totalTokensUsed,
    tokenLimitValue,
    percentUsed,
    totalCost,
    formattedCost,
    periodEnd,
    formattedPeriodEnd,
    inputTokens: billing?.totalInputTokens ?? 0,
    outputTokens: billing?.totalOutputTokens ?? 0,
    apiCalls: billing?.recordCount ?? 0,
    hasLimit: tokenLimitValue !== Infinity,
    isOverLimit: tokenLimit?.withinLimits === false,
  };
}
