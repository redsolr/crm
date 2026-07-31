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
 *   3. `useAuthSync` (this hook) mirrors the WorkOS user into the Zustand
 *      `auth.store` directly. There is NO backend exchange: WorkOS is the
 *      identity provider, and the in-repo `/api` routes authenticate via
 *      the AuthKit session cookie (the platform-era
 *      `POST /auth/workos/exchange` backend no longer exists — calling it
 *      was dead weight that 404'd on every login).
 *
 *   4. `ProtectedRoute` reads from Zustand and bounces to `/login` if the
 *      user is null. So steps 1–3 must succeed for any (app) route to load.
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
 *     Symptom: this hook never runs, user stays null, bounced to `/login`.
 *     Fix: mock auth uses server-only `MOCK_AUTH` env var (set by
 *     `npm run dev:mock` or Playwright) — never committed to `.env` files.
 * ============================================================================
 */

import { useEffect, useRef } from "react";
import { useAuth as useWorkOSAuth } from "@workos-inc/authkit-nextjs/components";
import { useAuthStore } from "@/stores/auth.store";
import { buildAuthUserFromWorkOS, type WorkOSUserLike } from "./auth-bridge";

export function useAuthSync() {
  const { user: workosUser, loading: workosLoading } = useWorkOSAuth();

  // Track the last WorkOS user id we synced, so we don't rewrite the store
  // on every render when nothing has actually changed.
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

    store.setUser(buildAuthUserFromWorkOS(workosUser as WorkOSUserLike));
    store.setLoading(false);
    syncedUserIdRef.current = workosUser.id;
  }, [workosUser, workosLoading]);
}
