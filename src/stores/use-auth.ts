"use client";

import { useCallback } from "react";
import { useAuthStore, type AuthUser } from "./auth.store";
import { useShallow } from "zustand/react/shallow";

export type { AuthUser };

/**
 * Drop-in replacement for the old useAuth() context hook.
 * Same API surface — consumers don't need to change their destructuring.
 */
export function useAuth() {
  const { user, loading, needsOnboarding, backendToken } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      loading: s.loading,
      needsOnboarding: s.needsOnboarding,
      backendToken: s.backendToken,
    })),
  );

  const login = useAuthStore((s) => s.login);
  const logoutAction = useAuthStore((s) => s.logout);
  const setNeedsOnboarding = useAuthStore((s) => s.setNeedsOnboarding);
  const hasPermissionFn = useAuthStore((s) => s.hasPermission);
  const hasRoleFn = useAuthStore((s) => s.hasRole);

  const isAuthenticated = user !== null;

  const logout = useCallback(async () => {
    logoutAction();
  }, [logoutAction]);

  const hasPermission = useCallback(
    (permission: string) => hasPermissionFn(permission),
    [hasPermissionFn],
  );

  const hasRole = useCallback((role: string) => hasRoleFn(role), [hasRoleFn]);

  const getAccessToken = useCallback(
    async (): Promise<string | null> => backendToken,
    [backendToken],
  );

  return {
    user,
    loading,
    login,
    logout,
    isAuthenticated,
    needsOnboarding,
    setNeedsOnboarding,
    hasPermission,
    hasRole,
    getAccessToken,
  };
}
