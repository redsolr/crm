/**
 * WorkOS Standalone Connect (2026-08-08) — the /mcp OAuth door's login
 * screen becomes OUR login page instead of the hosted AuthKit UI.
 *
 * Mechanics: AuthKit (still the authorization server for /mcp) is
 * configured with an external Login URI pointing at
 * `/login/connect`. When an OAuth client (claude.ai, Cursor, …) needs
 * a sign-in, AuthKit redirects there with a temporary
 * `external_auth_id`. We authenticate the user with the app's normal
 * custom UI (or reuse the live session cookie — zero screens), then
 * call AuthKit's completion API, which returns the `redirect_uri`
 * that resumes the OAuth flow (consent → code → tokens). Token
 * verification on /mcp is untouched.
 *
 * The pending `external_auth_id` survives the login round-trip in a
 * short-lived httpOnly cookie; both auth paths (OAuth callback,
 * password action) check it after `saveSession` and finish the
 * handoff instead of entering the app.
 */

export const CONNECT_PENDING_COOKIE = "crm-connect-pending";
export const CONNECT_PENDING_MAX_AGE_SECONDS = 10 * 60;

/** `?connect=1` on /login — renders the "sign in to authorize" note. */
export const CONNECT_CONTEXT_PARAM = "connect";

const COMPLETE_URL = "https://api.workos.com/authkit/oauth2/complete";

export interface ConnectUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Tell AuthKit WHO authenticated for this authorization session.
 * Returns the URL that resumes the OAuth flow. Throws on any failure —
 * callers surface `connect_failed` on the login page, never a silent
 * dead-end.
 */
export async function completeStandaloneConnect(
  externalAuthId: string,
  user: ConnectUser,
): Promise<string> {
  const apiKey = process.env.WORKOS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "WORKOS_API_KEY is not configured — cannot complete the connect handoff.",
    );
  }
  const response = await fetch(COMPLETE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_auth_id: externalAuthId,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.firstName ?? undefined,
        last_name: user.lastName ?? undefined,
      },
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(
      `AuthKit connect completion failed (${response.status}): ${detail}`,
    );
  }
  const data = (await response.json()) as { redirect_uri?: unknown };
  if (typeof data.redirect_uri !== "string" || data.redirect_uri === "") {
    throw new Error(
      "AuthKit connect completion returned no redirect_uri — cannot resume the OAuth flow.",
    );
  }
  return data.redirect_uri;
}
