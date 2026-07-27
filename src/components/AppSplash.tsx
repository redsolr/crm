"use client";

import { useState, memo } from "react";
import { SplashScreen } from "./SplashScreen";
import { useIsMounted } from "@/hooks/use-is-mounted";

export const SPLASH_KEY = "show-splash-after-onboarding";

/**
 * Only show the splash screen once — right after onboarding finishes.
 * Other code sets localStorage `show-splash-after-onboarding` = "1" to trigger it.
 *
 * `useIsMounted` gates first paint to `null` on both server and the
 * first client render so SSR and hydration match. After commit the
 * `useState` lazy initializer's value (read from localStorage on the
 * client) flips the splash on. Removal of the localStorage flag is
 * deferred to the moment the splash completes, so the splash plays
 * through `DURATION_MS` instead of disappearing the instant the cleanup
 * effect would fire.
 */
export const AppSplash = memo(function AppSplash() {
  const mounted = useIsMounted();
  const [shouldShow] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SPLASH_KEY) === "1";
  });
  const [done, setDone] = useState(false);

  if (!mounted || !shouldShow || done) return null;

  return (
    <SplashScreen
      onComplete={() => {
        if (typeof window !== "undefined") {
          localStorage.removeItem(SPLASH_KEY);
        }
        window.dispatchEvent(new Event("splash-done"));
        setDone(true);
      }}
    />
  );
});
