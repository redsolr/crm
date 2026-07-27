"use client";

/**
 * Eagerly fetches subscription + usage data right after auth completes and
 * caches it in the `useUserSettingsStore` Zustand store. This means every
 * component that reads plan/tier/usage info gets it instantly from the store
 * instead of triggering its own network request on mount.
 *
 * Also pre-warms the React Query cache so `useAccountDataQuery()` consumers
 * see the data immediately without a loading state.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { useUserSettingsStore } from "@/stores/user-settings.store";
import { accountApiClient } from "@/lib/accountApi";

const ACCOUNT_DATA_KEY = ["accountData"] as const;

export function useSettingsSync() {
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const account_id = user?.account_id;
  const organization_id = user?.organization_id;
  const queryClient = useQueryClient();

  const syncedAccountIdRef = useRef<string | null>(null);

  // Reset settings store when auth resets (logout / session expired).
  useEffect(() => {
    const handleSessionExpired = () => {
      useUserSettingsStore.getState().reset();
      syncedAccountIdRef.current = null;
    };
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("auth:session-expired", handleSessionExpired);
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    // Logged out — clear settings.
    if (!account_id) {
      useUserSettingsStore.getState().reset();
      syncedAccountIdRef.current = null;
      return;
    }

    // Already synced for this account.
    if (syncedAccountIdRef.current === account_id) return;

    void fetchAndHydrate(
      account_id,
      organization_id,
      queryClient,
      syncedAccountIdRef,
    );
  }, [account_id, organization_id, authLoading, queryClient]);
}

async function fetchAndHydrate(
  account_id: string,
  organization_id: string | undefined,
  queryClient: ReturnType<typeof useQueryClient>,
  syncedAccountIdRef: React.RefObject<string | null>,
): Promise<void> {
  const store = useUserSettingsStore.getState();
  store.setLoading(true);

  try {
    const [usageResult, subResult] = await Promise.allSettled([
      accountApiClient.getUsageSummary(account_id),
      // Subscription belongs to the org, not the account. Skip the
      // call entirely if no active org is bound to the JWT yet (the
      // user is mid-onboarding) so we don't 404 on undefined.
      organization_id != null
        ? accountApiClient.getSubscription(organization_id)
        : Promise.resolve(null),
    ]);

    const usage =
      usageResult.status === "fulfilled" ? usageResult.value : null;
    const subscription =
      subResult.status === "fulfilled" ? subResult.value : null;

    // Hydrate Zustand store (single batched update).
    store.hydrate({ subscription, usage });

    // Pre-warm React Query cache so useAccountDataQuery() consumers skip
    // their own fetch and render immediately with cached data.
    queryClient.setQueryData([...ACCOUNT_DATA_KEY, account_id], {
      usage,
      subscription,
    });

    syncedAccountIdRef.current = account_id;
  } catch (error) {
    console.error("[useSettingsSync] failed to fetch user settings:", error);
    store.setLoading(false);
    store.setHydrated(true);
  }
}
