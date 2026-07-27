"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useAuth } from "@/stores/use-auth";
import { initFaro } from "@/lib/tracking/faro";
import { initPostHog, identifyUser, resetUser } from "@/lib/tracking/posthog";
import { startPresence, stopPresence } from "@/lib/tracking/presence";

export function TrackingProvider() {
  // Initialize non-Sentry SDKs once on mount
  // (Sentry is initialized in instrumentation-client.ts — NOT here)
  useEffect(() => {
    initFaro();
    initPostHog();
  }, []);

  // Identify user across all tracking services + start presence
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      Sentry.setUser({ id: user.user_id, email: user.email || "" });
      identifyUser(user.user_id, {
        email: user.email || "",
        name: user.full_name || "",
      });

      startPresence();
    } else {
      Sentry.setUser(null);
      resetUser();
      stopPresence();
    }
  }, [user]);

  return null;
}
