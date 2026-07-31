"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Subscription, UsageSummary } from "@/lib/accountApi";

/**
 * Billing surface state. The standalone CRM has NO billing backend —
 * there is no subscription or usage endpoint to fetch from — so the
 * store initializes already-hydrated with nulls and the account page
 * renders its honest empty states ("No subscription…"). The shape is
 * kept so a future billing integration only has to call `hydrate`.
 */

interface UserSettingsState {
  subscription: Subscription | null;
  usage: UsageSummary | null;
  /** True when the state reflects reality (always, since there is no
   *  fetch — see the module note). */
  hydrated: boolean;
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
  hydrated: true,
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
