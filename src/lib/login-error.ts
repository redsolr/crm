/**
 * Login-page error codes for OAuth callback failures.
 *
 * The CRM is invite-only (WorkOS sign-ups disabled), so the most common
 * real-world callback failure is a Google/Apple sign-in by an account
 * that has no seat — WorkOS rejects it and the callback used to bounce
 * back to /login with no explanation (the 2026-07-31 jadoreran silent
 * loop). The callback now classifies every failure into a small code
 * vocabulary carried via `/login?error=<code>`; the login page renders
 * the matching human message.
 *
 * WorkOS surfaces failures on two channels — `?error=<code>&
 * error_description=<text>` query params on the redirect back, or an
 * OauthException thrown by `authenticateWithCode` — and the exact
 * invite-only code string is not documented, so classification is a
 * substring match over both fields, defaulting to a generic (but
 * visible) failure message.
 */

export const LOGIN_ERROR_PARAM = "error";

export type LoginErrorCode = "not_invited" | "auth_failed";

/** Map a WorkOS error code + description onto our login-page vocabulary. */
export function classifyLoginError(
  error?: string,
  errorDescription?: string,
): LoginErrorCode {
  const haystack = `${error ?? ""} ${errorDescription ?? ""}`.toLowerCase();
  if (/sign.?up|invit/.test(haystack)) return "not_invited";
  return "auth_failed";
}

export const LOGIN_ERROR_MESSAGES: Record<LoginErrorCode, string> = {
  not_invited:
    "This account hasn't been invited to the CRM yet. Ask an admin to send you an invitation, then sign in again.",
  auth_failed: "Sign-in didn't complete. Please try again.",
};

/** Human message for a raw `?error=` param value (unknown codes → generic). */
export function loginErrorMessage(code: string): string {
  return code in LOGIN_ERROR_MESSAGES
    ? LOGIN_ERROR_MESSAGES[code as LoginErrorCode]
    : LOGIN_ERROR_MESSAGES.auth_failed;
}
