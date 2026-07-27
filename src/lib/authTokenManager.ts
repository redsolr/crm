import { API_BASE } from "./api-base";
import { markDevMockSignedOut } from "./dev-mock-session";

export interface AuthUser {
  user_id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  account_id?: string;
  account_name?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * `jurisimus_csrf` cookie name. Mirrored from the backend
 * (`platform/src/modules/auth/cookies.ts` → `CSRF_COOKIE_NAME`). Kept
 * as a constant here so consumers don't accidentally drift.
 */
const CSRF_COOKIE_NAME = "jurisimus_csrf";

/**
 * Browser-side auth state.
 *
 * Post-cookie-migration the access + refresh tokens live in HttpOnly
 * cookies that JS can never read. The only auth state we still touch
 * from the browser is:
 *
 *   - "am I authenticated?" — a `/auth/me` probe with a short cache
 *     so multiple simultaneous renders don't fan-out repeated probes.
 *   - the JS-readable `jurisimus_csrf` cookie value, which `BaseApiClient`
 *     reflects as `X-CSRF-Token` on every state-changing request
 *     (double-submit-cookie defense).
 *   - logout, which calls the BE to clear cookies + redirects.
 *
 * No more `setToken` / `getToken` / `getAuthHeaders` — those were the
 * `localStorage` shape that XSS could read off. With cookies, the
 * browser carries the credential automatically (`credentials: 'include'`
 * on every fetch).
 */
class AuthTokenManager {
  private cachedAuthState: { authenticated: boolean; expiresAt: number } | null = null;
  private static readonly CACHE_MS = 30_000;
  /**
   * Set to `true` for the brief window between `logout()` being called
   * and the actual browser navigation to `/logout` taking effect. Used
   * by `notifySessionExpired()` to suppress the `auth:session-expired`
   * event — without this guard, background fetches (`findings`,
   * `history`, `refresh`, etc.) that 401 in-flight while logout is
   * unwinding would fire the event, which clears Zustand, which makes
   * ProtectedRoute push to `/login`, which is what the user sees as
   * a flash on the way to `/`.
   *
   * Reset on a fresh page load (instance is recreated).
   */
  private isLoggingOut = false;

  /**
   * Probe `GET /auth/me`. Returns `true` if the cookie session
   * resolves to a real account, `false` on 401/403/network failure.
   *
   * Cached in-memory for 30s so per-render hooks don't hammer the BE.
   * Calls `invalidateAuthState()` on logout / 401-from-other-fetches
   * to force a fresh probe.
   */
  async isAuthenticated(): Promise<boolean> {
    const now = Date.now();
    if (
      this.cachedAuthState !== null &&
      this.cachedAuthState.expiresAt > now
    ) {
      return this.cachedAuthState.authenticated;
    }
    let authenticated = false;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      authenticated = res.ok;
    } catch (err) {
      console.error("[authTokenManager] /auth/me probe failed:", err);
    }
    this.cachedAuthState = {
      authenticated,
      expiresAt: now + AuthTokenManager.CACHE_MS,
    };
    return authenticated;
  }

  /**
   * Drop the cached `/auth/me` result so the next `isAuthenticated()`
   * call re-probes. Call this on logout, on a 401 from any other
   * endpoint, and on the `auth:session-expired` event.
   */
  invalidateAuthState(): void {
    this.cachedAuthState = null;
  }

  /**
   * Read the JS-readable `jurisimus_csrf` cookie. The BE issues this
   * on login/refresh/exchange (NOT HttpOnly so JS can read it). The
   * api-client reflects the value as `X-CSRF-Token` on every state-
   * changing request — that's the double-submit-cookie defense.
   *
   * Returns `null` on the server (no `document`) or when the cookie
   * is missing (caller is unauthenticated, or BE hasn't issued one
   * yet).
   */
  getCsrfToken(): string | null {
    if (typeof document === "undefined") return null;
    const target = `${CSRF_COOKIE_NAME}=`;
    const cookies = document.cookie.split("; ");
    for (const c of cookies) {
      if (c.startsWith(target)) return c.substring(target.length);
    }
    return null;
  }

  /**
   * Force-logout side-channel — fired when a 401 from anywhere in the
   * app proves the cookie session has died. The api-client listens
   * via the `auth:session-expired` event and triggers a redirect.
   *
   * Replaces the old `clearTokenOnUnauthorized()` which used to nuke
   * `localStorage`; cookies are server-managed now, so we just
   * invalidate the in-memory cache and dispatch the event.
   */
  notifySessionExpired(): void {
    // During an explicit `logout()`, background fetches that 401 in
    // flight (or the refresh that immediately follows) would fire
    // this and cascade: `useAuthSync`'s handler resets the Zustand
    // store → ProtectedRoute on /chat sees `user=null` → pushes to
    // `/login`. The user sees that as a flash before the WorkOS
    // logout redirect chain lands on `/`. Suppress the event during
    // the logout window — the redirect handles the unwind cleanly.
    if (this.isLoggingOut) return;
    this.invalidateAuthState();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth:session-expired"));
    }
  }

  /**
   * Call BE to clear all cookies, then redirect to /login.
   * The BE's `clearTokenCookies()` zeroes `access_token`,
   * `refresh_token`, `jurisimus_csrf`, and the workos session cookie.
   */
  async logout(): Promise<void> {
    // Lock out the session-expired cascade (see `notifySessionExpired`
    // for full rationale). This must be set BEFORE the BE fetch fires,
    // so the inevitable 401s on in-flight background requests don't
    // race ahead and reset the store.
    this.isLoggingOut = true;
    const csrf = this.getCsrfToken();
    // Fire-and-forget the BE logout. `keepalive: true` keeps the
    // request alive across the page navigation that we trigger
    // synchronously below — the browser would otherwise cancel
    // an in-flight `fetch()` on `window.location.href` change.
    //
    // We intentionally DO NOT await this. Earlier we did, and the
    // ~200ms BE round-trip created a race window where Zustand's
    // sync state-clear (in `auth.store.ts`'s `logout()`) caused
    // ProtectedRoute to bounce the user to `/login` before our
    // explicit redirect to `/logout` (authkit signOut) fired. The
    // visible symptom was a brief flash through `/login` on the
    // way to the landing page.
    try {
      void fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: csrf !== null ? { "X-CSRF-Token": csrf } : {},
      }).catch((err) => {
        console.error("[authTokenManager] /auth/logout failed:", err);
      });
    } catch (err) {
      console.error("[authTokenManager] /auth/logout call threw:", err);
    }
    this.invalidateAuthState();
    if (typeof window !== "undefined") {
      // dev:mock cleanup — drops the seeded user from localStorage
      // and stamps a tab-scoped "signed out" flag so `E2EAuthInit`
      // doesn't auto-re-login on the next page mount. No-op in
      // production WorkOS mode. See `dev-mock-session.ts` for the
      // full lifecycle rationale.
      markDevMockSignedOut();
      // Critical for production WorkOS path. The BE's `/auth/logout`
      // clears its own cookies (`workos_session`, `access_token`,
      // `refresh_token`, `jurisimus_csrf`) but NOT the FE-managed
      // `wos-session` cookie that `authkit-nextjs` writes during OAuth
      // callback. If we redirect to `/login` here, the next render:
      //   1. AuthKitProvider rehydrates from the still-present
      //      `wos-session` cookie → exposes a WorkOS user.
      //   2. `useAuthSync` POSTs `/auth/workos/exchange` → BE creates a
      //      NEW account (the old one was just deleted) → user state
      //      is re-populated.
      //   3. `LoginPage` sees `isAuthenticated` → redirects to `/chat`.
      // Net effect: the user can't actually log out / can't delete
      // their account meaningfully because they get re-logged-in
      // before the redirect lands.
      //
      // `/logout` is a Next.js route that calls authkit-nextjs's
      // `signOut()` server action, which deletes the `wos-session`
      // cookie and returns a redirect to the home URL. After this
      // round-trip the user genuinely has no auth surface left.
      window.location.href = "/logout";
    }
  }
}

export const authService = new AuthTokenManager();
