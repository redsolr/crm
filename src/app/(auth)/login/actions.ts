"use server";

/**
 * Email + password login server action.
 *
 * Flow: call WorkOS `authenticateWithPassword`, then hand the resulting
 * session tokens off to authkit-nextjs's `saveSession`, which seals them with
 * `WORKOS_COOKIE_PASSWORD` and writes the `wos-session` cookie. Once the
 * cookie is set, the rest of the app (proxy → withAuth → AuthKitProvider →
 * useAuthSync) picks it up on the next navigation, same as the OAuth flow.
 *
 * Gotcha (authkit-nextjs ≥ 3.0 still exhibits this):
 *   `saveSession(authResponse, <url>)` calls `new URL(<url>)` internally to
 *   decide whether to set `Secure` on the cookie. If you pass a bare pathname
 *   like `/login`, URL construction throws and the catch defaults to
 *   `Secure=true` — which makes the cookie invisible to the browser over
 *   plain `http://localhost`, silently logging you out on the next request.
 *
 *   Fix: always pass an ABSOLUTE URL built from the current request headers
 *   so authkit can correctly detect `http:` vs `https:`. Never pass a bare
 *   path.
 */

import { headers } from "next/headers";
import { saveSession } from "@workos-inc/authkit-nextjs";
import { workos, clientId } from "@/lib/workos";

/** Build an absolute URL for the current request from forwarded headers. */
async function getRequestBaseUrl(): Promise<string> {
  const hdrs = await headers();
  const host =
    hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const forwardedProto = hdrs.get("x-forwarded-proto");
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = forwardedProto ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

export async function emailPasswordLogin(
  formData: FormData,
): Promise<{ error?: string }> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email ||
    !password
  ) {
    return { error: "Email and password are required" };
  }

  try {
    const authResponse = await workos.userManagement.authenticateWithPassword({
      clientId,
      email,
      password,
    });

    const requestUrl = `${await getRequestBaseUrl()}/login`;
    await saveSession(authResponse, requestUrl);

    return {};
  } catch (err: unknown) {
    console.error("[emailPasswordLogin] authentication failed:", err);
    const message =
      err instanceof Error ? err.message : "Authentication failed";

    if (message.includes("invalid") || message.includes("credentials")) {
      return { error: "Invalid email or password" };
    }
    if (message.includes("not found")) {
      return { error: "No account found with this email" };
    }
    return { error: "Something went wrong. Please try again." };
  }
}
