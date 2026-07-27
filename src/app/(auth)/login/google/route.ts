/**
 * Direct Google OAuth — redirects straight to Google, no WorkOS hosted page.
 *
 * Uses `getAuthorizationUrl` (not `getSignInUrl`). The callback at
 * /callback uses a custom handler with `authenticateWithCode` + `saveSession`
 * to match — NOT `handleAuth` (which requires PKCE state from `getSignInUrl`).
 *
 * DO NOT switch to `getSignInUrl()` — it routes through the WorkOS hosted
 * login page, which shows an unnecessary intermediary screen.
 */

import { redirect } from "next/navigation";
import { workos, clientId, redirectUri } from "@/lib/workos";

export async function GET() {
  const url = workos.userManagement.getAuthorizationUrl({
    provider: "GoogleOAuth",
    clientId,
    redirectUri,
  });
  redirect(url);
}
