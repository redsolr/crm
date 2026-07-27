"use client";

import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUserSettingsStore,
  selectPlanType,
  selectIsSubscribed,
} from "./user-settings.store";
import { accountApiClient } from "@/lib/accountApi";
import { useAuthStore } from "./auth.store";

/**
 * Primary hook for reading cached user settings (subscription, usage, plan).
 * Data is eagerly loaded at app start by `SettingsSync` — no fetch on mount.
 */
export function useUserSettings() {
  const { subscription, usage, hydrated, loading } = useUserSettingsStore(
    useShallow((s) => ({
      subscription: s.subscription,
      usage: s.usage,
      hydrated: s.hydrated,
      loading: s.loading,
    })),
  );

  const planType = useUserSettingsStore(selectPlanType);
  const isSubscribed = useUserSettingsStore(selectIsSubscribed);
  const account_id = useAuthStore((s) => s.user?.account_id);
  const organization_id = useAuthStore((s) => s.user?.organization_id);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    if (!account_id) return;

    const store = useUserSettingsStore.getState();
    store.setLoading(true);

    try {
      const [usageResult, subResult] = await Promise.allSettled([
        accountApiClient.getUsageSummary(account_id),
        // Subscription requires an active org binding; skip when
        // none is bound yet (mid-onboarding).
        organization_id != null
          ? accountApiClient.getSubscription(organization_id)
          : Promise.resolve(null),
      ]);

      const newUsage =
        usageResult.status === "fulfilled" ? usageResult.value : null;
      const newSub =
        subResult.status === "fulfilled" ? subResult.value : null;

      store.hydrate({ subscription: newSub, usage: newUsage });

      // Keep React Query cache in sync.
      queryClient.setQueryData(["accountData", account_id], {
        usage: newUsage,
        subscription: newSub,
      });
    } catch (error) {
      console.error("[useUserSettings] refresh failed:", error);
      store.setLoading(false);
    }
  }, [account_id, organization_id, queryClient]);

  return {
    subscription,
    usage,
    planType,
    isSubscribed,
    hydrated,
    loading,
    refresh,
  };
}
