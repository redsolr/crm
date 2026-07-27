"use client";

/**
 * ============================================================================
 * Auth sync bridge: WorkOS AuthKit → Zustand
 * ============================================================================
 *
 * The overall auth flow (client side):
 *
 *   1. `src/proxy.ts` runs on every request and calls `authkitProxy` from
 *      `@workos-inc/authkit-nextjs` v3+. It reads the `wos-session` cookie,
 *      decrypts it, and attaches `x-workos-middleware` + `x-workos-session`
 *      headers to the downstream request. This step is REQUIRED — without it
 *      `withAuth()` throws "You are calling 'withAuth' on a route that isn't
 *      covered by the AuthKit middleware".
 *
 *   2. `AuthKitProvider` (mounted in `src/app/layout.tsx`) calls the
 *      `getAuthAction` server action, which internally calls `withAuth()` and
 *      returns the decoded user. The provider exposes it via `useAuth` from
 *      `@workos-inc/authkit-nextjs/components`.
 *
 *   3. `useAuthSync` (this hook) listens for the WorkOS user and, on every
 *      change, POSTs it to the NestJS backend at `/auth/workos/exchange` to
 *      obtain our own backend JWT + account/role context. The result is
 *      mirrored into the Zustand `auth.store`, which the rest of the app
 *      consumes via `useAuth` from `@/stores/use-auth`.
 *
 *   4. `ProtectedRoute` reads from Zustand and bounces to `/login` if the
 *      user is null. So the entire chain must succeed for `/chat` to load.
 *
 * Historical gotchas (fixed — do NOT reintroduce):
 *
 *   - authkit-nextjs < 3.0 did not support Next 16's `proxy.ts` runtime:
 *     request headers set via `NextResponse.next({ request: { headers } })`
 *     did not propagate to route handlers / server actions, so `withAuth`
 *     would always throw. Fix: upgrade to `@workos-inc/authkit-nextjs@^3.0.0`
 *     and use `authkitProxy` (the renamed `authkitMiddleware`).
 *     See: https://github.com/workos/authkit-nextjs/issues/364
 *
 *   - Mock auth flag leaked into committed `.env` once, which made
 *     `layout.tsx` mount `E2EAuthInit` instead of `AuthSync`.
 *     Symptom: this hook never runs, no `/auth/workos/exchange` call in the
 *     Network tab, user stays null, bounced to `/login`. Fix: mock auth
 *     uses server-only `MOCK_AUTH` env var (set by `npm run dev:mock`
 *     or Playwright) — never committed to `.env` files.
 * ============================================================================
 */

import { useEffect, useRef, type RefObject } from "react";
import { useAuth as useWorkOSAuth } from "@workos-inc/authkit-nextjs/components";
import { useAuthStore } from "@/stores/auth.store";
import { authService } from "@/lib/authTokenManager";
import {
  buildAuthUserFromExchange,
  buildFallbackAuthUser,
  exchangeWorkOSIdentity,
  type WorkOSUserLike,
} from "./auth-bridge";

export function useAuthSync() {
  const { user: workosUser, loading: workosLoading } = useWorkOSAuth();

  // Track the last WorkOS user id we exchanged for, so we don't re-POST the
  // backend on every render when nothing has actually changed.
  const syncedUserIdRef = useRef<string | null>(null);

  // Session-expiration listener: API clients dispatch this event on 401.
  useEffect(() => {
    const handleSessionExpired = () => {
      useAuthStore.getState().reset();
      syncedUserIdRef.current = null;
    };
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("auth:session-expired", handleSessionExpired);
    };
  }, []);

  useEffect(() => {
    if (workosLoading) return;

    const store = useAuthStore.getState();

    // Signed out: clear everything.
    if (!workosUser) {
      store.setUser(null);
      store.setBackendToken(null);
      store.setLoading(false);
      syncedUserIdRef.current = null;
      return;
    }

    // Already synced this user — nothing to do.
    if (syncedUserIdRef.current === workosUser.id) return;

    void syncWithBackend(workosUser as WorkOSUserLike, syncedUserIdRef);
  }, [workosUser, workosLoading]);
}

/**
 * Perform one exchange + store hydration cycle. Kept outside the hook so the
 * orchestration is linear and easy to read; all pure data shaping lives in
 * `auth-bridge.ts`.
 */
async function syncWithBackend(
  workosUser: WorkOSUserLike,
  syncedUserIdRef: RefObject<string | null>,
): Promise<void> {
  const store = useAuthStore.getState();

  try {
    const data = await exchangeWorkOSIdentity(workosUser);

    if (!data) {
      // Backend reachable but returned non-2xx — fall back to the minimal
      // WorkOS-derived user so the UI isn't completely blocked.
      store.setUser(buildFallbackAuthUser(workosUser));
      return;
    }

    // BE sets access + refresh + csrf cookies on /auth/workos/exchange.
    // backendToken stays in the store as a non-persistent flag for
    // code paths that need a quick "did the exchange succeed?" check.
    store.setBackendToken(data.access_token);
    authService.invalidateAuthState();
    store.setNeedsOnboarding(data.needs_onboarding ?? false);
    store.setUser(buildAuthUserFromExchange(workosUser, data));
    syncedUserIdRef.current = workosUser.id;
  } catch (error) {
    // Network error or backend down — fall back to WorkOS identity only.
    console.error("[useAuthSync] backend exchange failed:", error);
    store.setUser(buildFallbackAuthUser(workosUser));
  } finally {
    store.setLoading(false);
  }
}
