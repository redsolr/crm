/**
 * Theme primitives — single source of truth for everything theme-related.
 *
 * Architecture:
 *   - This file is **pure**: no React, no Zustand, no module-level side effects.
 *     It can be imported from anywhere (server components, client components,
 *     workers, the inline pre-hydration script).
 *   - The Zustand store at `src/stores/theme.store.ts` consumes these helpers
 *     to manage React state.
 *   - The lifecycle component at `src/components/ThemeInit.tsx` owns the
 *     mount-time hydration and the matchMedia listener.
 *   - The marketing-route override at `src/app/(marketing)/MarketingThemeInit.tsx`
 *     uses `applyTheme()` from here so DOM mutation lives in exactly one place.
 *   - The inline `<script>` in `src/app/layout.tsx` imports
 *     `THEME_PRE_HYDRATION_SCRIPT` from here, which is generated from the
 *     same constants — no hand-mirrored JS that can drift.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** What the user has chosen. `system` follows OS preference at resolution time. */
export type ThemeMode = "system" | "light" | "dark";

/** What we actually paint. Resolution turns `system` into one of these. */
export type ResolvedTheme = "light" | "dark";

// ─── Constants ──────────────────────────────────────────────────────────────
// These are the four magic strings the rest of the system depends on. They
// must be defined here, not duplicated. The inline pre-hydration script below
// reads them via template-string interpolation at module-load time, so the
// browser only ever sees the resulting JS — never the constants themselves.

/** localStorage key. Don't change without a migration — drops users' prefs. */
export const THEME_STORAGE_KEY = "jurisimus-theme";

/**
 * What new visitors get on first paint when they have no stored preference.
 *
 * Why "dark" and not "system"? Most users on Windows have OS-level light mode,
 * but the marketing site is dark and the app's design language assumes dark.
 * Dropping users into a white app right after a dark landing page is jarring.
 * Users who prefer OS-following can opt into "system" via Settings → General.
 */
export const DEFAULT_THEME_MODE: ThemeMode = "dark";

/** HTML attribute name set on `<html>` so CSS can branch on `[data-theme=…]`. */
const THEME_DOM_ATTR = "data-theme";

/** CSS class names set on `<html>` for tailwind's `dark:` variant. */
const THEME_CSS_CLASSES = ["light", "dark"] as const;

// ─── Pure resolution ────────────────────────────────────────────────────────

/**
 * Convert a user mode into the actual theme to paint. Pure function — no DOM,
 * no storage, just `window.matchMedia` for the `system` case.
 *
 * Defensively SSR-safe: if `window` is unavailable (server render), `system`
 * falls back to dark.
 */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  // mode === "system": follow the OS, with dark as the fallback when the OS
  // has no preference or we're rendering on the server.
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  ) {
    return "light";
  }
  return "dark";
}

// ─── localStorage I/O ───────────────────────────────────────────────────────
// SSR-safe wrappers around localStorage. Server renders return the default;
// the browser hydrates the real value via `ThemeInit`'s useEffect.

export function loadStoredMode(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_THEME_MODE;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return DEFAULT_THEME_MODE;
}

export function saveStoredMode(mode: ThemeMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, mode);
}

// ─── DOM mutation ───────────────────────────────────────────────────────────
// The ONLY function in the codebase that touches `data-theme` and the
// dark/light classes on `<html>`. Everywhere else (store, marketing override,
// pre-hydration script) routes through this — except the inline script,
// which can't import at runtime and hard-codes the equivalent.

export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute(THEME_DOM_ATTR, resolved);
  root.classList.remove(...THEME_CSS_CLASSES);
  root.classList.add(resolved);
}

// ─── Pre-hydration script ───────────────────────────────────────────────────
// JS string injected as `<script dangerouslySetInnerHTML>` in the root layout.
// Runs synchronously before React hydrates, so the page never flashes the
// wrong theme on first paint.
//
// This script CANNOT import this module at runtime — it runs before any JS
// modules load. The resolution logic is therefore hand-written below, BUT all
// constants come from the exports above via template-string interpolation
// (which happens at module-load on the server, baking the values into the SSR
// HTML output). That means storage key, default mode, and DOM attribute name
// have a single source of truth even though the script body is duplicated.

export const THEME_PRE_HYDRATION_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}')||'${DEFAULT_THEME_MODE}';var r;if(t==='light')r='light';else if(t==='system')r=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';else r='dark';document.documentElement.setAttribute('${THEME_DOM_ATTR}',r);document.documentElement.classList.add(r)}catch(e){}})()`;
