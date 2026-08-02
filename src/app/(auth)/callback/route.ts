import { NextRequest, NextResponse } from "next/server";
import { saveSession, getWorkOS } from "@workos-inc/authkit-nextjs";
import {
  LAST_ACCOUNT_COOKIE,
  LAST_ACCOUNT_MAX_AGE_SECONDS,
  serializeLastAccount,
} from "@/lib/last-account";

const clientId = process.env.WORKOS_CLIENT_ID!;

/**
 * OAuth callback handler.
 *
 * Exchanges the authorization `code` for tokens, saves the session cookie,
 * and redirects to /sales. Works with both direct provider redirects
 * (getAuthorizationUrl) and the hosted WorkOS login page (getSignInUrl).
 *
 * We use a custom handler instead of `handleAuth` because handleAuth in
 * authkit-nextjs v3 requires PKCE state, which is only set by `getSignInUrl`.
 * Our Google/Apple routes use `getAuthorizationUrl` for direct provider
 * redirects (no hosted page), which doesn't set PKCE state.
 *
 * Also records WHO signed in (and how) in the non-httpOnly
 * `crm-last-account` cookie so the login page can offer "Continue as
 * <account>" after logout — see `src/lib/last-account.ts`.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    console.error("[callback] Missing authorization code");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const workos = getWorkOS();
    const authResponse = await workos.userManagement.authenticateWithCode({
      code,
      clientId,
    });

    await saveSession(authResponse, request);

    const response = NextResponse.redirect(new URL("/sales", request.url));
    const { user, authenticationMethod } = authResponse;
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;
    response.cookies.set(
      LAST_ACCOUNT_COOKIE,
      serializeLastAccount({
        email: user.email,
        name,
        method: authenticationMethod,
      }),
      {
        maxAge: LAST_ACCOUNT_MAX_AGE_SECONDS,
        path: "/",
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
      },
    );
    return response;
  } catch (error) {
    console.error("[callback] Auth failed:", error);
    return NextResponse.redirect(new URL("/login", request.url));
  }
}
