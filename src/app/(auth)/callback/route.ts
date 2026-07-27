import { NextRequest, NextResponse } from "next/server";
import { saveSession, getWorkOS } from "@workos-inc/authkit-nextjs";

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

    return NextResponse.redirect(new URL("/sales", request.url));
  } catch (error) {
    console.error("[callback] Auth failed:", error);
    return NextResponse.redirect(new URL("/login", request.url));
  }
}
