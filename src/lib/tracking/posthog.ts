"use client";

import posthog from "posthog-js";

let initialized = false;

export function initPostHog() {
  if (initialized) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  if (typeof window === "undefined") return;

  posthog.init(key, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    persistence: "localStorage+cookie",
    loaded: (ph) => {
      // Explicitly disable debug — PostHog persists debug state in localStorage
      ph.debug(false);
    },
  });

  initialized = true;
}

export function identifyUser(userId: string, traits?: Record<string, string>) {
  posthog.identify(userId, traits);
}

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
) {
  posthog.capture(event, properties);
}

export function resetUser() {
  posthog.reset();
}

export { posthog };
