import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";
import {
  CONNECT_CONTEXT_PARAM,
  CONNECT_PENDING_COOKIE,
  CONNECT_PENDING_MAX_AGE_SECONDS,
  completeStandaloneConnect,
} from "@/server/connect";
import { LOGIN_ERROR_PARAM } from "@/lib/login-error";

/**
 * `GET /login/connect?external_auth_id=…` — the Standalone Connect
 * entry point AuthKit's Login URI targets (see `src/server/connect.ts`
 * for the whole picture).
 *
 * Already signed in → complete the handoff immediately and resume the
 * OAuth flow: an active CRM user authorizing an MCP client never sees
 * a screen. Signed out → stash the `external_auth_id` in a short-lived
 * httpOnly cookie and show OUR login page; the auth paths finish the
 * handoff after sign-in.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const externalAuthId = request.nextUrl.searchParams.get("external_auth_id");
  if (externalAuthId === null || externalAuthId === "") {
    // Not an AuthKit-initiated visit — nothing to connect.
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let user: Awaited<ReturnType<typeof withAuth>>["user"] = null;
  try {
    ({ user } = await withAuth());
  } catch (error) {
    // No proxy context (direct hit, tests) — same answer as signed out.
    console.warn("[connect] withAuth unavailable — treating as signed out:", error);
  }

  if (user) {
    try {
      const redirectUri = await completeStandaloneConnect(externalAuthId, {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      return NextResponse.redirect(redirectUri);
    } catch (error) {
      console.error("[connect] completion failed for signed-in user:", error);
      const url = new URL("/login", request.url);
      url.searchParams.set(LOGIN_ERROR_PARAM, "connect_failed");
      return NextResponse.redirect(url);
    }
  }

  const url = new URL("/login", request.url);
  url.searchParams.set(CONNECT_CONTEXT_PARAM, "1");
  const response = NextResponse.redirect(url);
  response.cookies.set(CONNECT_PENDING_COOKIE, externalAuthId, {
    httpOnly: true,
    maxAge: CONNECT_PENDING_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}
