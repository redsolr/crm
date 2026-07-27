/**
 * Direct Apple OAuth — redirects straight to Apple, no WorkOS hosted page.
 * See google/route.ts for explanation of why we use `getAuthorizationUrl`.
 */

import { redirect } from "next/navigation";
import { workos, clientId, redirectUri } from "@/lib/workos";

export async function GET() {
  const url = workos.userManagement.getAuthorizationUrl({
    provider: "AppleOAuth",
    clientId,
    redirectUri,
  });
  redirect(url);
}
