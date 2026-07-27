"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { accountApiClient } from "@/lib/accountApi";
import { useAuthStore } from "@/stores/auth.store";

const ACCOUNT_DATA_KEY = ["accountData"] as const;

export function useAccountDataQuery() {
  const user = useAuthStore((s) => s.user);
  const account_id = user?.account_id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...ACCOUNT_DATA_KEY, account_id],
    queryFn: async () => {
      if (!account_id) throw new Error("No account ID");

      const [usageResult, subResult] = await Promise.allSettled([
        accountApiClient.getUsageSummary(account_id),
        accountApiClient.getSubscription(account_id),
      ]);

      return {
        usage: usageResult.status === "fulfilled" ? usageResult.value : null,
        subscription: subResult.status === "fulfilled" ? subResult.value : null,
      };
    },
    enabled: !!account_id,
    staleTime: 2 * 60 * 1000, // 2 min — usage changes with each chat
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ACCOUNT_DATA_KEY });

  return {
    usage: query.data?.usage ?? null,
    subscription: query.data?.subscription ?? null,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refresh,
  };
}
