"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { SEEDED_USER_KEY, isDevMockSignedOut } from "@/lib/dev-mock-session";

/**
 * Default mock user for `npm run dev:mock` (manual browser sessions).
 * Playwright tests inject their own user via addInitScript — this only
 * kicks in when no user has been seeded yet.
 */
const DEV_MOCK_USER = {
  user_id: "dev-mock-user-001",
  account_id: "dev-mock-account-001",
  email: "dev@jurisimus.local",
  full_name: "Dev User",
  role: "owner",
  permissions: ["admin"],
  subscription: {
    plan_type: "team",
    status: "active",
    current_period_end: "2099-01-01T00:00:00.000Z",
    usage: {
      chats_used: 0,
      chats_limit: 999_999,
      tokens_used: 0,
      tokens_limit: 999_999,
    },
  },
};

/**
 * E2E / mock-auth component that hydrates the Zustand auth store under
 * `MOCK_AUTH=true`. No backend session is involved: the standalone
 * CRM's routes accept session-less callers in mock mode (`currentActor`
 * falls back to `usr_local`), so hydrating the store IS the login.
 * (The platform-era `/auth/dev/login` fetch died with the backend
 * swap — it 404'd on every mock session and only "worked" because
 * fetch doesn't throw on 404.)
 *
 * 1. **Playwright** — addInitScript injects user data into the
 *    Playwright context. The user data lives in
 *    `localStorage["e2e-auth-user"]` for backward compat with existing
 *    test fixtures; we just hydrate the store from it.
 * 2. **Manual browser** (`npm run dev:mock`) — no Playwright context,
 *    so we hydrate the store with the canned dev user directly.
 */
export function E2EAuthInit() {
  useEffect(() => {
    const store = useAuthStore.getState();

    // Respect explicit-logout in dev:mock. The flag is set by
    // `authTokenManager.logout()` immediately before navigating to
    // `/logout` — without it, this effect would silently re-auth the
    // user on every layout mount post-logout. See `dev-mock-session.ts`
    // for the lifecycle.
    if (isDevMockSignedOut()) {
      store.setUser(null);
      store.setLoading(false);
      return;
    }

    // Read user data possibly seeded by Playwright into localStorage.
    // (NB: it's user data, not auth credentials — the credentials are
    // cookies the test context populates separately.)
    let seededUser: unknown = null;
    try {
      const raw = localStorage.getItem(SEEDED_USER_KEY);
      if (raw !== null) seededUser = JSON.parse(raw);
    } catch (err) {
      console.warn(`[E2EAuthInit] failed to parse ${SEEDED_USER_KEY}`, err);
    }

    if (seededUser !== null && typeof seededUser === "object") {
      const data = seededUser as Record<string, unknown>;
      const { needsOnboarding, ...user } = data;
      // Cast — the seeded shape is whatever the test fixture put in
      // localStorage. Exhaustive typing isn't useful here because the
      // test author owns the contract.
      store.setUser(user as unknown as Parameters<typeof store.setUser>[0]);
      if (needsOnboarding != null) {
        store.setNeedsOnboarding(Boolean(needsOnboarding));
      }
      store.setLoading(false);
      return;
    }

    // Manual dev — hydrate the canned dev user directly.
    localStorage.setItem(SEEDED_USER_KEY, JSON.stringify(DEV_MOCK_USER));
    store.setUser(DEV_MOCK_USER);
    store.setLoading(false);
  }, []);

  return null;
}
