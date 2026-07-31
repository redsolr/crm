"use client";

import { useShallow } from "zustand/react/shallow";
import {
  useUserSettingsStore,
  selectPlanType,
  selectIsSubscribed,
} from "./user-settings.store";

/**
 * Primary hook for reading user settings (subscription, usage, plan).
 * The standalone CRM has no billing backend, so there is nothing to
 * fetch — the store is born hydrated with nulls and the consumers
 * render their honest empty states (see `user-settings.store.ts`).
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

  return {
    subscription,
    usage,
    planType,
    isSubscribed,
    hydrated,
    loading,
  };
}
