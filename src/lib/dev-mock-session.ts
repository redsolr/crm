/**
 * Storage helpers for the dev:mock auth flow.
 *
 * dev:mock mode (`MOCK_AUTH=true`, set by `npm run dev:mock` and the
 * Playwright integration webServer) mounts `E2EAuthInit` instead of
 * the WorkOS `AuthKitProvider`. That component:
 *
 *   - Reads a seeded user from `localStorage[SEEDED_USER_KEY]` and
 *     hydrates the Zustand auth store from it (Playwright fixture
 *     path).
 *   - Falls back to hydrating a canned dev user for manual browser
 *     dev, stored in `localStorage` so the next mount short-circuits.
 *     (No backend call — mock-mode routes accept session-less callers.)
 *
 * Without explicit signaling, that auto-login fires on EVERY layout
 * mount — including the page load immediately following a click on
 * "Log out" or "Delete account". The user would be silently re-
 * authenticated and bounced to `/chat`. This file centralizes the
 * signaling primitive that prevents that.
 *
 *   `markDevMockSignedOut()`  — call on explicit logout. Drops the
 *                                seeded user from `localStorage` and
 *                                stamps a tab-scoped sessionStorage
 *                                flag.
 *   `isDevMockSignedOut()`    — `E2EAuthInit` reads this. Returns
 *                                true → skip auto-login.
 *   `clearDevMockSignedOut()` — call when a real login lands (so a
 *                                later in-tab re-login works without
 *                                a full tab close).
 *
 * sessionStorage is deliberately tab-scoped: a fresh tab still auto-
 * logs-in (the convenience that motivates dev:mock in the first
 * place); the user only stays signed-out within the tab where they
 * explicitly signed out.
 *
 * Production (WorkOS) is unaffected — `E2EAuthInit` doesn't mount,
 * these helpers are called but read/write storage keys that nothing
 * else cares about. Harmless no-ops.
 */

const SIGNED_OUT_KEY = "dev-mock-explicit-signed-out";
const SEEDED_USER_KEY = "e2e-auth-user";

/**
 * Storage key for the Playwright-seeded / dev-mock canned user. Read
 * by `E2EAuthInit` during hydration.
 */
export { SEEDED_USER_KEY };

/**
 * Mark the user as explicitly signed out in this tab. Called by
 * `authTokenManager.logout()` immediately before the page navigation
 * to `/logout`.
 */
export function markDevMockSignedOut(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SEEDED_USER_KEY);
    sessionStorage.setItem(SIGNED_OUT_KEY, "true");
  } catch (err) {
    console.debug("[dev-mock-session] storage unavailable on mark:", err);
  }
}

/**
 * Has the user explicitly signed out in this tab? Read by
 * `E2EAuthInit` to skip the auto-login fallback.
 */
export function isDevMockSignedOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(SIGNED_OUT_KEY) === "true";
  } catch (err) {
    console.debug("[dev-mock-session] sessionStorage read failed:", err);
    return false;
  }
}

/**
 * Clear the signed-out flag. Called by the Zustand auth store
 * whenever a non-null user is set — any successful login lifts the
 * lockout so a later re-login within the same tab works without
 * a tab close.
 */
export function clearDevMockSignedOut(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SIGNED_OUT_KEY);
  } catch (err) {
    console.debug("[dev-mock-session] sessionStorage unavailable:", err);
  }
}
