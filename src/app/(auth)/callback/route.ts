import { NextRequest, NextResponse } from "next/server";
import { saveSession, getWorkOS } from "@workos-inc/authkit-nextjs";
import {
  LAST_ACCOUNT_COOKIE,
  LAST_ACCOUNT_MAX_AGE_SECONDS,
  serializeLastAccount,
} from "@/lib/last-account";
import { classifyLoginError, LOGIN_ERROR_PARAM } from "@/lib/login-error";
import {
  CONNECT_PENDING_COOKIE,
  completeStandaloneConnect,
} from "@/server/connect";

const clientId = process.env.WORKOS_CLIENT_ID!;

/** Bounce to /login with a visible error code — never a silent loop. */
function loginRedirect(
  request: NextRequest,
  error?: string,
  errorDescription?: string,
): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set(
    LOGIN_ERROR_PARAM,
    classifyLoginError(error, errorDescription),
  );
  return NextResponse.redirect(url);
}

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
 *
 * Failures never bounce silently: WorkOS error params (or a thrown
 * OauthException) are classified via `src/lib/login-error.ts` and sent
 * to `/login?error=<code>` so the login page can explain — the
 * invite-only rejection especially (`not_invited`).
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    // WorkOS reports failures (not-invited sign-in, cancelled consent, …)
    // by redirecting back with error params instead of a code.
    const error = request.nextUrl.searchParams.get("error") ?? undefined;
    const errorDescription =
      request.nextUrl.searchParams.get("error_description") ?? undefined;
    console.error("[callback] No authorization code:", {
      error,
      errorDescription,
    });
    return loginRedirect(request, error, errorDescription);
  }

  try {
    const workos = getWorkOS();
    const authResponse = await workos.userManagement.authenticateWithCode({
      code,
      clientId,
    });

    await saveSession(authResponse, request);

    // Standalone Connect handoff: this sign-in was initiated by an
    // OAuth client via /login/connect — resume ITS flow instead of
    // entering the app. Failure surfaces on /login, never a dead end.
    const pendingConnect = request.cookies.get(CONNECT_PENDING_COOKIE)?.value;
    let destination = new URL("/sales", request.url).toString();
    if (pendingConnect) {
      try {
        destination = await completeStandaloneConnect(pendingConnect, {
          id: authResponse.user.id,
          email: authResponse.user.email,
          firstName: authResponse.user.firstName,
          lastName: authResponse.user.lastName,
        });
      } catch (error) {
        console.error("[callback] connect completion failed:", error);
        const url = new URL("/login", request.url);
        url.searchParams.set(LOGIN_ERROR_PARAM, "connect_failed");
        destination = url.toString();
      }
    }

    const response = NextResponse.redirect(destination);
    if (pendingConnect) {
      response.cookies.set(CONNECT_PENDING_COOKIE, "", {
        httpOnly: true,
        maxAge: 0,
        path: "/",
      });
    }
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
    // OauthException carries `error` + `errorDescription`; read them
    // structurally so classification works whatever the SDK throws.
    const { error: code, errorDescription } = error as {
      error?: unknown;
      errorDescription?: unknown;
    };
    return loginRedirect(
      request,
      typeof code === "string" ? code : undefined,
      typeof errorDescription === "string" ? errorDescription : undefined,
    );
  }
}
