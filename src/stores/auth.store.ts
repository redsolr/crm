"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { authService } from "@/lib/authTokenManager";
import { clearDevMockSignedOut } from "@/lib/dev-mock-session";

export interface AuthUser {
  user_id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  /** The human/payer identifier (= `user.id`). Not a tenant — every
   *  tenant-scoped API call uses `organization_id` instead. */
  account_id?: string;
  /** Active tenant for tenant-scoped API calls (folders, work items,
   *  usage validation, etc.). Comes from the auth/exchange response;
   *  multi-org switching is a follow-up — for now this is the user's
   *  primary membership. */
  organization_id?: string;
  organization_name?: string;
  role?: string;
  subscription?: {
    plan_type: string;
    status: string;
    current_period_end: string;
    usage: {
      chats_used: number;
      chats_limit: number;
      tokens_used: number;
      tokens_limit: number;
    };
  };
  roles?: string[];
  permissions?: string[];
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  needsOnboarding: boolean;
  backendToken: string | null;
}

interface AuthActions {
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setNeedsOnboarding: (value: boolean) => void;
  setBackendToken: (token: string | null) => void;
  login: () => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  getAccessToken: () => string | null;
  reset: () => void;
}

const initialState: AuthState = {
  user: null,
  loading: true,
  needsOnboarding: false,
  backendToken: null,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setUser: (user) => {
        // dev:mock interop — any successful login lifts the
        // explicit-signed-out lockout so a later re-login within
        // the same tab works without a tab close. No-op in
        // production WorkOS mode. See `dev-mock-session.ts`.
        if (user !== null) {
          clearDevMockSignedOut();
        }
        set({ user }, false, "setUser");
      },
      setLoading: (loading) => set({ loading }, false, "setLoading"),
      setNeedsOnboarding: (needsOnboarding) =>
        set({ needsOnboarding }, false, "setNeedsOnboarding"),
      setBackendToken: (backendToken) => {
        // Cookie-auth: the access_token cookie is set by the BE on
        // login/refresh/exchange. We still keep `backendToken` in
        // store state for code paths that want to know whether the
        // exchange succeeded (without doing a /auth/me round-trip),
        // but we no longer mirror it into JS-readable storage.
        set({ backendToken }, false, "setBackendToken");
      },

      login: () => {
        // Custom login page — NEVER `/login/redirect` (that route calls
        // getSignInUrl() → the WorkOS hosted screen, reserved for the
        // WorkOS-initiated impersonation `initiate_login_uri` flow). A
        // normal user must never land on the hosted screen.
        window.location.href = "/login";
      },

      logout: () => {
        // BE clears all three cookies on /auth/logout; redirect
        // happens inside authService.logout() via
        // `window.location.href = "/logout"`.
        //
        // We intentionally DO NOT sync-clear Zustand here. If we
        // did, the next React render would flip every subscriber
        // (notably ProtectedRoute) before `window.location.href`
        // fires, causing a flash through `/login` on the way to
        // the landing page. Letting the browser-side full-page
        // nav handle state reset (fresh mount = fresh store)
        // eliminates the flash; the ~tens-of-ms window where the
        // UI still shows "logged in" before nav starts is
        // imperceptible.
        void authService.logout();
      },

      hasPermission: (permission) =>
        get().user?.permissions?.includes(permission) ?? false,

      hasRole: (role) => get().user?.roles?.includes(role) ?? false,

      getAccessToken: () => get().backendToken,

      reset: () => {
        authService.invalidateAuthState();
        set({ ...initialState, loading: false }, false, "reset");
      },
    }),
    { name: "AuthStore" },
  ),
);
