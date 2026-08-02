/**
 * Direct Google OAuth — redirects straight to Google, no WorkOS hosted page.
 *
 * Uses `getAuthorizationUrl` (not `getSignInUrl`). The callback at
 * /callback uses a custom handler with `authenticateWithCode` + `saveSession`
 * to match — NOT `handleAuth` (which requires PKCE state from `getSignInUrl`).
 *
 * DO NOT switch to `getSignInUrl()` — it routes through the WorkOS hosted
 * login page, which shows an unnecessary intermediary screen.
 *
 * Accepts `?login_hint=<email>` (the "Continue as <account>" card passes
 * it) so Google preselects that account instead of showing the chooser.
 */

import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { workos, clientId, redirectUri } from "@/lib/workos";

export async function GET(request: NextRequest) {
  const loginHint = request.nextUrl.searchParams.get("login_hint") ?? undefined;
  const url = workos.userManagement.getAuthorizationUrl({
    provider: "GoogleOAuth",
    clientId,
    redirectUri,
    loginHint,
  });
  redirect(url);
}
