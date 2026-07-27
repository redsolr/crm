"use client";

import { useAuthSync } from "./use-auth-sync";

/**
 * Invisible component that bridges WorkOS auth to the Zustand store.
 * Renders nothing — just runs the sync hook.
 */
export function AuthSync() {
  useAuthSync();
  return null;
}
