import { signOut } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";

/**
 * Logout endpoint — called via `window.location.href = "/logout"` from
 * `authTokenManager.logout()` after the BE-side `POST /auth/logout`
 * call. Two things have to happen for a clean logout:
 *
 *   1. BE clears its cookies (`access_token`, `refresh_token`,
 *      `jurisimus_csrf`, `workos_session`) and revokes the WorkOS
 *      session server-side. That ran already before we got here.
 *   2. `authkit-nextjs` clears its FE-managed `wos-session` cookie.
 *      That's what this route does via `signOut()`.
 *
 * `returnTo` is REQUIRED for the production WorkOS path. Without it,
 * `signOut()` falls back to the dashboard-configured "application
 * homepage URL"; if that's unset, the user lands on
 * `error.workos.com/user_management/app-homepage-url-not-found`.
 * `BRAND.url` resolves to `process.env.NEXT_PUBLIC_APP_URL`.
 *
 * Robustness for dev:mock + tests:
 *   `signOut()` reads `wos-session` to extract `sessionId`, then
 *   redirects via `getWorkOS().userManagement.getLogoutUrl(...)`.
 *   In dev:mock mode (`MOCK_AUTH=true`) there is no `wos-session`
 *   cookie, so `signOut()` either throws or returns `undefined`.
 *   We catch and fall back to a direct redirect home — the user
 *   gets a consistent UX regardless of which auth provider seeded
 *   their session.
 *
 * `redirect()` calls inside `signOut()` throw `NEXT_REDIRECT` — that
 * has to propagate up to Next.js, NOT be swallowed here.
 */
export const GET = async () => {
  try {
    await signOut({ returnTo: BRAND.url });
  } catch (err) {
    // Re-throw `redirect()` errors so Next.js handles them. Per
    // Next.js internals, those errors carry a `digest` starting
    // with `NEXT_REDIRECT`. Anything else is a real failure (most
    // commonly "no session to sign out of" in dev:mock).
    if (
      err !== null &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest: unknown }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    console.warn(
      "[logout] signOut() failed without redirect; falling back to direct redirect:",
      err,
    );
  }
  return NextResponse.redirect(BRAND.url);
};
