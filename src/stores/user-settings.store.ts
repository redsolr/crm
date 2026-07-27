"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Subscription, UsageSummary } from "@/lib/accountApi";

interface UserSettingsState {
  subscription: Subscription | null;
  usage: UsageSummary | null;
  /** True once the initial fetch after login completes (success or failure). */
  hydrated: boolean;
  /** True while the initial or a manual refresh fetch is in progress. */
  loading: boolean;
}

interface UserSettingsActions {
  setSubscription: (subscription: Subscription | null) => void;
  setUsage: (usage: UsageSummary | null) => void;
  setHydrated: (hydrated: boolean) => void;
  setLoading: (loading: boolean) => void;
  /** Bulk-set subscription + usage + mark hydrated in one render. */
  hydrate: (data: {
    subscription: Subscription | null;
    usage: UsageSummary | null;
  }) => void;
  reset: () => void;
}

const initialState: UserSettingsState = {
  subscription: null,
  usage: null,
  hydrated: false,
  loading: false,
};

export const useUserSettingsStore = create<
  UserSettingsState & UserSettingsActions
>()(
  devtools(
    (set) => ({
      ...initialState,

      setSubscription: (subscription) =>
        set({ subscription }, false, "setSubscription"),
      setUsage: (usage) => set({ usage }, false, "setUsage"),
      setHydrated: (hydrated) => set({ hydrated }, false, "setHydrated"),
      setLoading: (loading) => set({ loading }, false, "setLoading"),

      hydrate: ({ subscription, usage }) =>
        set(
          { subscription, usage, hydrated: true, loading: false },
          false,
          "hydrate",
        ),

      reset: () => set({ ...initialState }, false, "reset"),
    }),
    { name: "UserSettingsStore" },
  ),
);

// ── Derived selectors ──────────────────────────────────────────────────

/** Current plan type, or null if not yet loaded. */
export const selectPlanType = (
  state: UserSettingsState,
): Subscription["plan_type"] | null => state.subscription?.plan_type ?? null;

/** Whether the user has an active (non-canceled) subscription. */
export const selectIsSubscribed = (state: UserSettingsState): boolean => {
  const status = state.subscription?.status;
  return status === "active" || status === "trialing";
};
