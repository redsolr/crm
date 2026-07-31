"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useAuth } from "@/stores/use-auth";
import { initFaro } from "@/lib/tracking/faro";
import { initPostHog, identifyUser, resetUser } from "@/lib/tracking/posthog";

export function TrackingProvider() {
  // Initialize non-Sentry SDKs once on mount
  // (Sentry is initialized in instrumentation-client.ts — NOT here)
  useEffect(() => {
    initFaro();
    initPostHog();
  }, []);

  // Identify user across all tracking services. Presence heartbeats were
  // platform-era dead weight — the standalone backend has no
  // /api/presence/heartbeat route, so every ping 404'd.
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      Sentry.setUser({ id: user.user_id, email: user.email || "" });
      identifyUser(user.user_id, {
        email: user.email || "",
        name: user.full_name || "",
      });
    } else {
      Sentry.setUser(null);
      resetUser();
    }
  }, [user]);

  return null;
}
