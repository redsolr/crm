/**
 * Direct Apple OAuth — redirects straight to Apple, no WorkOS hosted page.
 * See google/route.ts for explanation of why we use `getAuthorizationUrl`
 * and the `login_hint` pass-through.
 */

import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { workos, clientId, redirectUri } from "@/lib/workos";

export async function GET(request: NextRequest) {
  const loginHint = request.nextUrl.searchParams.get("login_hint") ?? undefined;
  const url = workos.userManagement.getAuthorizationUrl({
    provider: "AppleOAuth",
    clientId,
    redirectUri,
    loginHint,
  });
  redirect(url);
}
