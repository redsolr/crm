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
import { API_BASE } from "@/lib/api-base";

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
 * Response payload from `POST /auth/workos/exchange`.
 *
 * Mirrors the backend `AuthExchangeResponseDto` — snake_case wire keys
 * per the platform's API discipline. The DTO returns the user's
 * **primary** organization membership (`organization_id` /
 * `organization_name`). This is the active tenant for all subsequent
 * tenant-scoped API calls; the human/payer identifier is `user.id`.
 */
export interface ExchangeResponse {
  success: true;
  user: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  organization_id: string | undefined;
  organization_name: string | undefined;
  role: string | undefined;
  needs_onboarding: boolean;
  needs_profile_setup: boolean;
  access_token: string;
  refresh_token: string;
  expires_in: number;
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
 * Build the minimal `AuthUser` we can construct purely from WorkOS data,
 * with no backend round-trip. Used as a fallback when the backend exchange
 * call fails so the UI still has something to show instead of bouncing the
 * user back to the login screen.
 */
export function buildFallbackAuthUser(user: WorkOSUserLike): AuthUser {
  return {
    user_id: user.id,
    email: user.email ?? undefined,
    full_name: deriveFullName(user),
    avatar_url: user.profilePictureUrl ?? undefined,
  };
}

/**
 * Build the fully-hydrated `AuthUser` from a successful exchange response.
 * The WorkOS user is passed in for the avatar URL fallback (the backend
 * surface excludes it on accounts created without one).
 *
 * `account_id` and `organization_id` are deliberately separate per the
 * platform tenancy model: account = the human/payer (= `user.id`);
 * organization = the tenant boundary every other API call scopes to.
 */
export function buildAuthUserFromExchange(
  workosUser: WorkOSUserLike,
  data: ExchangeResponse,
): AuthUser {
  return {
    user_id: data.user.id,
    email: data.user.email,
    full_name: data.user.full_name ?? deriveFullName(workosUser),
    avatar_url:
      data.user.avatar_url ?? workosUser.profilePictureUrl ?? undefined,
    account_id: data.user.id,
    organization_id: data.organization_id,
    organization_name: data.organization_name,
    role: data.role,
    roles: data.role ? [data.role] : [],
    permissions: [],
  };
}

/**
 * localStorage key the `/invite/[code]` page stashes the invite-link
 * code under before redirecting into the WorkOS round-trip. The
 * exchange forwards it as `invite_code` — the signup gate's ticket for
 * brand-new identities (invitation-only account creation, B2B pivot) —
 * and the backend accepts the invite server-side so the new account's
 * primary org is the inviting firm.
 */
export const INVITE_CODE_STORAGE_KEY = "jurisimus_invite_code";

function pendingInviteCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(INVITE_CODE_STORAGE_KEY);
  } catch (err) {
    // localStorage can throw in private-mode / storage-disabled browsers.
    // Recoverable — treat as "no pending invite" — but never swallow silently.
    console.warn("[auth-bridge] could not read pending invite code", err);
    return null;
  }
}

/**
 * POST the WorkOS identity to the backend and return the token-bearing
 * response. Throws on network errors; returns null on a non-2xx response so
 * callers can decide whether to fall back or surface an error.
 */
export async function exchangeWorkOSIdentity(
  user: WorkOSUserLike,
): Promise<ExchangeResponse | null> {
  // `credentials: 'include'` is required for the BE's `Set-Cookie` on
  // `/auth/workos/exchange` to land in the browser cookie jar when the
  // app and API are on different origins (`app.jurisimus.com` →
  // `api.jurisimus.com`). Browsers DROP `Set-Cookie` from cross-origin
  // responses by default; this opts in. Localhost happens to work
  // either way because every port is the same `localhost` cookie host,
  // which is exactly the kind of dev/prod divergence that hides bugs
  // until the real domain split exposes them.
  const inviteCode = pendingInviteCode();
  const response = await fetch(`${API_BASE}/auth/workos/exchange`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workos_user_id: user.id,
      email: user.email,
      name: deriveFullName(user),
      picture: user.profilePictureUrl,
      ...(inviteCode !== null && inviteCode !== ""
        ? { invite_code: inviteCode }
        : {}),
    }),
  });

  if (!response.ok) {
    return null;
  }
  // The invite is consumed (or was invalid) — either way it must not
  // ride along on future exchanges.
  if (inviteCode !== null && typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(INVITE_CODE_STORAGE_KEY);
    } catch (err) {
      console.error("auth-bridge: failed clearing stored invite code", err);
    }
  }
  return (await response.json()) as ExchangeResponse;
}
