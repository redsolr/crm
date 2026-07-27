"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/stores/theme.store";
import { loadStoredMode } from "@/lib/theme";

/**
 * Theme lifecycle owner. Mounted once at the root layout.
 *
 * Responsibilities:
 *   1. Hydrate the store from localStorage on mount. The store starts with
 *      the default mode (server-safe), and we read the real value here on
 *      the browser. The pre-hydration `<script>` in `app/layout.tsx` already
 *      painted the page correctly before this runs, so users never see a
 *      flash even though React doesn't apply the value until mount.
 *   2. Register a `prefers-color-scheme` listener so users on `mode === "system"`
 *      get live updates when their OS theme changes (e.g. macOS dark→light at
 *      sunset). The listener is a no-op for `light`/`dark` modes.
 *
 * Unlike web-app, there is no light-route skip: crm-web has no marketing
 * pages. Its (auth) pages render the shared brand-context kit (velvet
 * backdrop + white card, theme-independent), so hydrating the app theme
 * on them is a visual no-op — every route hydrates the same way.
 *
 * This component renders nothing.
 */
export function ThemeInit() {
  const setMode = useThemeStore((s) => s.setMode);

  useEffect(() => {
    // 1. Hydrate from storage. setMode also applies the theme to the DOM,
    //    which matches what the pre-hydration script already painted —
    //    so this is idempotent on first run, and corrective if the script
    //    failed for any reason (e.g. localStorage access denied).
    setMode(loadStoredMode());

    // 2. Listen for OS preference changes. Only relevant when the user has
    //    chosen `system` mode; for `light`/`dark` we just re-apply the same
    //    value (still idempotent).
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (useThemeStore.getState().mode === "system") {
        setMode("system");
      }
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [setMode]);

  return null;
}
