/**
 * Pure helpers for bridging a WorkOS AuthKit user into the Zustand auth store.
 *
 * These are intentionally framework-agnostic (no React, no store access) so
 * they can be unit-tested in isolation and reused from any caller that already
 * has a WorkOS user in hand.
 *
 * See `use-auth-sync.ts` for the orchestration that wires these together.
 */

import type { AuthUser } from "@/stores/auth.store";

/**
 * Minimal shape of a WorkOS AuthKit user that we care about. We don't import
 * the SDK type directly so this module stays dependency-light.
 */
export interface WorkOSUserLike {
  id: string;
  email: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
}

/**
 * Derive a display name from a WorkOS user. Falls back to the local part of
 * the email when the user has no first/last name set (common for fresh OAuth
 * signups that haven't completed profile setup).
 */
export function deriveFullName(user: WorkOSUserLike): string | undefined {
  if (user.firstName) {
    return [user.firstName, user.lastName].filter(Boolean).join(" ");
  }
  return user.email?.split("@")[0];
}

/**
 * Build the `AuthUser` straight from the WorkOS identity — no backend
 * round-trip. WorkOS IS the identity provider for this standalone app;
 * the in-repo `/api` routes authenticate via the AuthKit session cookie,
 * so there is no second token to exchange for (the platform-era
 * `POST /auth/workos/exchange` backend no longer exists).
 *
 * `account_id` must be set: `ProtectedRoute` treats a user carrying an
 * `account_id` with no permissions array as fully authenticated.
 */
export function buildAuthUserFromWorkOS(user: WorkOSUserLike): AuthUser {
  return {
    user_id: user.id,
    email: user.email ?? undefined,
    full_name: deriveFullName(user),
    avatar_url: user.profilePictureUrl ?? undefined,
    account_id: user.id,
  };
}

/**
 * localStorage key the `/invite/[code]` page stashes the invite-link code
 * under before redirecting into the WorkOS round-trip. Retained for the
 * invite page's writes; teammate access is granted via WorkOS invitations
 * now that signup is invitation-only, so nothing reads it during auth.
 */
export const INVITE_CODE_STORAGE_KEY = "jurisimus_invite_code";
