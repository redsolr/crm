"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  platformApi,
  type ListAuditLogsQuery,
  type UpdateNotificationPreferencesRequest,
  type UsageBreakdownGroupBy,
} from "@/lib/platformApi";
import { queryKeys } from "../query-keys";

export function useOrganizationUsageSummaryQuery(
  organizationId: string | null | undefined,
) {
  return useQuery({
    queryKey: organizationId
      ? queryKeys.usage.organizationSummary(organizationId)
      : queryKeys.usage.all,
    queryFn: () => {
      if (!organizationId) throw new Error("organizationId is required");
      return platformApi.getOrganizationUsageSummary(organizationId);
    },
    enabled: typeof organizationId === "string" && organizationId !== "",
    staleTime: 60 * 1000,
  });
}

export function useOrganizationSubscriptionQuery(
  organizationId: string | null | undefined,
) {
  return useQuery({
    queryKey: organizationId
      ? queryKeys.subscriptions.organization(organizationId)
      : queryKeys.subscriptions.all,
    queryFn: () => {
      if (!organizationId) throw new Error("organizationId is required");
      return platformApi.getOrganizationSubscription(organizationId);
    },
    enabled: typeof organizationId === "string" && organizationId !== "",
    staleTime: 60 * 1000,
  });
}

// ────────────────────────────────────────────────────────────────────
// Per-key usage drill-down + org breakdown groupings
// ────────────────────────────────────────────────────────────────────

export function useApiKeyUsageQuery(
  id: string | null | undefined,
  range: { from?: string; to?: string } = {},
) {
  return useQuery({
    queryKey: id
      ? queryKeys.platformApiKeys.usage(id, range.from, range.to)
      : queryKeys.platformApiKeys.all,
    queryFn: () => {
      if (!id) throw new Error("api key id is required");
      return platformApi.getApiKeyUsage(id, range);
    },
    enabled: typeof id === "string" && id !== "",
    staleTime: 60 * 1000,
  });
}

export function useUsageBreakdownQuery(
  organizationId: string | null | undefined,
  groupBy: UsageBreakdownGroupBy,
  range: { from?: string; to?: string } = {},
) {
  return useQuery({
    queryKey: organizationId
      ? queryKeys.usageBreakdown.organization(
          organizationId,
          groupBy,
          range.from,
          range.to,
        )
      : queryKeys.usageBreakdown.all,
    queryFn: () => {
      if (!organizationId) throw new Error("organizationId is required");
      return platformApi.getOrganizationUsageBreakdown(organizationId, {
        group_by: groupBy,
        ...range,
      });
    },
    enabled: typeof organizationId === "string" && organizationId !== "",
    staleTime: 60 * 1000,
  });
}

// ────────────────────────────────────────────────────────────────────
// Account-level consolidated usage
// ────────────────────────────────────────────────────────────────────

export function useAccountUsageSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.accountUsage.me(),
    queryFn: () => platformApi.getAccountUsageSummary(),
    staleTime: 60 * 1000,
  });
}

// ────────────────────────────────────────────────────────────────────
// Audit logs
// ────────────────────────────────────────────────────────────────────

export function useAuditLogsQuery(query: ListAuditLogsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.auditLogs.list(query as Record<string, unknown>),
    queryFn: () => platformApi.listAuditLogs(query),
    staleTime: 30 * 1000,
  });
}

// ────────────────────────────────────────────────────────────────────
// Notification preferences
// ────────────────────────────────────────────────────────────────────

export function useNotificationPreferencesQuery() {
  return useQuery({
    queryKey: queryKeys.notificationPreferences.me(),
    queryFn: () => platformApi.getNotificationPreferences(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateNotificationPreferencesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateNotificationPreferencesRequest) =>
      platformApi.updateNotificationPreferences(body),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.notificationPreferences.me(), data);
    },
  });
}

// ────────────────────────────────────────────────────────────────────
// Account deletion (full cascade)
// ────────────────────────────────────────────────────────────────────

export function useDeleteAccountMutation() {
  return useMutation({
    mutationFn: () => platformApi.deleteAccount("DELETE"),
  });
}

// ────────────────────────────────────────────────────────────────────
// Command Center (composite landing-page payload)
// ────────────────────────────────────────────────────────────────────

export function useConsoleSummaryQuery(organizationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.consoleSummary.organization(organizationId ?? ""),
    queryFn: () => platformApi.getConsoleSummary(organizationId!),
    enabled: !!organizationId,
    // Landing page is read often (every nav back to /home); 30s stale
    // is the same window we use for events / audit so the recent-events
    // tile and the events page agree on freshness.
    staleTime: 30 * 1000,
  });
}
